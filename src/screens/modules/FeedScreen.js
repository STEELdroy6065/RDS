import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../../components/Screen';
import Avatar from '../../components/Avatar';
import Header from '../../components/Header';
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
  const { roleForGroup } = useGroups();

  const role = roleForGroup(groupId);
  const isModerator = role === 'Admin' || role === 'Captain';

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [announce, setAnnounce] = useState(false);
  const [sending, setSending] = useState(false);

  // Long-press action menu + report modal
  const [menuPost, setMenuPost] = useState(null);
  const [reportPost, setReportPost] = useState(null);
  const [reason, setReason] = useState('');
  const [reporting, setReporting] = useState(false);

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
    const { data, error } = await supabase
      .from('posts')
      .select('id, author_id, author_name, type, text, deleted, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }); // newest first → bottom of inverted list
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
      <Header
        title={groupName}
        subtitle="Feed"
        onBack={() => navigation.goBack()}
        right={
          isModerator ? (
            <Pressable
              onPress={() => navigation.navigate('ReportedPosts', { groupId, groupName })}
              hitSlop={10}
              style={({ pressed }) => [styles.modBtn, pressed && styles.pressed]}
            >
              <Ionicons name="flag-outline" size={18} color={colors.accent} />
            </Pressable>
          ) : null
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <FlatList
          data={messages}
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
              <Ionicons name="chatbubbles-outline" size={30} color={colors.muted} />
              <Text style={styles.emptyText}>No messages yet — say hello.</Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: (insets.bottom || spacing.sm) + spacing.sm }]}>
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
      </KeyboardAvoidingView>

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

function Bubble({ post, own, onLongPress }) {
  const isAnnouncement = post.type === 'Announcement';
  const amber = roleTheme('Admin');

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
        <View style={styles.ownBubble}>
          <Text style={styles.ownText}>{post.text}</Text>
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
        <View style={styles.otherBubble}>
          <Text style={styles.otherText}>{post.text}</Text>
        </View>
      </View>
      <Text style={styles.otherTime}>{relTime(post.created_at)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
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
