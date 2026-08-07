import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import GroupCard from '../components/GroupCard';
import SectionLabel from '../components/SectionLabel';
import RoleBadge from '../components/RoleBadge';
import { useStatusBar } from '../components/useStatusBar';
import { colors, spacing, radius, type, shadow, topRole } from '../theme';
import { useSession } from '../state/session';
import { useGroups } from '../state/groups';

function greetingFor(date) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation }) {
  useStatusBar('light');
  const { user } = useSession();
  const { groups } = useGroups();
  const firstName = user && user.name ? user.name.split(' ')[0] : 'there';
  const myTopRole = groups.length ? topRole(groups.map((g) => g.role)) : null;

  // Keep the greeting current: refresh when Home is focused and tick each
  // minute while it's open, so it flips as the time of day changes.
  const [greeting, setGreeting] = useState(() => greetingFor(new Date()));
  useFocusEffect(
    useCallback(() => {
      setGreeting(greetingFor(new Date()));
      const id = setInterval(() => setGreeting(greetingFor(new Date())), 60 * 1000);
      return () => clearInterval(id);
    }, [])
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.brand}>SYNQ</Text>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{firstName}</Text>
        {myTopRole ? (
          <RoleBadge role={myTopRole} solid style={styles.headerBadge} />
        ) : null}

        {/* Stats */}
        <View style={styles.statsCard}>
          <Summary value={groups.length} label="Groups" />
          <View style={styles.vDivider} />
          <Summary value={0} label="Votes cast" />
          <View style={styles.vDivider} />
          <Summary value="—" label="Attendance" />
        </View>

        <SectionLabel style={styles.section}>Your groups</SectionLabel>
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySub}>
              Tap the + on the left rail to create or join your first group.
            </Text>
          </View>
        ) : (
          groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function Summary({ value, label }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  brand: {
    ...type.label,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  greeting: {
    ...type.title,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  name: {
    ...type.display,
    fontSize: 34,
    color: colors.ink,
    marginTop: 2,
  },
  headerBadge: { marginTop: spacing.lg },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { ...type.title, fontSize: 26, color: colors.ink },
  summaryLabel: { ...type.caption, color: colors.muted, marginTop: 3 },
  vDivider: { width: 1, height: 32, backgroundColor: colors.divider },
  section: { marginTop: spacing.xs },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: { ...type.heading, color: colors.ink },
  emptySub: {
    ...type.caption,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
});
