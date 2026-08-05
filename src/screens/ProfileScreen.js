import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import SectionLabel from '../components/SectionLabel';
import { colors, spacing, radius, type } from '../theme';
import { useSession } from '../state/session';
import { useGroups } from '../state/groups';
import { confirm } from '../lib/confirm';

const SETTINGS = [
  { id: 's1', icon: 'notifications-outline', label: 'Notifications' },
  { id: 's2', icon: 'lock-closed-outline', label: 'Privacy' },
  { id: 's3', icon: 'color-palette-outline', label: 'Appearance' },
  { id: 's4', icon: 'help-circle-outline', label: 'Help & support' },
  { id: 's5', icon: 'log-out-outline', label: 'Sign out', danger: true },
];

export default function ProfileScreen() {
  const { user, signOut } = useSession();
  const { groups } = useGroups();

  const name = user ? user.name : 'Member';
  const subtitle = user ? user.email : '';

  function confirmSignOut() {
    confirm({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      destructive: true,
      onConfirm: () => signOut(),
    });
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <Avatar name={name} size={64} />
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{name}</Text>
              {subtitle ? <Text style={styles.role}>{subtitle}</Text> : null}
            </View>
          </View>

          <View style={styles.statsRow}>
            <Stat value={groups.length} label="Groups" />
            <View style={styles.vDivider} />
            <Stat value={0} label="Votes cast" />
            <View style={styles.vDivider} />
            <Stat value="—" label="Attendance" />
          </View>
        </Card>

        <SectionLabel style={styles.section}>Settings</SectionLabel>
        <Card padded={false}>
          {SETTINGS.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={s.id === 's5' ? confirmSignOut : undefined}
              style={({ pressed }) => [
                styles.settingRow,
                i < SETTINGS.length - 1 && styles.settingBorder,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={s.icon}
                size={20}
                color={s.danger ? colors.accent : colors.inkSoft}
              />
              <Text
                style={[styles.settingLabel, s.danger && { color: colors.accent }]}
              >
                {s.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </Card>

        <Text style={styles.version}>Synq · v0.1.0</Text>
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...type.display,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  profileCard: {
    marginBottom: spacing.xl,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  name: {
    ...type.title,
    color: colors.ink,
  },
  role: {
    ...type.caption,
    color: colors.muted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...type.title,
    color: colors.ink,
  },
  statLabel: {
    ...type.caption,
    color: colors.muted,
    marginTop: 2,
  },
  vDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.divider,
  },
  section: {
    marginTop: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  settingBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
  settingLabel: {
    ...type.body,
    color: colors.ink,
    flex: 1,
    marginLeft: spacing.md,
  },
  version: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
