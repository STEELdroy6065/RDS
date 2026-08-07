import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import RoleBadge from '../components/RoleBadge';
import SectionLabel from '../components/SectionLabel';
import { useStatusBar } from '../components/useStatusBar';
import { colors, spacing, radius, type, shadow, topRole, roleTheme } from '../theme';
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

export default function ProfileScreen({ navigation }) {
  useStatusBar('light');
  const { user, signOut } = useSession();
  const { groups } = useGroups();

  const name = user ? user.name : 'Member';
  const subtitle = user ? user.email : '';
  const myTopRole = groups.length ? topRole(groups.map((g) => g.role)) : 'Member';
  const rc = roleTheme(myTopRole);

  function confirmSignOut() {
    confirm({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      destructive: true,
      onConfirm: () => signOut(),
    });
  }

  function onSettingPress(id) {
    if (id === 's2') navigation.navigate('PrivacyNotice');
    else if (id === 's5') confirmSignOut();
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        {/* Identity */}
        <View style={styles.identity}>
          <Avatar name={name} size={80} ring={rc.ring} color={rc.solid} />
          <Text style={styles.name}>{name}</Text>
          {subtitle ? <Text style={styles.email}>{subtitle}</Text> : null}
          {groups.length ? (
            <RoleBadge role={myTopRole} solid style={styles.badge} />
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <Stat value={groups.length} label="Groups" />
          <View style={styles.vDivider} />
          <Stat value={0} label="Votes cast" />
          <View style={styles.vDivider} />
          <Stat value="—" label="Attendance" />
        </View>

        <SectionLabel style={styles.section}>Settings</SectionLabel>
        <Card padded={false}>
          {SETTINGS.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => onSettingPress(s.id)}
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
              <Text style={[styles.settingLabel, s.danger && { color: colors.accent }]}>
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
    paddingBottom: 120,
  },
  title: {
    ...type.display,
    color: colors.ink,
    marginBottom: spacing.xl,
  },
  identity: { alignItems: 'center', marginBottom: spacing.xl },
  name: { ...type.title, color: colors.ink, marginTop: spacing.md },
  email: { ...type.caption, color: colors.muted, marginTop: 2 },
  badge: { marginTop: spacing.md },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...type.title, fontSize: 26, color: colors.ink },
  statLabel: { ...type.caption, color: colors.muted, marginTop: 3 },
  vDivider: { width: 1, height: 32, backgroundColor: colors.divider },
  section: { marginTop: spacing.xs },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  settingBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  pressed: { backgroundColor: colors.surfaceAlt },
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
