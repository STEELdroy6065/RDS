import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Header from '../../components/Header';
import { colors, spacing, radius, type } from '../../theme';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { useAttendance, canMarkAttendance } from '../../state/attendance';

export default function MarkAttendanceScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useSession();
  const { roleForGroup, membersForGroup } = useGroups();
  const { submitAttendance } = useAttendance();

  const role = roleForGroup(groupId);
  const members = membersForGroup(groupId);

  // Presence map keyed by member id — everyone present by default.
  const [present, setPresent] = useState(() => {
    const init = {};
    members.forEach((m) => {
      init[m.id] = true;
    });
    return init;
  });

  // Defensive guard: only Admin/Teacher can reach this.
  if (!canMarkAttendance(role)) {
    return (
      <Screen>
        <Header title="Mark attendance" subtitle={groupName} onBack={() => navigation.goBack()} />
        <View style={styles.denied}>
          <Ionicons name="lock-closed" size={28} color={colors.muted} />
          <Text style={styles.deniedText}>
            Only the group’s Admin/Teacher can mark attendance.
          </Text>
        </View>
      </Screen>
    );
  }

  const presentCount = members.filter((m) => present[m.id]).length;
  const total = members.length;

  const toggle = (id, value) =>
    setPresent((prev) => ({ ...prev, [id]: value }));

  function submit() {
    submitAttendance(groupId, {
      presentCount,
      totalCount: total,
      byName: user.name,
      byRole: role,
    });
    Alert.alert(
      'Attendance submitted',
      `${presentCount} of ${total} marked present.`,
      [{ text: 'Done', onPress: () => navigation.goBack() }]
    );
  }

  return (
    <Screen>
      <Header title="Mark attendance" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summary}>
          <Text style={styles.summaryValue}>
            {presentCount}<Text style={styles.summaryTotal}> / {total}</Text>
          </Text>
          <Text style={styles.summaryLabel}>marked present</Text>
        </View>

        <Card padded={false}>
          {members.map((m, i) => (
            <View key={m.id} style={[styles.row, i < members.length - 1 && styles.rowBorder]}>
              <Avatar name={m.name} size={40} />
              <View style={styles.rowBody}>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.role}>{m.role}</Text>
              </View>
              <Toggle value={present[m.id]} onChange={(v) => toggle(m.id, v)} />
            </View>
          ))}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={submit}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <Ionicons name="checkmark-done" size={18} color={colors.onPrimary} />
          <Text style={styles.ctaText}>Submit attendance</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Toggle({ value, onChange }) {
  return (
    <View style={styles.toggle}>
      <Pressable
        onPress={() => onChange(true)}
        style={[styles.segment, value && styles.segPresent]}
      >
        <Text style={[styles.segText, value && styles.segTextOn]}>Present</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(false)}
        style={[styles.segment, !value && styles.segAbsent]}
      >
        <Text style={[styles.segText, !value && styles.segTextOn]}>Absent</Text>
      </Pressable>
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
    marginBottom: spacing.md,
  },
  summaryValue: { ...type.display, fontSize: 34, color: colors.ink },
  summaryTotal: { color: colors.muted },
  summaryLabel: { ...type.caption, color: colors.muted, marginTop: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowBody: { flex: 1, marginLeft: spacing.md },
  name: { ...type.bodyStrong, color: colors.ink },
  role: { ...type.caption, color: colors.muted, marginTop: 1 },

  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 3,
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  segPresent: { backgroundColor: colors.success },
  segAbsent: { backgroundColor: colors.accent },
  segText: { ...type.caption, fontWeight: '700', color: colors.muted },
  segTextOn: { color: colors.onPrimary },

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
