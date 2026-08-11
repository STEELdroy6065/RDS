import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Image,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, type } from '../theme';
import { supabase } from '../lib/supabase';
import { useSession } from '../state/session';
import { useGroups } from '../state/groups';

// The assistant fetches its own data via server-side query tools now, so the
// client only sends a lightweight picture: the group list, and the per-group
// "last opened" timestamps (used for unread counts).
async function gatherLastSeen(groups) {
  const map = {};
  await Promise.all(
    groups.map(async (g) => {
      try {
        const v = await AsyncStorage.getItem(`lastSeen:${g.id}`);
        if (v) map[g.id] = v;
      } catch {
        /* ignore */
      }
    })
  );
  return map;
}


// Renders a file/image the assistant retrieved — the same file in its original
// group (no copy), tappable to open/download like in Feed.
function AssistantAttachment({ att }) {
  const open = () => att.url && Linking.openURL(att.url).catch(() => {});
  if (att.type === 'image') {
    return (
      <Pressable onPress={open} style={styles.attachImageWrap}>
        <Image source={{ uri: att.url }} style={styles.attachImage} resizeMode="cover" />
      </Pressable>
    );
  }
  return (
    <Pressable onPress={open} style={styles.fileCard}>
      <View style={styles.fileIcon}>
        <Ionicons name="document-text-outline" size={20} color={colors.inkSoft} />
      </View>
      <View style={styles.fileMeta}>
        <Text style={styles.fileName} numberOfLines={1}>{att.name || 'File'}</Text>
        <Text style={styles.fileHint}>Tap to open</Text>
      </View>
    </Pressable>
  );
}

export default function AssistantPanel({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { groups } = useGroups();

  const [conversation, setConversation] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Reset the conversation only when the panel opens — NOT when `groups`
  // happens to refresh mid-chat (that would wipe the history we need to send
  // for follow-ups to make sense).
  useEffect(() => {
    if (visible) {
      setConversation([]);
      setInput('');
    }
  }, [visible]);

  const mostActive =
    [...groups].sort((a, b) => (b.members || 0) - (a.members || 0))[0]?.name ||
    (groups[0] && groups[0].name) ||
    'your group';
  const suggestions = [
    "What's happening in my groups today?",
    'Draft an announcement',
    `Catch me up on ${mostActive}`,
  ];

  async function send(textArg) {
    const q = (textArg != null ? textArg : input).trim();
    if (!q || loading) return;
    const next = [...conversation, { role: 'user', content: q }];
    setConversation(next);
    setInput('');
    setLoading(true);
    try {
      // Lightweight state for the server tools: the group list + per-group
      // "last opened" times (for unread). The assistant queries everything
      // else itself.
      const lastSeen = await gatherLastSeen(groups);
      const groupsPayload = groups.map((g) => ({
        id: g.id,
        name: g.name,
        role: g.role,
        members: g.members,
      }));
      // Send the real conversation for follow-up context, minus any error
      // placeholders (those aren't genuine assistant turns).
      const history = next
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('assistant', {
        body: {
          messages: history,
          userName: user && user.name,
          groups: groupsPayload,
          lastSeen,
        },
      });
      if (error) {
        // supabase-js hides the function's real error behind a generic
        // "non-2xx" message — the friendly message is on error.context (a
        // Response). Fall back to a friendly line, never the raw/technical one.
        let detail = '';
        try {
          if (error && error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            if (body && body.error) detail = body.error;
          }
        } catch {
          /* ignore — use the friendly fallback below */
        }
        throw new Error(detail || 'The assistant is unavailable right now — please try again in a moment.');
      }
      if (data && data.error) throw new Error(data.error);
      const reply = data && data.reply;
      if (!reply) throw new Error('The assistant returned an empty reply.');
      setConversation((c) => [
        ...c,
        { role: 'assistant', content: reply, attachments: (data && data.attachments) || [] },
      ]);
    } catch (e) {
      const msg = (e && e.message) || 'Something went wrong.';
      setConversation((c) => [
        ...c,
        { role: 'assistant', content: `⚠️ ${msg}`, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const empty = conversation.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheet, { paddingBottom: (insets.bottom || spacing.sm) + spacing.sm }]}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={styles.headerTitle}>Assistant</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current && scrollRef.current.scrollToEnd({ animated: true })}
          >
            {empty ? (
              <View style={styles.intro}>
                <Text style={styles.heading}>How can I help you today?</Text>
                <Text style={styles.subheading}>
                  Ask about your groups, votes and attendance, or get help drafting a message.
                </Text>
                <View style={styles.chips}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => send(s)}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    >
                      <Ionicons name="sparkles-outline" size={13} color={colors.inkSoft} />
                      <Text style={styles.chipText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              conversation.map((m, i) => (
                <View
                  key={i}
                  style={[styles.msgRow, m.role === 'user' ? styles.msgRowUser : styles.msgRowAI]}
                >
                  <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
                    {m.content ? (
                      <Text
                        selectable
                        style={m.role === 'user' ? styles.bubbleUserText : styles.bubbleAIText}
                      >
                        {m.content}
                      </Text>
                    ) : null}
                    {m.attachments && m.attachments.length ? (
                      <View style={styles.attachWrap}>
                        {m.attachments.map((a, j) => (
                          <AssistantAttachment key={`${a.url}-${j}`} att={a} />
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {loading ? (
              <View style={[styles.msgRow, styles.msgRowAI]}>
                <View style={[styles.bubble, styles.bubbleAI]}>
                  <ActivityIndicator size="small" color={colors.inkSoft} />
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask anything…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
              onSubmitEditing={() => send()}
            />
            <Pressable
              onPress={() => send()}
              disabled={!input.trim() || loading}
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendDisabled]}
            >
              <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
            </Pressable>
          </View>
          <Text style={styles.costNote}>
            Uses the same AI as “Catch me up” — a small per-use cost, separate from Supabase’s free tier.
          </Text>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    height: '86%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { ...type.heading, color: colors.ink },

  body: { flex: 1 },
  bodyContent: { paddingVertical: spacing.lg },
  intro: { paddingTop: spacing.sm },
  heading: { ...type.title, color: colors.ink, marginTop: spacing.lg },
  subheading: { ...type.caption, color: colors.muted, marginTop: spacing.sm, lineHeight: 18 },
  chips: { marginTop: spacing.xl, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chipText: { ...type.body, color: colors.ink, flex: 1 },
  pressed: { opacity: 0.7 },

  msgRow: { marginBottom: spacing.md, flexDirection: 'row' },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAI: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '88%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bubbleUser: { backgroundColor: colors.primary, borderTopRightRadius: 6 },
  bubbleAI: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 6,
  },
  bubbleUserText: { ...type.body, color: colors.onPrimary, lineHeight: 21 },
  bubbleAIText: { ...type.body, color: colors.ink, lineHeight: 21 },

  // assistant attachments
  attachWrap: { marginTop: spacing.sm, gap: spacing.sm },
  attachImageWrap: {
    width: 180,
    height: 180,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachImage: { width: '100%', height: '100%' },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    minWidth: 180,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: { flex: 1 },
  fileName: { ...type.bodyStrong, fontSize: 14, color: colors.ink },
  fileHint: { ...type.caption, fontSize: 11, color: colors.muted, marginTop: 1 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  input: {
    ...type.body,
    flex: 1,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: colors.surfaceAlt },
  costNote: { ...type.caption, fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
});
