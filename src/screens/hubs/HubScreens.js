import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Avatar from '../../components/Avatar';
import AssistantPanel from '../../components/AssistantPanel';
import SearchResults from '../../components/SearchResults';
import { useStatusBar } from '../../components/useStatusBar';
import { colors, spacing, radius, type, monoFamily } from '../../theme';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { useHomeSignals } from '../../lib/homeSignals';
import { searchAll } from '../../lib/search';
import { fetchLastMessages, fetchRecordsForGroups, aggregateRecords } from '../../lib/hubs';

const EMPTY_RESULTS = { groups: [], messages: [], files: [], votes: [], people: [] };

const STATUS_COLOR = { P: colors.success, L: colors.warning, A: colors.accent, E: colors.inkSoft };

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
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Kicker({ kicker, title }) {
  return (
    <>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
    </>
  );
}

function EmptyGroups({ text }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="albums-outline" size={30} color={colors.muted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

/* --------------------------------- CHAT ---------------------------------- */

export function ChatHubScreen({ navigation }) {
  useStatusBar('dark');
  const { user } = useSession();
  const { groups } = useGroups();
  const { statusByGroup } = useHomeSignals(groups);
  const [last, setLast] = useState({});
  const [loading, setLoading] = useState(false);

  // Search + AI assistant (moved here from Home).
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const q = query.trim();
  const searching = q.length > 0;

  const load = useCallback(async () => {
    setLoading(true);
    setLast(await fetchLastMessages(groups.map((g) => g.id)));
    setLoading(false);
  }, [groups]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Debounced cross-entity search, scoped by RLS to the user's groups.
  useEffect(() => {
    if (!q) {
      setResults(EMPTY_RESULTS);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchAll(q, { groups, user });
      if (!cancelled) setResults(r);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, groups, user]);

  // Order by most recent message; groups with none fall to the bottom.
  const ordered = useMemo(() => {
    return [...groups].sort((a, b) => {
      const ta = last[a.id] ? new Date(last[a.id].created_at).getTime() : 0;
      const tb = last[b.id] ? new Date(last[b.id].created_at).getTime() : 0;
      return tb - ta;
    });
  }, [groups, last]);

  function open(g) {
    navigation.navigate(g.role === 'Guardian' ? 'GuardianGroup' : 'Feed', { groupId: g.id, groupName: g.name });
  }

  function preview(g) {
    const m = last[g.id];
    if (!m) return 'No messages yet';
    const who = m.author_name ? `${m.author_name.split(' ')[0]}: ` : '';
    const body = m.text || (m.type === 'Resource' ? 'Shared a file' : m.type === 'Announcement' ? 'Announcement' : '…');
    return `${who}${body}`;
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        <Kicker kicker="CHATS" title="Messages" />

        {/* Search + AI */}
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search groups, messages, files..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => setAssistantOpen(true)} hitSlop={8} style={styles.aiBtn}>
            <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>

        {searching ? (
          <SearchResults query={q} results={results} navigation={navigation} onOpenGroup={open} />
        ) : groups.length === 0 ? (
          <EmptyGroups text="Join a group to start chatting." />
        ) : (
          ordered.map((g) => {
            const unread = (statusByGroup[g.id] && statusByGroup[g.id].unread) || 0;
            const m = last[g.id];
            return (
              <Pressable key={g.id} onPress={() => open(g)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <Avatar emoji={g.emoji} name={g.name} size={48} />
                <View style={styles.body}>
                  <View style={styles.lineTop}>
                    <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>{g.name}</Text>
                    {m ? <Text style={styles.time}>{relTime(m.created_at)}</Text> : null}
                  </View>
                  <View style={styles.lineBottom}>
                    <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
                      {preview(g)}
                    </Text>
                    {unread > 0 ? (
                      <View style={styles.unreadPill}>
                        <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <AssistantPanel visible={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </Screen>
  );
}

/* -------------------------------- ATTEND --------------------------------- */

export function AttendHubScreen({ navigation }) {
  useStatusBar('dark');
  const { user } = useSession();
  const { groups } = useGroups();
  const { statusByGroup } = useHomeSignals(groups);
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRecords(await fetchRecordsForGroups(groups, user.id));
    setLoading(false);
  }, [groups, user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const agg = useMemo(() => aggregateRecords(records), [records]);
  const dueCount = groups.filter((g) => statusByGroup[g.id] && statusByGroup[g.id].attendanceDue).length;

  function open(g) {
    navigation.navigate(g.role === 'Guardian' ? 'GuardianGroup' : 'Attendance', { groupId: g.id, groupName: g.name });
  }

  function rollChip(g) {
    const s = statusByGroup[g.id];
    if (!s) return { text: '—', bg: colors.surfaceAlt, fg: colors.muted };
    if (s.attendanceDue) return { text: 'DUE', bg: colors.warningSoft, fg: colors.warning };
    if (!s.attendanceUnresolved) return { text: 'MARKED', bg: colors.successSoft, fg: colors.success };
    return { text: 'NO ROLL', bg: colors.surfaceAlt, fg: colors.muted };
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        <Kicker kicker="ATTENDANCE" title="Your attendance" />

        {groups.length === 0 ? (
          <EmptyGroups text="Join a group to see its attendance." />
        ) : (
          <>
            {/* Aggregate strip */}
            <View style={styles.summary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{agg.rate == null ? '—' : `${agg.rate}%`}</Text>
                <Text style={styles.summaryLabel}>overall</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{agg.sessions}</Text>
                <Text style={styles.summaryLabel}>sessions</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, dueCount > 0 && { color: colors.warning }]}>{dueCount}</Text>
                <Text style={styles.summaryLabel}>due today</Text>
              </View>
            </View>

            {groups.map((g) => {
              const r = records[g.id];
              const chip = rollChip(g);
              return (
                <Pressable key={g.id} onPress={() => open(g)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <Avatar emoji={g.emoji} name={g.name} size={46} />
                  <View style={styles.body}>
                    <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {r && r.total > 0 ? `${r.rate == null ? '—' : r.rate + '%'} · ${r.total} session${r.total === 1 ? '' : 's'}` : 'No record yet'}
                    </Text>
                  </View>
                  <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                    <Text style={[styles.chipText, { color: chip.fg }]}>{chip.text}</Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* -------------------------------- RECORD --------------------------------- */

export function RecordHubScreen({ navigation }) {
  useStatusBar('dark');
  const { user } = useSession();
  const { groups } = useGroups();
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRecords(await fetchRecordsForGroups(groups, user.id));
    setLoading(false);
  }, [groups, user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const agg = useMemo(() => aggregateRecords(records), [records]);

  function open(g) {
    if (g.role === 'Guardian') {
      navigation.navigate('GuardianGroup', { groupId: g.id, groupName: g.name });
      return;
    }
    navigation.navigate('RecordDetail', { groupId: g.id, groupName: g.name, studentId: user.id, studentName: user.name });
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        <Kicker kicker="PARTICIPATION" title="Your record" />

        {groups.length === 0 ? (
          <EmptyGroups text="Your record builds as you attend." />
        ) : (
          <>
            {/* Aggregate hero */}
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <Text style={styles.heroRate}>
                  {agg.rate == null ? '—' : agg.rate}
                  {agg.rate == null ? '' : <Text style={styles.heroPct}>%</Text>}
                </Text>
                <Text style={styles.heroLabel}>attendance{'\n'}across {agg.sessions} session{agg.sessions === 1 ? '' : 's'}</Text>
              </View>
              <View style={styles.heroMeta}>
                <Ionicons name="flame" size={14} color={agg.bestStreak > 0 ? '#D69A3C' : 'rgba(255,255,255,0.5)'} />
                <Text style={styles.heroMetaText}>Best streak {agg.bestStreak} day{agg.bestStreak === 1 ? '' : 's'}</Text>
              </View>
            </View>

            {groups.map((g) => {
              const r = records[g.id];
              return (
                <Pressable key={g.id} onPress={() => open(g)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <Avatar emoji={g.emoji} name={g.name} size={46} />
                  <View style={styles.body}>
                    <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
                    {r && r.total > 0 ? (
                      <View style={styles.recTally}>
                        {['P', 'L', 'A', 'E'].map((s) => (
                          <View key={s} style={styles.recChip}>
                            <View style={[styles.recDot, { backgroundColor: STATUS_COLOR[s] }]} />
                            <Text style={styles.recChipText}>{s} {r.tally[s]}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.sub}>No record yet</Text>
                    )}
                  </View>
                  <Text style={styles.recRate}>{r && r.rate != null ? `${r.rate}%` : '—'}</Text>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  kicker: { ...type.monoLabel, fontSize: 11, letterSpacing: 1.2, color: colors.muted },
  title: { ...type.display, fontSize: 28, color: colors.ink, marginTop: 6, marginBottom: spacing.lg },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...type.body, color: colors.muted, textAlign: 'center' },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  searchInput: { ...type.body, flex: 1, color: colors.ink, padding: 0 },
  aiBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  body: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  name: { ...type.heading, color: colors.ink },
  nameUnread: { color: colors.ink },
  sub: { ...type.caption, color: colors.muted, marginTop: 3 },

  // chat
  lineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontFamily: monoFamily, fontSize: 11, color: colors.muted, marginLeft: spacing.sm },
  lineBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  preview: { ...type.caption, color: colors.muted, flex: 1 },
  previewUnread: { color: colors.ink, fontWeight: '600' },
  unreadPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  unreadText: { fontFamily: monoFamily, fontSize: 11, fontWeight: '700', color: colors.onPrimary },

  // attend
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontFamily: monoFamily, fontSize: 22, fontWeight: '600', color: colors.ink, letterSpacing: -0.5 },
  summaryLabel: { ...type.caption, color: colors.muted, marginTop: 3 },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.divider },
  chip: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  chipText: { ...type.monoLabel, fontSize: 10 },

  // record
  hero: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  heroRate: { fontFamily: monoFamily, fontSize: 46, fontWeight: '600', color: colors.onPrimary, letterSpacing: -2, lineHeight: 46 },
  heroPct: { fontSize: 22, color: 'rgba(255,255,255,0.7)' },
  heroLabel: { ...type.caption, color: 'rgba(255,255,255,0.7)', lineHeight: 18, paddingBottom: 4 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg },
  heroMetaText: { ...type.caption, color: 'rgba(255,255,255,0.8)' },
  recTally: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  recChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recDot: { width: 6, height: 6, borderRadius: 3 },
  recChipText: { fontFamily: monoFamily, fontSize: 11, fontWeight: '600', color: colors.inkSoft },
  recRate: { fontFamily: monoFamily, fontSize: 18, fontWeight: '600', color: colors.ink },
});
