import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import { useStatusBar } from '../components/useStatusBar';
import { colors, spacing, radius, type, topRole } from '../theme';
import { useSession } from '../state/session';
import { useGroups } from '../state/groups';
import { confirm } from '../lib/confirm';

// Grouped settings — clean single-color line icons, ride-app style.
const SECTIONS = [
  {
    key: 'account',
    rows: [
      { id: 'notifications', icon: 'notifications-outline', label: 'Notifications' },
      { id: 'privacy', icon: 'lock-closed-outline', label: 'Privacy' },
      { id: 'appearance', icon: 'contrast-outline', label: 'Appearance' },
    ],
  },
  {
    key: 'support',
    rows: [
      { id: 'help', icon: 'help-circle-outline', label: 'Help & support' },
      { id: 'about', icon: 'information-circle-outline', label: 'About Synq' },
    ],
  },
  {
    key: 'session',
    rows: [
      { id: 'signout', icon: 'log-out-outline', label: 'Sign out', danger: true },
    ],
  },
];

export default function ProfileScreen({ navigation }) {
  useStatusBar('light');
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const { groups } = useGroups();

  const name = user ? user.name : 'Member';
  const email = user ? user.email : '';
  const myTopRole = groups.length ? topRole(groups.map((g) => g.role)) : 'Member';

  function confirmSignOut() {
    confirm({
      title: 'Sign out',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Sign out',
      destructive: true,
      onConfirm: () => signOut(),
    });
  }

  function onRowPress(id) {
    if (id === 'privacy') navigation.navigate('PrivacyNotice');
    else if (id === 'signout') confirmSignOut();
  }

  return (
    <Screen topInset={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Black identity header — edge to edge */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Avatar name={name} size={64} color="#3F4048" />
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
            {email ? <Text style={styles.headerSub} numberOfLines={1}>{email}</Text> : null}
            <Text style={styles.headerRole}>{myTopRole}</Text>
          </View>
        </View>

        {/* Compact stats strip */}
        <View style={styles.stats}>
          <Stat value={groups.length} label="Groups" />
          <View style={styles.vDivider} />
          <Stat value={0} label="Votes cast" />
          <View style={styles.vDivider} />
          <Stat value="—" label="Attendance" />
        </View>

        {/* Settings — plain rows, gray line icons */}
        {SECTIONS.map((section) => (
          <View key={section.key} style={styles.group}>
            {section.rows.map((row, i) => (
              <Pressable
                key={row.id}
                onPress={() => onRowPress(row.id)}
                style={({ pressed }) => [
                  styles.row,
                  i < section.rows.length - 1 && styles.rowBorder,
                  pressed && styles.rowPressed,
                ]}
              >
                <Ionicons
                  name={row.icon}
                  size={22}
                  color={row.danger ? colors.accent : colors.inkSoft}
                />
                <Text style={[styles.rowLabel, row.danger && { color: colors.accent }]}>
                  {row.label}
                </Text>
                {!row.danger ? (
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ))}

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
  content: { paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  headerText: { flex: 1 },
  headerName: { ...type.title, color: colors.onPrimary },
  headerSub: { ...type.caption, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  headerRole: {
    ...type.label,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...type.title, fontSize: 22, color: colors.ink },
  statLabel: { ...type.caption, color: colors.muted, marginTop: 3 },
  vDivider: { width: 1, height: 28, backgroundColor: colors.divider },
  group: {
    backgroundColor: colors.surface,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowLabel: {
    ...type.body,
    color: colors.ink,
    flex: 1,
    marginLeft: spacing.lg,
  },
  version: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
