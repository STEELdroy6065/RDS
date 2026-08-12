import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Header from '../../components/Header';
import Pulse from '../../components/Pulse';
import { colors, spacing, radius, type, shadow, monoFamily } from '../../theme';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import {
  useAttendance,
  canMarkAttendance,
  receivesCascade,
  isPastDeadline,
  fetchMemberTermRecord,
  STATUS_ORDER,
} from '../../state/attendance';
import { fetchLeave } from '../../lib/leave';
import { notify } from '../../lib/confirm';

const STATUS_COLOR = {
  P: colors.success,
  L: colors.warning,
  A: colors.accent,
  E: colors.inkSoft,
};

const KIND_META = {
  submitted: { icon: 'checkmark-done-outline', bg: colors.surfaceAlt, fg: colors.inkSoft },
  missed_self_study: { icon: 'book-outline', bg: colors.surfaceAlt, fg: colors.inkSoft },
  missed_escalated: { icon: 'arrow-up-circle-outline', bg: colors.accentSoft, fg: colors.accent },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function prettyDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return `${MONTHS[(m || 1) - 1]} ${d}`;
}

export default function AttendanceScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useSession();
  const { roleForGroup, getGroup } = useGroups();
  const { historyFor, todayRecordFor, isLoading, refreshGroup, resolveMissed } = useAttendance();

  const group = getGroup(groupId);
  const role = roleForGroup(groupId);
  const isAdmin = canMarkAttendance(role);
  const isCaptain = receivesCascade(role);
  const deadline = (group && group.checkInDeadline) || '09:00';

  const [refreshing, setRefreshing] = useState(false);
  const [myRecord, setMyRecord] = useState(null);
  const [pendingLeave, setPendingLeave] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRefreshing(true);
      refreshGroup(groupId).finally(() => active && setRefreshing(false));
      fetchMemberTermRecord(groupId, user.id).then((r) => {
        if (active) setMyRecord(r);
      });
      fetchLeave(groupId).then((rows) => {
        if (active) setPendingLeave(rows.filter((r) => r.status === 'pending').length);
      });
      return () => {
        active = false;
      };
    }, [groupId, refreshGroup, user.id])
  );

  const history = historyFor(groupId);
  const todayRecord = todayRecordFor(groupId);
  const loading = isLoading(groupId);
  // Computed on read: past the deadline with nothing recorded for today.
  const missed = !todayRecord && isPastDeadline(deadline) && !loading;

  // When the miss is first observed, notify the group's Captain(s) (server
  // dedups to once per group per day). Fire once per screen mount.
  const notified = useRef(false);
  useEffect(() => {
    if (missed && !notified.current) {
      notified.current = true;
      supabase.rpc('notify_missed_checkin', { gid: groupId });
    }
  }, [missed, groupId]);

  async function onResolve(resolution) {
    try {
      await resolveMissed(groupId, resolution);
    } catch (e) {
      notify({ title: 'Could not record that', message: e && e.message });
    }
  }

  return (
    <Screen>
      <Header title="Attendance" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refreshGroup(groupId)}
            tintColor={colors.primary}
          />
        }
      >
        {/* Daily deadline chip */}
        <View style={styles.deadlineChip}>
          <Ionicons name="time-outline" size={15} color={colors.muted} />
          <Text style={styles.deadlineText}>Daily check-in by {deadline}</Text>
        </View>

        {/* Today's status */}
        {todayRecord ? (
          <TodayDoneCard record={todayRecord} />
        ) : missed ? (
          isCaptain ? (
            <CaptainCascade groupName={groupName} onResolve={onResolve} />
          ) : (
            <MissedNote isAdmin={isAdmin} />
          )
        ) : (
          <View style={styles.okNote}>
            <Ionicons name="ellipse-outline" size={16} color={colors.muted} />
            <Text style={styles.okNoteText}>
              No check-in recorded yet today.
              {isPastDeadline(deadline) ? '' : ` The deadline is ${deadline}.`}
            </Text>
          </View>
        )}

        {/* Mark attendance — Admin/Teacher only */}
        {isAdmin ? (
          <Pressable
            onPress={() => navigation.navigate('MarkAttendance', { groupId, groupName })}
            style={({ pressed }) => [styles.markBtn, pressed && styles.pressed]}
          >
            <View style={styles.markIcon}>
              <Ionicons name="create" size={20} color={colors.onPrimary} />
            </View>
            <View style={styles.markBody}>
              <Text style={styles.markTitle}>
                {todayRecord ? 'Attendance recorded' : 'Mark attendance'}
              </Text>
              <Text style={styles.markSub}>
                {todayRecord ? 'Today’s roll is in' : 'Take today’s roll as Admin/Teacher'}
              </Text>
            </View>
            {!todayRecord ? (
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            ) : (
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            )}
          </Pressable>
        ) : (
          <View style={styles.roleNote}>
            <Ionicons name="lock-closed" size={15} color={colors.muted} />
            <Text style={styles.roleNoteText}>
              Only the group’s Admin/Teacher can mark attendance.
              {isCaptain ? ' As Captain, you resolve a missed check-in.' : ''}
            </Text>
          </View>
        )}

        {/* Leave requests entry point */}
        <Pressable
          onPress={() => navigation.navigate('Leave', { groupId, groupName })}
          style={({ pressed }) => [styles.leaveRow, pressed && styles.pressed]}
        >
          <View style={styles.leaveIcon}>
            <Ionicons name="calendar-outline" size={19} color={colors.inkSoft} />
          </View>
          <View style={styles.leaveBody}>
            <Text style={styles.leaveTitle}>Leave requests</Text>
            <Text style={styles.leaveSub}>
              {isAdmin || isCaptain ? 'Review and decide leave' : 'Request time off'}
            </Text>
          </View>
          {(isAdmin || isCaptain) && pendingLeave > 0 ? (
            <View style={styles.leaveBadge}>
              <Text style={styles.leaveBadgeText}>{pendingLeave}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          )}
        </Pressable>

        {/* Your record this term */}
        {myRecord && myRecord.total > 0 ? (
          <TermRecordCard
            record={myRecord}
            onOpen={() =>
              navigation.navigate('Record', {
                groupId,
                groupName,
                studentId: user.id,
                studentName: user.name,
              })
            }
          />
        ) : null}

        {/* History (read-only, all members) */}
        <View style={styles.historyHead}>
          <Text style={styles.sectionLabel}>History</Text>
          <Text style={styles.sectionCount}>{history.length}</Text>
        </View>

        {history.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {loading ? 'Loading…' : 'No attendance yet'}
            </Text>
            {!loading ? (
              <Text style={styles.emptySub}>
                Records will appear here once attendance is taken.
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card padded={false}>
            {history.map((rec, i) => (
              <HistoryRow key={rec.id} rec={rec} last={i === history.length - 1} />
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function TermRecordCard({ record, onOpen }) {
  const { tally, rate, streak, total } = record;
  return (
    <View style={styles.term}>
      <View style={styles.termHead}>
        <Text style={styles.termLabel}>YOUR RECORD THIS TERM</Text>
        <Text style={styles.termDays}>{total} {total === 1 ? 'day' : 'days'}</Text>
      </View>
      <View style={styles.termTop}>
        <View style={styles.termRate}>
          <Text style={styles.termRateValue}>
            {rate == null ? '—' : `${rate}`}
            {rate == null ? '' : <Text style={styles.termRatePct}>%</Text>}
          </Text>
          <Text style={styles.termRateLabel}>attendance</Text>
        </View>
        <View style={styles.termStreak}>
          <Ionicons name="flame" size={16} color={streak > 0 ? colors.warning : colors.muted} />
          <Text style={styles.termStreakValue}>{streak}</Text>
          <Text style={styles.termStreakLabel}>
            day{streak === 1 ? '' : 's'} present in a row
          </Text>
        </View>
      </View>
      <View style={styles.termTally}>
        {STATUS_ORDER.map((s) => (
          <View key={s} style={styles.termChip}>
            <View style={[styles.termDot, { backgroundColor: STATUS_COLOR[s] }]} />
            <Text style={styles.termChipText}>{s} {tally[s]}</Text>
          </View>
        ))}
      </View>
      {onOpen ? (
        <Pressable onPress={onOpen} style={({ pressed }) => [styles.termCta, pressed && styles.pressed]}>
          <Text style={styles.termCtaText}>See my full record</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

function TodayDoneCard({ record }) {
  const submitted = record.status === 'submitted';
  return (
    <View style={[styles.todayCard, { borderColor: colors.success }]}>
      <View style={[styles.todayIcon, { backgroundColor: colors.success }]}>
        <Ionicons name="checkmark" size={20} color={colors.onPrimary} />
      </View>
      <View style={styles.todayBody}>
        <Text style={styles.todayTitle}>Today’s check-in is done</Text>
        <Text style={styles.todaySub}>
          {submitted
            ? `${record.present_count}/${record.total_count} present · marked by ${record.marked_by_name}`
            : record.status === 'missed_self_study'
            ? 'Missed — Captain started a self-study session'
            : 'Missed — Captain escalated to Admin'}
        </Text>
      </View>
    </View>
  );
}

function CaptainCascade({ groupName, onResolve }) {
  return (
    <View style={styles.cascade}>
      <View style={styles.cascadeHead}>
        <View style={styles.cascadeIcon}>
          <Ionicons name="alert" size={20} color={colors.onPrimary} />
        </View>
        <View style={styles.cascadeHeadBody}>
          <View style={styles.cascadeTagRow}>
            <Pulse color={colors.accent} size={7} />
            <Text style={styles.cascadeTag}>MISSED CHECK-IN</Text>
          </View>
          <Text style={styles.cascadeTitle}>
            Today’s check-in was missed — {groupName}
          </Text>
        </View>
      </View>
      <Text style={styles.cascadeSub}>As Captain, you can keep the group moving:</Text>
      <View style={styles.cascadeActions}>
        <Pressable
          onPress={() => onResolve('self-study')}
          style={({ pressed }) => [styles.cascadeBtn, styles.cascadeBtnPrimary, pressed && styles.pressed]}
        >
          <Ionicons name="book" size={16} color={colors.onPrimary} />
          <Text style={styles.cascadeBtnPrimaryText}>Start self-study</Text>
        </Pressable>
        <Pressable
          onPress={() => onResolve('escalate')}
          style={({ pressed }) => [styles.cascadeBtn, styles.cascadeBtnGhost, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-up-circle" size={16} color={colors.accent} />
          <Text style={styles.cascadeBtnGhostText}>Escalate to Admin</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MissedNote({ isAdmin }) {
  return (
    <View style={styles.missedNote}>
      <View style={styles.missedIcon}>
        <Ionicons name="alert" size={18} color={colors.accent} />
      </View>
      <View style={styles.missedBody}>
        <Text style={styles.missedTitle}>Check-in missed</Text>
        <Text style={styles.missedSub}>
          {isAdmin
            ? 'No attendance submitted yet today — take the roll below.'
            : 'The Captain has been notified to respond.'}
        </Text>
      </View>
    </View>
  );
}

function HistoryRow({ rec, last }) {
  const meta = KIND_META[rec.status] || KIND_META.submitted;
  const title =
    rec.status === 'submitted'
      ? `Marked by ${rec.marked_by_name}`
      : rec.status === 'missed_self_study'
      ? 'Missed — Captain started self-study'
      : 'Missed — Captain escalated to Admin';
  const sub =
    rec.status === 'submitted'
      ? `${rec.present_count}/${rec.total_count} present`
      : `by ${rec.marked_by_name}`;

  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={[styles.rowIcon, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={17} color={meta.fg} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Text style={styles.rowTime}>{prettyDate(rec.date)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  pressed: { opacity: 0.85 },

  deadlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.lg,
    gap: 6,
  },
  deadlineText: { ...type.caption, color: colors.inkSoft, fontWeight: '600' },

  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  todayIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBody: { flex: 1, marginLeft: spacing.md },
  todayTitle: { ...type.bodyStrong, color: colors.ink },
  todaySub: { ...type.caption, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },

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
  cascadeTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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

  missedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  missedIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missedBody: { flex: 1, marginLeft: spacing.md },
  missedTitle: { ...type.bodyStrong, color: colors.ink },
  missedSub: { ...type.caption, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },

  okNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  okNoteText: {
    ...type.caption,
    color: colors.inkSoft,
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

  // leave entry
  leaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  leaveIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBody: { flex: 1, marginLeft: spacing.md },
  leaveTitle: { ...type.bodyStrong, color: colors.ink },
  leaveSub: { ...type.caption, color: colors.muted, marginTop: 1 },
  leaveBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBadgeText: { fontFamily: monoFamily, fontSize: 12, fontWeight: '700', color: colors.onPrimary },

  // term record
  term: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  termHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  termLabel: { ...type.monoLabel, fontSize: 11, letterSpacing: 1, color: colors.muted },
  termDays: { fontFamily: monoFamily, fontSize: 12, color: colors.muted },
  termTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  termRate: {},
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
  termCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  termCtaText: { ...type.bodyStrong, fontSize: 14, color: colors.ink },

  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionLabel: { ...type.monoLabel, fontSize: 11, letterSpacing: 1, color: colors.muted },
  sectionCount: { fontFamily: monoFamily, fontSize: 12, color: colors.muted },

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
  rowTime: { fontFamily: monoFamily, fontSize: 12, color: colors.muted, marginLeft: spacing.sm },
});
