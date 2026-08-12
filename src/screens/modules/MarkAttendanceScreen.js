import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Avatar from '../../components/Avatar';
import Header from '../../components/Header';
import { colors, spacing, radius, type, monoFamily } from '../../theme';
import { useGroups } from '../../state/groups';
import { useAttendance, canMarkAttendance, STATUS_ORDER, localDateStr } from '../../state/attendance';
import { fetchLeaveForDate } from '../../lib/leave';
import { notify } from '../../lib/confirm';

// Colour per status: green = present, amber = late/unresolved, red = absent,
// neutral = excused (approved, so it doesn't read as a problem).
const STATUS_COLOR = {
  P: colors.success,
  L: colors.warning,
  A: colors.accent,
  E: colors.inkSoft,
};

export default function MarkAttendanceScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { roleForGroup, membersForGroup } = useGroups();
  const { submitAttendance } = useAttendance();

  const role = roleForGroup(groupId);
  const members = membersForGroup(groupId);

  // Status map keyed by member id — everyone Present by default.
  const [statusMap, setStatusMap] = useState(() => {
    const init = {};
    members.forEach((m) => {
      init[m.id] = 'P';
    });
    return init;
  });
  const [busy, setBusy] = useState(false);
  // Leave requests for today, keyed by member id — approved leave pre-marks the
  // member Excused; pending leave surfaces inline so the teacher sees it.
  const [leaveMap, setLeaveMap] = useState({});

  useEffect(() => {
    let active = true;
    fetchLeaveForDate(groupId, localDateStr()).then((map) => {
      if (!active) return;
      setLeaveMap(map);
      const approved = Object.keys(map).filter((id) => map[id].status === 'approved');
      if (approved.length) {
        setStatusMap((prev) => {
          const next = { ...prev };
          approved.forEach((id) => {
            next[id] = 'E';
          });
          return next;
        });
      }
    });
    return () => {
      active = false;
    };
  }, [groupId]);

  // Defensive guard: only Admin/Teacher can reach this.
  if (!canMarkAttendance(role)) {
    return (
      <Screen>
        <Header title="Take the roll" subtitle={groupName} onBack={() => navigation.goBack()} />
        <View style={styles.denied}>
          <Ionicons name="lock-closed" size={28} color={colors.muted} />
          <Text style={styles.deniedText}>
            Only the group’s Admin/Teacher can mark attendance.
          </Text>
        </View>
      </Screen>
    );
  }

  const tally = useMemo(() => {
    const t = { P: 0, L: 0, A: 0, E: 0 };
    members.forEach((m) => {
      const s = statusMap[m.id] || 'P';
      if (t[s] != null) t[s] += 1;
    });
    return t;
  }, [members, statusMap]);

  const total = members.length;
  const presentCount = tally.P + tally.L; // physically there (incl. late)

  const setStatus = (id, s) => setStatusMap((prev) => ({ ...prev, [id]: s }));

  function markAll(s) {
    const next = {};
    members.forEach((m) => {
      next[m.id] = s;
    });
    setStatusMap(next);
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    const entries = members.map((m) => ({
      user_id: m.id,
      member_name: m.name,
      status: statusMap[m.id] || 'P',
    }));
    try {
      await submitAttendance(groupId, { entries, presentCount, totalCount: total });
      notify({
        title: 'Roll submitted',
        message: `${presentCount} of ${total} present.`,
        onDismiss: () => navigation.goBack(),
      });
    } catch (e) {
      setBusy(false);
      notify({
        title: 'Could not submit the roll',
        message:
          e && /duplicate|unique/i.test(e.message || '')
            ? 'Attendance for today has already been recorded.'
            : e && e.message,
      });
    }
  }

  return (
    <Screen>
      <Header title="Take the roll" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Tally strip — mono counts, present headline */}
        <View style={styles.summary}>
          <Text style={styles.summaryValue}>
            {presentCount}<Text style={styles.summaryTotal}> / {total}</Text>
          </Text>
          <Text style={styles.summaryLabel}>present</Text>
          <View style={styles.tallyRow}>
            {STATUS_ORDER.map((s) => (
              <View key={s} style={styles.tallyChip}>
                <View style={[styles.tallyDot, { backgroundColor: STATUS_COLOR[s] }]} />
                <Text style={styles.tallyText}>{s} {tally[s]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <Pressable onPress={() => markAll('P')} style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}>
            <Text style={styles.quickText}>Mark all present</Text>
          </Pressable>
        </View>

        {/* Roster with fixed-position P/L/A/E taps */}
        <View style={styles.list}>
          {members.map((m, i) => (
            <View key={m.id} style={[styles.row, i < members.length - 1 && styles.rowBorder]}>
              <Avatar name={m.name} size={38} />
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>{m.name}</Text>
                {leaveMap[m.id] ? (
                  <Text style={styles.leaveNote} numberOfLines={1}>
                    {leaveMap[m.id].status === 'approved' ? 'Leave approved' : 'Leave requested'}
                    {leaveMap[m.id].reason ? ` — ${leaveMap[m.id].reason}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.role}>{m.role}</Text>
                )}
              </View>
              <StatusPicker value={statusMap[m.id] || 'P'} onChange={(s) => setStatus(m.id, s)} />
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>Submit roll · {presentCount} of {total}</Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

function StatusPicker({ value, onChange }) {
  return (
    <View style={styles.picker}>
      {STATUS_ORDER.map((s) => {
        const on = value === s;
        return (
          <Pressable
            key={s}
            onPress={() => onChange(s)}
            style={[styles.cell, on && { backgroundColor: STATUS_COLOR[s] }]}
          >
            <Text style={[styles.cellText, on && styles.cellTextOn]}>{s}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  denied: { alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  deniedText: { ...type.body, color: colors.muted, textAlign: 'center' },

  summary: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  summaryValue: { fontFamily: monoFamily, fontSize: 38, fontWeight: '600', color: colors.ink, letterSpacing: -1 },
  summaryTotal: { color: colors.muted },
  summaryLabel: { ...type.monoLabel, color: colors.muted, marginTop: 2 },
  tallyRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  tallyChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tallyDot: { width: 7, height: 7, borderRadius: 4 },
  tallyText: { fontFamily: monoFamily, fontSize: 12, fontWeight: '600', color: colors.inkSoft },

  quickRow: { flexDirection: 'row', marginBottom: spacing.md },
  quickBtn: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickText: { ...type.caption, fontWeight: '700', color: colors.success },

  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowBody: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  name: { ...type.bodyStrong, color: colors.ink },
  role: { ...type.caption, color: colors.muted, marginTop: 1 },
  leaveNote: { ...type.caption, color: colors.warning, fontWeight: '600', marginTop: 1 },

  picker: { flexDirection: 'row', gap: 5 },
  cell: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontFamily: monoFamily, fontSize: 13, fontWeight: '600', color: colors.muted },
  cellTextOn: { color: colors.onPrimary },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  ctaText: { ...type.bodyStrong, fontSize: 16, color: colors.onPrimary },
});
