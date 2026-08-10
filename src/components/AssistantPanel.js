import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, type } from '../theme';
import { supabase } from '../lib/supabase';
import { useSession } from '../state/session';
import { useGroups } from '../state/groups';

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function relDay(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3600000));
  if (s < 1) return 'recent';
  if (s < 24) return `${s}h ago`;
  return `${Math.floor(s / 24)}d ago`;
}

// Pull together the user's real data as a compact context blob for the AI.
async function buildContext(groups) {
  const groupIds = groups.map((g) => g.id);
  if (groupIds.length === 0) return { text: 'The user is not in any groups yet.', mostActive: null };

  const nameById = {};
  groups.forEach((g) => (nameById[g.id] = g.name));
  const today = todayStr();

  const safe = async (p) => {
    try {
      const { data } = await p;
      return data || [];
    } catch {
      return [];
    }
  };

  const [votes, att, posts] = await Promise.all([
    safe(
      supabase
        .from('votes')
        .select('group_id, question, status')
        .in('group_id', groupIds)
        .eq('status', 'open')
    ),
    safe(
      supabase
        .from('attendance_records')
        .select('group_id, status, present_count, total_count')
        .in('group_id', groupIds)
        .eq('date', today)
    ),
    safe(
      supabase
        .from('posts')
        .select('group_id, author_name, type, text, attachment_type, attachment_name, created_at, deleted')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(40)
    ),
  ]);

  const livePosts = posts.filter((p) => !p.deleted);

  // Most active group by recent post count.
  const tally = {};
  livePosts.forEach((p) => (tally[p.group_id] = (tally[p.group_id] || 0) + 1));
  let mostActiveId = groupIds[0];
  let best = -1;
  Object.entries(tally).forEach(([gid, n]) => {
    if (n > best) {
      best = n;
      mostActiveId = gid;
    }
  });
  const mostActive = nameById[mostActiveId] || (groups[0] && groups[0].name) || null;

  const lines = [];
  lines.push(`Groups (${groups.length}):`);
  groups.forEach((g) =>
    lines.push(`- ${g.name} — your role: ${g.role}, ${g.members} member(s)`)
  );

  lines.push('', 'Open votes:');
  if (votes.length === 0) lines.push('- none');
  else votes.forEach((v) => lines.push(`- ${nameById[v.group_id] || 'Group'}: "${v.question}"`));

  lines.push('', `Attendance today (${today}):`);
  groups.forEach((g) => {
    const rec = att.find((a) => a.group_id === g.id);
    if (!rec) lines.push(`- ${g.name}: not marked yet`);
    else if (rec.status === 'submitted')
      lines.push(
        `- ${g.name}: marked${
          rec.present_count != null ? ` (${rec.present_count}/${rec.total_count} present)` : ''
        }`
      );
    else lines.push(`- ${g.name}: ${rec.status.replace(/_/g, ' ')}`);
  });

  lines.push('', 'Recent messages (newest first):');
  if (livePosts.length === 0) lines.push('- none');
  else
    livePosts.slice(0, 25).forEach((p) => {
      const text = (p.text || '').trim();
      const attach =
        p.attachment_type === 'image'
          ? `[image${p.attachment_name ? `: ${p.attachment_name}` : ''}]`
          : p.attachment_type
          ? `[file${p.attachment_name ? `: ${p.attachment_name}` : ''}]`
          : '';
      const body = [text, attach].filter(Boolean).join(' ');
      lines.push(
        `- ${nameById[p.group_id] || 'Group'} · ${p.author_name || 'Member'}${
          p.type === 'Announcement' ? ' (ANNOUNCEMENT)' : ''
        } [${relDay(p.created_at)}]: ${body}`
      );
    });

  return { text: lines.join('\n'), mostActive };
}

export default function AssistantPanel({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { groups } = useGroups();

  const [conversation, setConversation] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ctx, setCtx] = useState(null); // { text, mostActive }
  const scrollRef = useRef(null);

  // Reset the conversation only when the panel opens — NOT when `groups`
  // happens to refresh mid-chat (that would wipe the history we need to send
  // for follow-ups to make sense).
  useEffect(() => {
    if (visible) {
      setConversation([]);
      setInput('');
      setCtx(null);
    }
  }, [visible]);

  // Build (and refresh) the data context while open, without touching the
  // conversation.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    buildContext(groups).then((c) => {
      if (active) setCtx(c);
    });
    return () => {
      active = false;
    };
  }, [visible, groups]);

  const mostActive = (ctx && ctx.mostActive) || (groups[0] && groups[0].name) || 'your group';
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
      // Make sure context is ready (panel may have just opened).
      let context = ctx;
      if (!context) {
        context = await buildContext(groups);
        setCtx(context);
      }
      // Send the real conversation for follow-up context, minus any error
      // placeholders (those aren't genuine assistant turns).
      const history = next
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('assistant', {
        body: { messages: history, context: context.text, userName: user && user.name },
      });
      if (error) {
        // supabase-js hides the function's real error behind a generic
        // "non-2xx" message — the body is on error.context (a Response).
        let detail = (error && error.message) || 'request failed';
        try {
          if (error && error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            if (body && body.error) detail = body.error;
          }
        } catch {
          /* keep the generic detail */
        }
        throw new Error(detail);
      }
      if (data && data.error) throw new Error(data.error);
      const reply = data && data.reply;
      if (!reply) throw new Error('The assistant returned an empty reply.');
      setConversation((c) => [...c, { role: 'assistant', content: reply }]);
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
                    <Text
                      selectable
                      style={m.role === 'user' ? styles.bubbleUserText : styles.bubbleAIText}
                    >
                      {m.content}
                    </Text>
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
