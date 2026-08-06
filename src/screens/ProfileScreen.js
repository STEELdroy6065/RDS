import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
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
    <Screen topInset={false} style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark header with role-ringed avatar */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerCenter}>
            <Avatar name={name} size={76} ring={rc.ring} />
            <Text style={styles.name}>{name}</Text>
            {subtitle ? <Text style={styles.email}>{subtitle}</Text> : null}
            {groups.length ? (
              <RoleBadge role={myTopRole} solid style={styles.headerBadge} />
            ) : null}
          </View>
        </View>

        {/* Light sheet */}
        <View style={styles.sheet}>
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
        </View>
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
  root: { backgroundColor: colors.ink },
  scroll: { backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing.xxl },
  header: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl + spacing.xl,
    alignItems: 'center',
  },
  headerTitle: {
    ...type.label,
    color: 'rgba(255,255,255,0.5)',
    alignSelf: 'flex-start',
    marginBottom: spacing.xl,
  },
  headerCenter: { alignItems: 'center' },
  name: { ...type.title, color: '#FFFFFF', marginTop: spacing.md },
  email: { ...type.caption, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  headerBadge: { marginTop: spacing.md },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    minHeight: 400,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: -spacing.xxl - spacing.md,
    marginBottom: spacing.xl,
    ...shadow.raised,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...type.title, fontSize: 24, color: colors.ink },
  statLabel: { ...type.caption, color: colors.muted, marginTop: 2 },
  vDivider: { width: 1, height: 30, backgroundColor: colors.divider },
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
