import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Header from '../../components/Header';
import { colors, spacing, radius, type, shadow } from '../../theme';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import {
  useAttendance,
  canMarkAttendance,
  receivesCascade,
  leadName,
} from '../../state/attendance';

const KIND_META = {
  marked: { icon: 'checkmark-done', bg: colors.successSoft, fg: colors.success },
  'self-study': { icon: 'book', bg: colors.primarySoft, fg: colors.primary },
  escalated: { icon: 'arrow-up-circle', bg: colors.accentSoft, fg: colors.accent },
};

export default function AttendanceScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useSession();
  const { roleForGroup, membersForGroup } = useGroups();
  const { historyFor, pendingFor, simulateMissed, resolveMissed } = useAttendance();

  const role = roleForGroup(groupId);
  const members = membersForGroup(groupId);
  const isAdmin = canMarkAttendance(role);
  const isCaptain = receivesCascade(role);
  const pending = pendingFor(groupId);
  const history = historyFor(groupId);

  return (
    <Screen>
      <Header title="Attendance" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Captain-facing missed check-in cascade */}
        {pending && isCaptain ? (
          <View style={styles.cascade}>
            <View style={styles.cascadeHead}>
              <View style={styles.cascadeIcon}>
                <Ionicons name="alert" size={20} color={colors.onPrimary} />
              </View>
              <View style={styles.cascadeHeadBody}>
                <Text style={styles.cascadeTag}>MISSED CHECK-IN</Text>
                <Text style={styles.cascadeTitle}>
                  {pending.teacherName} hasn’t checked in — {groupName}
                </Text>
              </View>
            </View>
            <Text style={styles.cascadeSub}>
              As Captain, you can keep the group moving:
            </Text>
            <View style={styles.cascadeActions}>
              <Pressable
                onPress={() => resolveMissed(groupId, 'self-study', user.name)}
                style={({ pressed }) => [styles.cascadeBtn, styles.cascadeBtnPrimary, pressed && styles.pressed]}
              >
                <Ionicons name="book" size={16} color={colors.onPrimary} />
                <Text style={styles.cascadeBtnPrimaryText}>Start self-study</Text>
              </Pressable>
              <Pressable
                onPress={() => resolveMissed(groupId, 'escalated', user.name)}
                style={({ pressed }) => [styles.cascadeBtn, styles.cascadeBtnGhost, pressed && styles.pressed]}
              >
                <Ionicons name="arrow-up-circle" size={16} color={colors.accent} />
                <Text style={styles.cascadeBtnGhostText}>Escalate to Admin</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Non-captain feedback that a simulated miss was routed to the Captain */}
        {pending && !isCaptain ? (
          <View style={styles.infoNote}>
            <Ionicons name="notifications" size={16} color={colors.primary} />
            <Text style={styles.infoNoteText}>
              A missed check-in was simulated — the group’s Captain has been
              alerted to respond.
            </Text>
          </View>
        ) : null}

        {/* Mark attendance — Admin/Teacher only */}
        {isAdmin ? (
          <Pressable
            onPress={() =>
              navigation.navigate('MarkAttendance', { groupId, groupName })
            }
            style={({ pressed }) => [styles.markBtn, pressed && styles.pressed]}
          >
            <View style={styles.markIcon}>
              <Ionicons name="create" size={20} color={colors.onPrimary} />
            </View>
            <View style={styles.markBody}>
              <Text style={styles.markTitle}>Mark attendance</Text>
              <Text style={styles.markSub}>Take today’s roll as Admin/Teacher</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ) : (
          <View style={styles.roleNote}>
            <Ionicons name="lock-closed" size={15} color={colors.muted} />
            <Text style={styles.roleNoteText}>
              Only the group’s Admin/Teacher can mark attendance.
              {isCaptain ? ' As Captain, you’re alerted if a check-in is missed.' : ''}
            </Text>
          </View>
        )}

        {/* History (read-only, all members) */}
        <View style={styles.historyHead}>
          <Text style={styles.sectionLabel}>History</Text>
          <Text style={styles.sectionCount}>{history.length}</Text>
        </View>

        {history.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>No attendance yet</Text>
            <Text style={styles.emptySub}>
              Records will appear here once attendance is taken.
            </Text>
          </Card>
        ) : (
          <Card padded={false}>
            {history.map((rec, i) => (
              <HistoryRow key={rec.id} rec={rec} last={i === history.length - 1} />
            ))}
          </Card>
        )}

        {/* Dev-only: stand-in for a real missed-deadline timer */}
        {__DEV__ ? (
          <Pressable
            onPress={() => simulateMissed(groupId, leadName(members))}
            style={({ pressed }) => [styles.debugBtn, pressed && styles.pressed]}
          >
            <Ionicons name="bug" size={15} color={colors.muted} />
            <Text style={styles.debugText}>DEV · Simulate missed check-in</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function HistoryRow({ rec, last }) {
  const meta = KIND_META[rec.kind] || KIND_META.marked;
  const title =
    rec.kind === 'marked'
      ? `Marked by ${rec.byName}`
      : rec.kind === 'self-study'
      ? 'Missed — Captain started self-study'
      : 'Missed — Captain escalated to Admin';
  const sub =
    rec.kind === 'marked'
      ? `${rec.presentCount}/${rec.totalCount} present`
      : `by ${rec.byName}`;

  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={[styles.rowIcon, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={17} color={meta.fg} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Text style={styles.rowTime}>{rec.at}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  pressed: { opacity: 0.85 },

  cascade: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  cascadeHead: { flexDirection: 'row', alignItems: 'center' },
  cascadeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cascadeHeadBody: { flex: 1, marginLeft: spacing.md },
  cascadeTag: { ...type.label, fontSize: 10, color: colors.accent },
  cascadeTitle: { ...type.bodyStrong, color: colors.ink, marginTop: 2 },
  cascadeSub: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  cascadeActions: { flexDirection: 'row', gap: spacing.md },
  cascadeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    gap: 6,
  },
  cascadeBtnPrimary: { backgroundColor: colors.primary },
  cascadeBtnPrimaryText: { ...type.bodyStrong, fontSize: 13, color: colors.onPrimary },
  cascadeBtnGhost: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cascadeBtnGhostText: { ...type.bodyStrong, fontSize: 13, color: colors.accent },

  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoNoteText: {
    ...type.caption,
    color: colors.primaryDark,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },

  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  markIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markBody: { flex: 1, marginLeft: spacing.md },
  markTitle: { ...type.bodyStrong, color: colors.ink },
  markSub: { ...type.caption, color: colors.muted, marginTop: 1 },

  roleNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  roleNoteText: {
    ...type.caption,
    color: colors.inkSoft,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },

  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionLabel: { ...type.label, color: colors.muted },
  sectionCount: { ...type.caption, color: colors.muted },

  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { ...type.heading, color: colors.ink },
  emptySub: {
    ...type.caption,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, marginLeft: spacing.md },
  rowTitle: { ...type.bodyStrong, fontSize: 14, color: colors.ink },
  rowSub: { ...type.caption, color: colors.muted, marginTop: 1 },
  rowTime: { ...type.caption, color: colors.muted, marginLeft: spacing.sm },

  debugBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    gap: 6,
  },
  debugText: { ...type.caption, color: colors.muted, fontWeight: '600' },
});
