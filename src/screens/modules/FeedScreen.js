import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
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
import { confirm, notify } from '../../lib/confirm';

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
  const [uploading, setUploading] = useState(false);

  // Chat header controls
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [muted, setMuted] = useState(false);

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

  // Filter the feed when searching (skips deleted placeholders).
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => !m.deleted && (m.text || '').toLowerCase().includes(q));
  }, [messages, query]);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await supabase.from('posts').insert({
      group_id: groupId,
      author_id: user.id,
      author_name: user.name,
      type: announce ? 'Announcement' : 'Discussion',
      text: body,
    });
    setSending(false);
    if (error) {
      notify({ title: 'Could not send', message: error.message });
      return;
    }
    setText('');
    setAnnounce(false);
    load();
  }

  // Read a local file into a body the storage client accepts on each platform,
  // upload it to the public bucket, and post it as a message.
  async function uploadAndSend({ uri, name, mime, kind }) {
    setAttachOpen(false);
    setUploading(true);
    try {
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

      const { error: upErr } = await supabase.storage
        .from('attachments')
        .upload(path, body, { contentType: mime || 'application/octet-stream', upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);
      const { error: insErr } = await supabase.from('posts').insert({
        group_id: groupId,
        author_id: user.id,
        author_name: user.name,
        type: 'Resource',
        text: null,
        attachment_url: pub.publicUrl,
        attachment_type: kind === 'image' ? 'image' : 'file',
        attachment_name: name || null,
        attachment_mime: mime || null,
      });
      if (insErr) throw insErr;
      load();
    } catch (e) {
      notify({ title: 'Could not send', message: (e && e.message) || 'Upload failed.' });
    } finally {
      setUploading(false);
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
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled) {
      setAttachOpen(false);
      return;
    }
    const asset = result.assets[0];
    uploadAndSend({
      uri: asset.uri,
      name: asset.fileName || `photo-${Date.now()}.jpg`,
      mime: asset.mimeType || 'image/jpeg',
      kind: 'image',
    });
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) {
      setAttachOpen(false);
      return;
    }
    const asset = result.assets[0];
    uploadAndSend({
      uri: asset.uri,
      name: asset.name,
      mime: asset.mimeType || 'application/octet-stream',
      kind: 'file',
    });
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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <FlatList
          data={shown}
          inverted
          style={styles.flex}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Bubble
              post={item}
              own={item.author_id === user.id}
              onLongPress={() => setMenuPost(item)}
            />
          )}
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
          <View style={[styles.inputBar, { paddingBottom: (insets.bottom || spacing.sm) + spacing.sm }]}>
            <Pressable
              onPress={() => setAttachOpen(true)}
              disabled={uploading}
              hitSlop={8}
              style={styles.announceBtn}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Ionicons name="add" size={22} color={colors.inkSoft} />
              )}
            </Pressable>
            {isModerator ? (
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
              placeholder={announce ? 'Write an announcement…' : 'Message'}
              placeholderTextColor={colors.muted}
              style={[styles.input, announce && styles.inputAnnounce]}
              multiline
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || sending}
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendDisabled]}
            >
              <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
            </Pressable>
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
        <Ionicons name="document-text-outline" size={20} color={own ? colors.onPrimary : colors.inkSoft} />
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
  fileIconOther: { backgroundColor: colors.surface },
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
  announceLabel: { ...type.label, fontSize: 10, marginLeft: 5, flex: 1 },
  announceTime: { ...type.caption, color: colors.muted, fontSize: 10 },
  announceText: { ...type.body, color: colors.ink, lineHeight: 21 },
  announceAuthor: { ...type.caption, color: colors.muted, marginTop: spacing.sm },

  // input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
    gap: spacing.sm,
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
