import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import Avatar from '../../components/Avatar';
import { colors, spacing, radius, type, monoFamily } from '../../theme';
import { fetchMemberTermRecord, STATUS_ORDER } from '../../state/attendance';
import { fetchMyGuardianLinks, fetchAnnouncements } from '../../lib/guardian';

const STATUS_COLOR = {
  P: colors.success,
  L: colors.warning,
  A: colors.accent,
  E: colors.inkSoft,
};

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

// The read-only view a Guardian sees for a group: their linked student's
// attendance, the group's announcements, and a clear privacy note. Guardians
// are routed here instead of the Feed; RLS backs this up server-side.
export default function GuardianGroupScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const [links, setLinks] = useState([]);
  const [records, setRecords] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ls, anns] = await Promise.all([
      fetchMyGuardianLinks(groupId),
      fetchAnnouncements(groupId),
    ]);
    setLinks(ls);
    setAnnouncements(anns);
    const recs = {};
    await Promise.all(
      ls.map(async (l) => {
        recs[l.student_id] = await fetchMemberTermRecord(groupId, l.student_id);
      })
    );
    setRecords(recs);
    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const studentNames = links.map((l) => l.student_name || 'your student').join(', ');

  return (
    <Screen>
      <Header title={groupName} subtitle="Guardian view" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        {links.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={30} color={colors.muted} />
            <Text style={styles.emptyText}>
              {loading ? 'Loading…' : 'No student is linked to you in this group yet.'}
            </Text>
            <Text style={styles.emptySub}>
              An Admin links you to your student. Once linked, their attendance
              appears here.
            </Text>
          </View>
        ) : (
          <>
            {links.map((l) => (
              <StudentCard
                key={l.id}
                link={l}
                record={records[l.student_id]}
                onOpen={() =>
                  navigation.navigate('RecordDetail', {
                    groupId,
                    groupName,
                    studentId: l.student_id,
                    studentName: l.student_name,
                  })
                }
              />
            ))}

            <Text style={styles.section}>ANNOUNCEMENTS</Text>
            {announcements.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.annEmpty}>No announcements yet.</Text>
              </View>
            ) : (
              announcements.map((a) => (
                <View key={a.id} style={styles.annRow}>
                  <View style={styles.annIcon}>
                    <Ionicons name="megaphone-outline" size={16} color={colors.warning} />
                  </View>
                  <View style={styles.annBody}>
                    <Text style={styles.annText}>{a.text}</Text>
                    <Text style={styles.annMeta}>
                      {(a.author_name || 'Group') + ' · ' + relTime(a.created_at)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Privacy note — what a guardian can and can't see */}
        <View style={styles.privacy}>
          <Ionicons name="lock-closed-outline" size={15} color={colors.muted} />
          <Text style={styles.privacyText}>
            {links.length
              ? `You see attendance and announcements for ${studentNames}. You cannot see class chat, votes, or other students.`
              : 'As a Guardian you see attendance and announcements for your linked student only — not class chat, votes, or other students.'}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function StudentCard({ link, record, onOpen }) {
  const r = record || { tally: { P: 0, L: 0, A: 0, E: 0 }, total: 0, rate: null, streak: 0 };
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.studentHead}>
        <Avatar name={link.student_name || 'Student'} size={40} />
        <View style={styles.studentWho}>
          <Text style={styles.studentName}>{link.student_name || 'Your student'}</Text>
          <Text style={styles.studentSub}>{r.total} {r.total === 1 ? 'day' : 'days'} recorded</Text>
        </View>
      </View>

      <View style={styles.termTop}>
        <View>
          <Text style={styles.termRateValue}>
            {r.rate == null ? '—' : `${r.rate}`}
            {r.rate == null ? '' : <Text style={styles.termRatePct}>%</Text>}
          </Text>
          <Text style={styles.termRateLabel}>attendance</Text>
        </View>
        <View style={styles.termStreak}>
          <Ionicons name="flame" size={16} color={r.streak > 0 ? colors.warning : colors.muted} />
          <Text style={styles.termStreakValue}>{r.streak}</Text>
          <Text style={styles.termStreakLabel}>day{r.streak === 1 ? '' : 's'} in a row</Text>
        </View>
      </View>

      <View style={styles.termTally}>
        {STATUS_ORDER.map((s) => (
          <View key={s} style={styles.termChip}>
            <View style={[styles.termDot, { backgroundColor: STATUS_COLOR[s] }]} />
            <Text style={styles.termChipText}>{s} {r.tally[s]}</Text>
          </View>
        ))}
      </View>

      <View style={styles.studentCta}>
        <Text style={styles.studentCtaText}>See full record</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.ink} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...type.body, color: colors.ink, textAlign: 'center' },
  emptySub: { ...type.caption, color: colors.muted, textAlign: 'center', lineHeight: 18 },

  section: {
    ...type.monoLabel,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  studentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  studentWho: { flex: 1 },
  studentName: { ...type.heading, color: colors.ink },
  studentSub: { ...type.caption, color: colors.muted, marginTop: 1 },

  termTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  termRateValue: { fontFamily: monoFamily, fontSize: 38, fontWeight: '600', color: colors.ink, letterSpacing: -1 },
  termRatePct: { fontSize: 20, color: colors.muted },
  termRateLabel: { ...type.monoLabel, fontSize: 10, color: colors.muted, marginTop: 2 },
  termStreak: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  termStreakValue: { fontFamily: monoFamily, fontSize: 18, fontWeight: '600', color: colors.ink },
  termStreakLabel: { ...type.caption, color: colors.muted },
  termTally: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  termChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  termDot: { width: 7, height: 7, borderRadius: 4 },
  termChipText: { fontFamily: monoFamily, fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  studentCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  studentCtaText: { ...type.bodyStrong, fontSize: 14, color: colors.ink },

  annRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  annIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  annBody: { flex: 1 },
  annText: { ...type.body, color: colors.ink, lineHeight: 20 },
  annMeta: { ...type.caption, color: colors.muted, marginTop: 3 },
  annEmpty: { ...type.caption, color: colors.muted },

  privacy: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  privacyText: { ...type.caption, color: colors.inkSoft, flex: 1, lineHeight: 18 },
});
