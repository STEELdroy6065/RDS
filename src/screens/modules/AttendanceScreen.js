import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { colors, spacing, radius, type } from '../../theme';

const PLANNED = [
  { icon: 'qr-code-outline', label: 'Check in with a session code' },
  { icon: 'stats-chart-outline', label: 'Track attendance rates over time' },
  { icon: 'notifications-outline', label: 'Auto-remind members before events' },
];

export default function AttendanceScreen({ route, navigation }) {
  const { groupName } = route.params;

  return (
    <Screen>
      <Header
        title="Attendance"
        subtitle={groupName}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Visually distinct reserved-space card — no functionality yet. */}
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Ionicons name="calendar" size={30} color={colors.success} />
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>COMING SOON</Text>
          </View>
          <Text style={styles.title}>Attendance is on the way</Text>
          <Text style={styles.subtitle}>
            Soon you’ll be able to take roll, let members check themselves in,
            and see participation at a glance — all inside Synq.
          </Text>
        </View>

        <View style={styles.list}>
          {PLANNED.map((p) => (
            <View key={p.label} style={styles.plannedRow}>
              <View style={styles.plannedIcon}>
                <Ionicons name={p.icon} size={18} color={colors.success} />
              </View>
              <Text style={styles.plannedLabel}>{p.label}</Text>
              <Ionicons name="lock-closed" size={14} color={colors.muted} />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.success,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  pill: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  pillText: {
    ...type.label,
    fontSize: 10,
    color: colors.onPrimary,
  },
  title: {
    ...type.title,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    ...type.body,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  list: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  plannedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  plannedIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plannedLabel: {
    ...type.body,
    color: colors.inkSoft,
    flex: 1,
    marginLeft: spacing.md,
  },
});
