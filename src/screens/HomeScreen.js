import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import GroupCard from '../components/GroupCard';
import SectionLabel from '../components/SectionLabel';
import { colors, spacing, type } from '../theme';
import { useSession } from '../state/session';
import { useGroups } from '../state/groups';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation }) {
  const { user } = useSession();
  const { groups } = useGroups();
  const firstName = user && user.name ? user.name.split(' ')[0] : 'there';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>Synq</Text>
        <Text style={styles.greeting}>{greeting()},</Text>
        <Text style={styles.name}>{firstName} 👋</Text>

        <View style={styles.summaryRow}>
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
              Head to the Groups tab to create or join your first group.
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
    paddingBottom: spacing.xxl,
  },
  brand: {
    ...type.label,
    color: colors.primary,
    marginBottom: spacing.lg,
  },
  greeting: {
    ...type.title,
    color: colors.muted,
    fontWeight: '600',
  },
  name: {
    ...type.display,
    color: colors.ink,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    ...type.title,
    color: colors.ink,
  },
  summaryLabel: {
    ...type.caption,
    color: colors.muted,
    marginTop: 2,
  },
  vDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.divider,
  },
  section: {
    marginTop: spacing.xs,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
