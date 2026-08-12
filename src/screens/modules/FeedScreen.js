import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  Image,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import Screen from '../../components/Screen';
import Avatar from '../../components/Avatar';
import { colors, spacing, radius, type, roleTheme } from '../../theme';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { useNetwork } from '../../state/network';
import { confirm, notify } from '../../lib/confirm';

// Only offer an AI catch-up once a real backlog has built up, to keep API
// calls (and cost) minimal.
const CATCHUP_THRESHOLD = 10;

function relTime(iso) {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export default function FeedScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { roleForGroup, getGroup } = useGroups();

  const role = roleForGroup(groupId);
  const isModerator = role === 'Admin' || role === 'Captain';
  const group = getGroup(groupId);
  const memberCount = group ? group.members : 0;
  // Members can post unless an Admin has turned that off (moderators always can).
  const canPost = isModerator || (group ? group.allowMemberPost : true);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [announce, setAnnounce] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  // Attachments picked but not yet sent (staged with an optional caption).
  const [pending, setPending] = useState([]);
  // Text messages composed while offline, waiting to send.
  const { online } = useNetwork();
  const [queued, setQueued] = useState([]);
  const queueKey = `queue:${groupId}`;
  const flushingRef = useRef(false);

  // Chat header controls
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [muted, setMuted] = useState(false);

  // Catch me up (AI summary of unread messages)
  const [sinceTime, setSinceTime] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  const [catchUpDismissed, setCatchUpDismissed] = useState(false);

  // Long-press action menu + report modal
  const [menuPost, setMenuPost] = useState(null);
  const [reportPost, setReportPost] = useState(null);
  const [reason, setReason] = useState('');
  const [reporting, setReporting] = useState(false);

  // Per-group mute is a local preference for now (persisted on-device).
  const muteKey = `mute:${groupId}`;
  useEffect(() => {
    AsyncStorage.getItem(muteKey).then((v) => setMuted(v === '1'));
  }, [muteKey]);

  // Snapshot when this group was last opened, then mark it seen now — so we can
  // tell how much arrived while the user was away (drives "Catch me up").
  useEffect(() => {
    let active = true;
    const key = `lastSeen:${groupId}`;
    AsyncStorage.getItem(key).then((v) => {
      if (!active) return;
      setSinceTime(v || new Date().toISOString());
      AsyncStorage.setItem(key, new Date().toISOString());
    });
    return () => {
      active = false;
    };
  }, [groupId]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    AsyncStorage.setItem(muteKey, next ? '1' : '0');
    setMenuOpen(false);
    notify({
      title: next ? 'Muted' : 'Unmuted',
      message: next
        ? 'You won’t be notified about this group.'
        : 'Notifications are on for this group.',
    });
  }

  // Send a set of messages (newest-first) to the AI Edge Function and show the
  // summary card. Shared by the automatic "Catch me up" and the manual menu.
  async function runSummary(descMessages) {
    const usable = (descMessages || []).filter((m) => !m.deleted);
    if (usable.length === 0) {
      notify({ title: 'Nothing to summarize', message: 'There are no messages here yet.' });
      return;
    }
    setSummarizing(true);
    try {
      const chron = [...usable].reverse(); // oldest -> newest for the transcript
      const capped = chron.length > 150 ? chron.slice(-150) : chron;
      const payload = capped.map((m) => ({
        author_name: m.author_name,
        type: m.type,
        text: m.text,
        attachment_type: m.attachment_type,
        attachment_name: m.attachment_name,
      }));
      const { data, error } = await supabase.functions.invoke('catch-me-up', {
        body: { messages: payload, groupName },
      });
      if (error) {
        // Surface the function's friendly message (on error.context), not the
        // generic "non-2xx" string.
        let detail = '';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            if (body && body.error) detail = body.error;
          }
        } catch {
          /* use fallback below */
        }
        throw new Error(detail || 'The summary is unavailable right now — please try again in a moment.');
      }
      if (data && data.error) throw new Error(data.error);
      setSummary((data && data.summary) || 'No summary available.');
    } catch (e) {
      notify({ title: 'Summary unavailable', message: (e && e.message) || 'Please try again in a moment.' });
    } finally {
      setSummarizing(false);
    }
  }

  // Automatic: summarize just the unread backlog.
  function catchMeUp() {
    runSummary(unread);
  }

  // Manual (from the ⋮ menu): summarize the recent chat on demand, any time.
  function summarizeChat() {
    setMenuOpen(false);
    runSummary(messages.slice(0, 60));
  }

  // Filter the feed when searching (skips deleted placeholders).
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => !m.deleted && (m.text || '').toLowerCase().includes(q));
  }, [messages, query]);

  // Queued (offline) messages render at the bottom of the (inverted) list.
  const listData = useMemo(() => {
    if (query) return shown; // don't mix queued items into search results
    const q = [...queued].reverse().map((item) => ({ ...item, __queued: true }));
    return [...q, ...messages];
  }, [query, shown, queued, messages]);

  // The most recent announcement, pinned above the feed so it doesn't scroll
  // away inside the chat (messages are newest-first).
  const pinned = useMemo(
    () => messages.find((m) => m.type === 'Announcement' && !m.deleted) || null,
    [messages]
  );

  // Messages that arrived from others since the user last opened this group.
  const unread = useMemo(() => {
    if (!sinceTime) return [];
    const since = new Date(sinceTime).getTime();
    return messages.filter(
      (m) => !m.deleted && m.author_id !== user.id && new Date(m.created_at).getTime() > since
    );
  }, [messages, sinceTime, user.id]);

  const canDelete = (post) => post.author_id === user.id || isModerator;

  function deleteMessage(post) {
    setMenuPost(null);
    confirm({
      title: 'Delete message?',
      message: 'It will be replaced with “This message was deleted” for everyone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.rpc('delete_post', { pid: post.id });
        if (error) notify({ title: 'Could not delete', message: error.message });
        else load();
      },
    });
  }

  const load = useCallback(async () => {
    // Full column set first; if the attachments migration hasn't been run those
    // columns won't exist, so fall back to the base set (attachments just won't
    // render) rather than breaking the feed.
    const FULL =
      'id, author_id, author_name, type, text, deleted, created_at, attachment_url, attachment_type, attachment_name, attachment_mime';
    const BASE = 'id, author_id, author_name, type, text, deleted, created_at';
    let { data, error } = await supabase
      .from('posts')
      .select(FULL)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }); // newest first → bottom of inverted list
    if (error) {
      const retry = await supabase
        .from('posts')
        .select(BASE)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      data = retry.data;
      error = retry.error;
    }
    if (!error) setMessages(data || []);
  }, [groupId]);

  // Load the offline outbox for this group.
  useEffect(() => {
    AsyncStorage.getItem(queueKey)
      .then((raw) => {
        try {
          setQueued(raw ? JSON.parse(raw) : []);
        } catch {
          setQueued([]);
        }
      })
      .catch(() => setQueued([]));
  }, [queueKey]);

  function saveQueue(next) {
    setQueued(next);
    AsyncStorage.setItem(queueKey, JSON.stringify(next)).catch(() => {});
  }

  // Send everything in the outbox, oldest first. Reads storage as the source of
  // truth and runs at most once at a time. Triggered on reconnect and on focus.
  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    let arr = [];
    try {
      const raw = await AsyncStorage.getItem(queueKey);
      arr = raw ? JSON.parse(raw) : [];
    } catch {
      arr = [];
    }
    if (!arr.length) return;
    flushingRef.current = true;
    const remaining = [...arr];
    for (const item of arr) {
      const { error } = await supabase.from('posts').insert({
        group_id: groupId,
        author_id: user.id,
        author_name: user.name,
        type: item.announce ? 'Announcement' : 'Discussion',
        text: item.text,
      });
      if (error) break; // still failing — keep the rest, retry later
      const idx = remaining.findIndex((x) => x.id === item.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }
    flushingRef.current = false;
    setQueued(remaining);
    await AsyncStorage.setItem(queueKey, JSON.stringify(remaining)).catch(() => {});
    load();
  }, [queueKey, groupId, user, load]);

  // Flush when connectivity returns.
  useEffect(() => {
    if (online) flushQueue();
  }, [online, flushQueue]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (online) flushQueue();
    }, [load, online, flushQueue])
  );

  function stage(items) {
    if (items.length) setPending((p) => [...p, ...items]);
  }

  function removePending(id) {
    setPending((p) => p.filter((x) => x.id !== id));
  }

  function mkId(i) {
    return `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
  }

  // Upload one staged file and return its public URL.
  async function uploadOne({ uri, name, mime, kind }) {
    const safeName = name || `${kind}-${Date.now()}`;
    const ext = safeName.includes('.')
      ? safeName.split('.').pop()
      : (mime && mime.split('/')[1]) || 'bin';
    const path = `${groupId}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    let body;
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      body = await res.blob();
    } else {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      body = decode(base64);
    }

    const { error } = await supabase.storage
      .from('attachments')
      .upload(path, body, { contentType: mime || 'application/octet-stream', upsert: false });
    if (error) throw error;
    const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);
    return pub.publicUrl;
  }

  // Send the typed message and/or any staged attachments. Each attachment is
  // its own post; a typed caption rides along on the first one.
  async function handleSend() {
    const body = text.trim();
    if ((!body && pending.length === 0) || sending) return;

    // Offline: queue text locally (it'll send on reconnect); files still need a
    // connection, so keep them staged and say so.
    if (!online) {
      if (body) {
        saveQueue([
          ...queued,
          { id: mkId(0), text: body, announce: isModerator && announce, queuedAt: Date.now() },
        ]);
        setText('');
        setAnnounce(false);
      }
      if (pending.length > 0) {
        notify({
          title: 'You’re offline',
          message: 'Files send once you’re back online — they’re still attached.',
        });
      } else if (!body) {
        notify({ title: 'You’re offline', message: 'Nothing to queue yet.' });
      }
      return;
    }

    setSending(true);
    try {
      if (pending.length > 0) {
        for (let i = 0; i < pending.length; i++) {
          const att = pending[i];
          const url = await uploadOne(att);
          const { data: inserted, error } = await supabase
            .from('posts')
            .insert({
              group_id: groupId,
              author_id: user.id,
              author_name: user.name,
              type: 'Resource',
              text: i === 0 && body ? body : null,
              attachment_url: url,
              attachment_type: att.kind === 'image' ? 'image' : 'file',
              attachment_name: att.name || null,
              attachment_mime: att.mime || null,
            })
            .select('id')
            .single();
          if (error) throw error;
          // Fire-and-forget: extract the file's text so it's searchable and the
          // assistant can read it. Never blocks sending; ignore failures.
          if (inserted && inserted.id) {
            supabase.functions.invoke('extract', { body: { postId: inserted.id } }).catch(() => {});
          }
        }
      } else {
        const { error } = await supabase.from('posts').insert({
          group_id: groupId,
          author_id: user.id,
          author_name: user.name,
          type: announce ? 'Announcement' : 'Discussion',
          text: body,
        });
        if (error) throw error;
      }
      setText('');
      setAnnounce(false);
      setPending([]);
      load();
    } catch (e) {
      notify({ title: 'Could not send', message: (e && e.message) || 'Upload failed.' });
    } finally {
      setSending(false);
    }
  }

  async function pickImage(fromCamera) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAttachOpen(false);
      notify({
        title: 'Permission needed',
        message: fromCamera
          ? 'Allow camera access to take a photo.'
          : 'Allow photo access to share an image.',
      });
      return;
    }
    // Library allows selecting several at once; the camera takes one shot.
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: true });
    setAttachOpen(false);
    if (result.canceled) return;
    stage(
      result.assets.map((a, i) => ({
        id: mkId(i),
        uri: a.uri,
        name: a.fileName || `photo-${Date.now()}-${i}.jpg`,
        mime: a.mimeType || 'image/jpeg',
        kind: 'image',
      }))
    );
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    setAttachOpen(false);
    if (result.canceled) return;
    stage(
      result.assets.map((a, i) => ({
        id: mkId(i),
        uri: a.uri,
        name: a.name,
        mime: a.mimeType || 'application/octet-stream',
        kind: 'file',
      }))
    );
  }

  async function submitReport() {
    if (!reportPost || reporting) return;
    setReporting(true);
    const { error } = await supabase.from('post_reports').insert({
      post_id: reportPost.id,
      reported_by: user.id,
      reason: reason.trim() || null,
    });
    setReporting(false);
    setReportPost(null);
    setReason('');
    notify(
      error
        ? { title: 'Could not send report', message: error.message }
        : { title: 'Reported', message: 'A group Admin or Captain will review it.' }
    );
  }

  return (
    <Screen>
      {/* Chat header: back · avatar · name/member-count · 3-dot menu */}
      <View style={styles.chatHeader}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.hBack}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Pressable
          style={styles.hCenter}
          onPress={() => navigation.navigate('GroupDetail', { groupId })}
        >
          <Avatar emoji={group ? group.emoji : undefined} name={groupName} size={36} ring={roleTheme(role).ring} />
          <View style={styles.hText}>
            <Text style={styles.hName} numberOfLines={1}>{groupName}</Text>
            <Text style={styles.hSub} numberOfLines={1}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} style={styles.hMenu}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.ink} />
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Search messages"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          <Pressable
            onPress={() => {
              setSearchOpen(false);
              setQuery('');
            }}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}

      {/* Pinned announcement — stays put above the feed instead of scrolling away */}
      {pinned && !searchOpen ? (
        <Pressable
          onPress={() =>
            notify({
              title: `Announcement · ${pinned.author_name || 'Group'}`,
              message: pinned.text || '',
            })
          }
          style={({ pressed }) => [styles.pinned, pressed && styles.pressed]}
        >
          <Ionicons name="megaphone" size={16} color={colors.warning} />
          <View style={styles.pinnedBody}>
            <Text style={styles.pinnedTitle} numberOfLines={1}>
              Announcement · {pinned.author_name || 'Group'}
            </Text>
            <Text style={styles.pinnedText} numberOfLines={1}>
              {pinned.text}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      ) : null}

      {/* Catch me up — AI summary of what was missed (dismissible, non-blocking) */}
      {summarizing ? (
        <View style={styles.catchCard}>
          <ActivityIndicator size="small" color={colors.inkSoft} />
          <Text style={styles.catchSummary}>Catching you up…</Text>
        </View>
      ) : summary ? (
        <View style={styles.catchCard}>
          <Ionicons name="sparkles" size={16} color={colors.inkSoft} style={styles.catchIcon} />
          <View style={styles.catchBody}>
            <Text style={styles.catchTitle}>Catch me up</Text>
            <Text style={styles.catchSummary}>{summary}</Text>
          </View>
          <Pressable
            onPress={() => {
              setSummary(null);
              setCatchUpDismissed(true);
            }}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ) : unread.length > CATCHUP_THRESHOLD && !catchUpDismissed ? (
        <View style={styles.catchButtonRow}>
          <Pressable
            onPress={catchMeUp}
            style={({ pressed }) => [styles.catchButton, pressed && styles.pressed]}
          >
            <Ionicons name="sparkles-outline" size={16} color={colors.onPrimary} />
            <Text style={styles.catchButtonText}>Catch me up · {unread.length} new</Text>
          </Pressable>
          <Pressable
            onPress={() => setCatchUpDismissed(true)}
            hitSlop={8}
            style={styles.catchDismiss}
          >
            <Ionicons name="close" size={16} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <FlatList
          data={listData}
          inverted
          style={styles.flex}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            item.__queued ? (
              <QueuedBubble item={item} />
            ) : (
              <Bubble
                post={item}
                own={item.author_id === user.id}
                onLongPress={() => setMenuPost(item)}
              />
            )
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name={query ? 'search-outline' : 'chatbubbles-outline'}
                size={30}
                color={colors.muted}
              />
              <Text style={styles.emptyText}>
                {query ? 'No messages match your search.' : 'No messages yet — say hello.'}
              </Text>
            </View>
          }
        />

        {/* Input bar — hidden when an Admin has disabled member posting. */}
        {canPost ? (
          <View style={[styles.composer, { paddingBottom: (insets.bottom || spacing.sm) + spacing.sm }]}>
            {/* Staged attachments preview (removable, before sending) */}
            {pending.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.pendingBar}
                contentContainerStyle={styles.pendingContent}
              >
                {pending.map((att) => (
                  <View key={att.id} style={styles.pendingItem}>
                    {att.kind === 'image' ? (
                      <Image source={{ uri: att.uri }} style={styles.pendingThumb} />
                    ) : (
                      <View style={styles.pendingFile}>
                        <Ionicons name="document-text-outline" size={20} color={colors.inkSoft} />
                        <Text style={styles.pendingName} numberOfLines={2}>{att.name}</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => removePending(att.id)}
                      hitSlop={6}
                      style={styles.pendingRemove}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.ink} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.inputRow}>
              <Pressable
                onPress={() => setAttachOpen(true)}
                disabled={sending}
                hitSlop={8}
                style={styles.announceBtn}
              >
                <Ionicons name="add" size={22} color={colors.inkSoft} />
              </Pressable>
              {isModerator && pending.length === 0 ? (
                <Pressable
                  onPress={() => setAnnounce((a) => !a)}
                  hitSlop={8}
                  style={[styles.announceBtn, announce && styles.announceOn]}
                >
                  <Ionicons
                    name="megaphone-outline"
                    size={18}
                    color={announce ? colors.onPrimary : colors.muted}
                  />
                </Pressable>
              ) : null}
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={
                  pending.length > 0
                    ? 'Add a caption…'
                    : announce
                    ? 'Write an announcement…'
                    : 'Message'
                }
                placeholderTextColor={colors.muted}
                style={[styles.input, announce && pending.length === 0 && styles.inputAnnounce]}
                multiline
              />
              <Pressable
                onPress={handleSend}
                disabled={(!text.trim() && pending.length === 0) || sending}
                style={[
                  styles.sendBtn,
                  ((!text.trim() && pending.length === 0) || sending) && styles.sendDisabled,
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.lockedBar, { paddingBottom: (insets.bottom || spacing.sm) + spacing.md }]}>
            <Ionicons name="lock-closed-outline" size={15} color={colors.muted} />
            <Text style={styles.lockedText}>Only admins and captains can post in this group.</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Attachment picker */}
      <Modal
        visible={attachOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAttachOpen(false)}>
          <Pressable style={styles.menu} onPress={() => {}}>
            <Pressable
              onPress={() => pickImage(false)}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <Ionicons name="image-outline" size={20} color={colors.inkSoft} />
              <Text style={styles.menuText}>Photo library</Text>
            </Pressable>
            <Pressable
              onPress={() => pickImage(true)}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <Ionicons name="camera-outline" size={20} color={colors.inkSoft} />
              <Text style={styles.menuText}>Take photo</Text>
            </Pressable>
            <Pressable
              onPress={pickDocument}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <Ionicons name="document-outline" size={20} color={colors.inkSoft} />
              <Text style={styles.menuText}>File</Text>
            </Pressable>
            <Pressable
              onPress={() => setAttachOpen(false)}
              style={({ pressed }) => [styles.menuItem, styles.menuCancel, pressed && styles.pressed]}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 3-dot header menu */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.hMenuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={[styles.hMenuCard, { top: insets.top + 48 }]} onPress={() => {}}>
            <HeaderMenuRow
              icon="information-circle-outline"
              label="Group info"
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate('GroupDetail', { groupId });
              }}
            />
            <HeaderMenuRow
              icon="search-outline"
              label="Search messages"
              onPress={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
            />
            <HeaderMenuRow
              icon="sparkles-outline"
              label="Summarize chat"
              onPress={summarizeChat}
            />
            <HeaderMenuRow
              icon={muted ? 'notifications-off-outline' : 'notifications-outline'}
              label={muted ? 'Unmute notifications' : 'Mute notifications'}
              onPress={toggleMute}
            />
            {isModerator ? (
              <HeaderMenuRow
                icon="flag-outline"
                label="Reported posts"
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate('ReportedPosts', { groupId, groupName });
                }}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Long-press action menu */}
      <Modal
        visible={!!menuPost}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPost(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuPost(null)}>
          <Pressable style={styles.menu} onPress={() => {}}>
            {menuPost && canDelete(menuPost) ? (
              <Pressable
                onPress={() => deleteMessage(menuPost)}
                style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={20} color={colors.accent} />
                <Text style={[styles.menuText, { color: colors.accent }]}>
                  Delete message
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                const p = menuPost;
                setMenuPost(null);
                setReason('');
                setReportPost(p);
              }}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <Ionicons name="flag-outline" size={20} color={colors.inkSoft} />
              <Text style={styles.menuText}>Report message</Text>
            </Pressable>
            <Pressable
              onPress={() => setMenuPost(null)}
              style={({ pressed }) => [styles.menuItem, styles.menuCancel, pressed && styles.pressed]}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Report modal */}
      <Modal
        visible={!!reportPost}
        transparent
        animationType="fade"
        onRequestClose={() => setReportPost(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setReportPost(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetIcon}>
              <Ionicons name="flag-outline" size={22} color={colors.accent} />
            </View>
            <Text style={styles.sheetTitle}>Report this message</Text>
            <Text style={styles.sheetSub}>
              Flag it for the group’s Admin or Captain. Reason optional.
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.muted}
              style={styles.reasonInput}
              multiline
            />
            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => setReportPost(null)}
                style={({ pressed }) => [styles.sheetBtn, styles.sheetCancel, pressed && styles.pressed]}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitReport}
                disabled={reporting}
                style={({ pressed }) => [styles.sheetBtn, styles.sheetReport, pressed && styles.pressed]}
              >
                <Text style={styles.sheetReportText}>{reporting ? 'Sending…' : 'Report'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function HeaderMenuRow({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.hMenuItem, pressed && styles.hMenuItemPressed]}
    >
      <Ionicons name={icon} size={19} color={colors.inkSoft} />
      <Text style={styles.hMenuLabel}>{label}</Text>
    </Pressable>
  );
}

function AttachmentView({ post, own, onLongPress }) {
  const url = post.attachment_url;
  const open = () => Linking.openURL(url).catch(() => {});
  if (post.attachment_type === 'image') {
    return (
      <Pressable onPress={open} onLongPress={onLongPress} delayLongPress={300}>
        <Image source={{ uri: url }} style={styles.attachImage} resizeMode="cover" />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={open}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={styles.fileChip}
    >
      <View style={[styles.fileIcon, own ? styles.fileIconOwn : styles.fileIconOther]}>
        <Ionicons name="document-text-outline" size={20} color={own ? colors.onPrimary : colors.accent} />
      </View>
      <View style={styles.fileMeta}>
        <Text
          style={[styles.fileName, { color: own ? colors.onPrimary : colors.ink }]}
          numberOfLines={1}
        >
          {post.attachment_name || 'File'}
        </Text>
        <Text style={[styles.fileHint, { color: own ? 'rgba(255,255,255,0.7)' : colors.muted }]}>
          Tap to open
        </Text>
      </View>
    </Pressable>
  );
}

function QueuedBubble({ item }) {
  const t = new Date(item.queuedAt || Date.now());
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  return (
    <View style={styles.ownRow}>
      <View style={[styles.ownBubble, styles.queuedBubble]}>
        <Text style={styles.ownText}>{item.text}</Text>
        <View style={styles.queuedFoot}>
          <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.7)" />
          <Text style={styles.queuedText}>queued · {hh}:{mm}</Text>
        </View>
      </View>
    </View>
  );
}

function Bubble({ post, own, onLongPress }) {
  const isAnnouncement = post.type === 'Announcement';
  const amber = roleTheme('Admin');
  const hasAttach = !!post.attachment_url;
  const imageOnly = post.attachment_type === 'image' && !post.text;

  if (post.deleted) {
    return (
      <View style={[styles.deletedRow, own && styles.deletedRowOwn]}>
        <View style={styles.deletedBubble}>
          <Ionicons name="ban-outline" size={13} color={colors.muted} />
          <Text style={styles.deletedText}>This message was deleted</Text>
        </View>
      </View>
    );
  }

  if (isAnnouncement) {
    return (
      <Pressable onLongPress={onLongPress} delayLongPress={300} style={styles.announceRow}>
        <View style={[styles.announceBubble, { borderColor: amber.solid }]}>
          <View style={styles.announceHead}>
            <Ionicons name="megaphone" size={14} color={amber.solid} />
            <Text style={[styles.announceLabel, { color: amber.solid }]}>ANNOUNCEMENT</Text>
            <Text style={styles.announceTime}>{relTime(post.created_at)}</Text>
          </View>
          <Text style={styles.announceText}>{post.text}</Text>
          <Text style={styles.announceAuthor}>— {post.author_name || 'Group member'}</Text>
        </View>
      </Pressable>
    );
  }

  if (own) {
    return (
      <Pressable onLongPress={onLongPress} delayLongPress={300} style={styles.ownRow}>
        <View style={[styles.ownBubble, imageOnly && styles.mediaBubble]}>
          {hasAttach ? <AttachmentView post={post} own onLongPress={onLongPress} /> : null}
          {post.text ? (
            <Text style={[styles.ownText, hasAttach && styles.captionSpacing]}>{post.text}</Text>
          ) : null}
        </View>
        <Text style={styles.ownTime}>{relTime(post.created_at)}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onLongPress={onLongPress} delayLongPress={300} style={styles.otherRow}>
      <Avatar name={post.author_name || 'Member'} size={32} />
      <View style={styles.otherBody}>
        <Text style={styles.otherName}>{post.author_name || 'Group member'}</Text>
        <View style={[styles.otherBubble, imageOnly && styles.mediaBubble]}>
          {hasAttach ? <AttachmentView post={post} onLongPress={onLongPress} /> : null}
          {post.text ? (
            <Text style={[styles.otherText, hasAttach && styles.captionSpacing]}>{post.text}</Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.otherTime}>{relTime(post.created_at)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // chat header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.xs,
  },
  hBack: {
    width: 32,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hText: { flex: 1 },
  hName: { ...type.heading, color: colors.ink },
  hSub: { ...type.caption, color: colors.muted, marginTop: 1 },
  hMenu: {
    width: 32,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { ...type.body, flex: 1, color: colors.ink, padding: 0 },

  // pinned announcement
  pinned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.warningSoft,
  },
  pinnedBody: { flex: 1 },
  pinnedTitle: { ...type.bodyStrong, fontSize: 13, color: colors.ink },
  pinnedText: { ...type.caption, color: colors.muted, marginTop: 1 },

  // catch me up
  catchButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  catchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  catchButtonText: { ...type.bodyStrong, fontSize: 13, color: colors.onPrimary },
  catchDismiss: { padding: 4 },
  catchCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catchIcon: { marginTop: 2 },
  catchBody: { flex: 1 },
  catchTitle: { ...type.label, color: colors.muted, marginBottom: 4 },
  catchSummary: { ...type.body, color: colors.ink, lineHeight: 20, flex: 1 },

  // 3-dot header menu
  hMenuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  hMenuCard: {
    position: 'absolute',
    right: spacing.md,
    width: 232,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  hMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  hMenuItemPressed: { backgroundColor: colors.surfaceAlt },
  hMenuLabel: { ...type.body, color: colors.ink },

  // locked composer (member posting disabled)
  lockedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
  lockedText: { ...type.caption, color: colors.muted },

  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexGrow: 1 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
    transform: [{ scaleY: -1 }], // counter the inverted list
  },
  emptyText: { ...type.body, color: colors.muted },

  // other people's messages (left)
  otherRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.md },
  otherBody: { flex: 1, marginLeft: spacing.sm, marginRight: spacing.sm },
  otherName: { ...type.caption, color: colors.muted, marginBottom: 3, marginLeft: spacing.sm },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: 6,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    maxWidth: '92%',
  },
  otherText: { ...type.body, color: colors.ink, lineHeight: 20 },
  otherTime: { ...type.caption, color: colors.muted, fontSize: 10, marginBottom: 2 },

  // own messages (right)
  ownRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginBottom: spacing.md },
  ownBubble: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: 6,
    borderBottomRightRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    maxWidth: '80%',
  },
  ownText: { ...type.body, color: colors.onPrimary, lineHeight: 20 },
  ownTime: { ...type.caption, color: colors.muted, fontSize: 10, marginLeft: 6, marginBottom: 2 },

  // queued (offline) message
  queuedBubble: { opacity: 0.9 },
  queuedFoot: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, alignSelf: 'flex-end' },
  queuedText: { ...type.caption, fontSize: 10, color: 'rgba(255,255,255,0.7)' },

  // attachments
  mediaBubble: { padding: 3 },
  captionSpacing: { marginTop: spacing.sm },
  attachImage: {
    width: 210,
    height: 210,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 180,
    maxWidth: 240,
  },
  fileIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconOwn: { backgroundColor: 'rgba(255,255,255,0.18)' },
  fileIconOther: { backgroundColor: colors.accentSoft },
  fileMeta: { flex: 1 },
  fileName: { ...type.bodyStrong, fontSize: 14 },
  fileHint: { ...type.caption, fontSize: 11, marginTop: 1 },

  // deleted placeholder
  deletedRow: { alignItems: 'flex-start', marginBottom: spacing.md },
  deletedRowOwn: { alignItems: 'flex-end' },
  deletedBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deletedText: { ...type.caption, color: colors.muted, fontStyle: 'italic' },

  // announcement (full width, highlighted)
  announceRow: { marginBottom: spacing.md },
  announceBubble: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  announceHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  announceLabel: { ...type.monoLabel, fontSize: 10, marginLeft: 5, flex: 1 },
  announceTime: { ...type.monoSmall, color: colors.muted, fontSize: 10 },
  announceText: { ...type.body, color: colors.ink, lineHeight: 21 },
  announceAuthor: { ...type.caption, color: colors.muted, marginTop: spacing.sm },

  // input bar
  composer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },

  // staged attachment previews
  pendingBar: { maxHeight: 92, marginBottom: spacing.sm },
  pendingContent: { gap: spacing.sm, paddingRight: spacing.sm, alignItems: 'center' },
  pendingItem: { width: 72, height: 72 },
  pendingThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  pendingFile: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pendingName: { ...type.caption, fontSize: 9, color: colors.inkSoft, textAlign: 'center' },
  pendingRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
  announceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  announceOn: { backgroundColor: roleTheme('Admin').solid },
  input: {
    ...type.body,
    color: colors.ink,
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    maxHeight: 120,
  },
  inputAnnounce: { borderWidth: 1, borderColor: roleTheme('Admin').solid },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: colors.surfaceAlt },

  // report modal
  pressed: { opacity: 0.8 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
  },
  menuText: { ...type.bodyStrong, color: colors.ink },
  menuCancel: { justifyContent: 'center', marginTop: spacing.xs },
  menuCancelText: { ...type.bodyStrong, color: colors.muted },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center' },
  sheetIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: { ...type.title, fontSize: 19, color: colors.ink },
  sheetSub: { ...type.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.sm, lineHeight: 18 },
  reasonInput: {
    ...type.body,
    color: colors.ink,
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: spacing.lg,
  },
  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, alignSelf: 'stretch' },
  sheetBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  sheetCancel: { backgroundColor: colors.surfaceAlt },
  sheetCancelText: { ...type.bodyStrong, color: colors.inkSoft },
  sheetReport: { backgroundColor: colors.accent },
  sheetReportText: { ...type.bodyStrong, color: colors.onPrimary },
});
