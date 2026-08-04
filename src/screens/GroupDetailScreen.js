import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Header from '../components/Header';
import { colors, spacing, radius, type, shadow } from '../theme';
import { useGroups } from '../state/groups';

const MODULES = [
  {
    key: 'Feed',
    title: 'Feed',
    subtitle: 'Posts & announcements',
    icon: 'chatbubbles',
    bg: colors.primarySoft,
    fg: colors.primary,
  },
  {
    key: 'Votes',
    title: 'Votes',
    subtitle: 'Polls & decisions',
    icon: 'bar-chart',
    bg: colors.accentSoft,
    fg: colors.accent,
  },
  {
    key: 'Members',
    title: 'Members',
    subtitle: 'Roster & roles',
    icon: 'people',
    bg: colors.infoSoft,
    fg: colors.info,
  },
  {
    key: 'Attendance',
    title: 'Attendance',
    subtitle: 'Roll & check-ins',
    icon: 'calendar',
    bg: colors.successSoft,
    fg: colors.success,
  },
];

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { getGroup } = useGroups();
  const group = getGroup(groupId);

  if (!group) {
    return (
      <Screen>
        <Header title="Group" onBack={() => navigation.goBack()} />
        <View style={styles.groupHead}>
          <Text style={styles.meta}>This group is no longer available.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Group" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Group header */}
        <View style={styles.groupHead}>
          <Avatar emoji={group.emoji} name={group.name} size={72} />
          <Text style={styles.groupName}>{group.name}</Text>
          <View style={styles.metaRow}>
            <Badge
              label={group.role}
              tone={group.role === 'Member' ? 'neutral' : 'primary'}
            />
            <Badge label={group.kind} tone="neutral" style={{ marginLeft: 8 }} />
            <View style={styles.dot} />
            <Text style={styles.meta}>{group.members} members</Text>
          </View>
        </View>

        {/* Invite code — share so others can join this group */}
        <View style={styles.codeCard}>
          <View style={styles.codeLeft}>
            <Ionicons name="key-outline" size={16} color={colors.primary} />
            <Text style={styles.codeLabel}>Group code</Text>
          </View>
          <Text style={styles.codeValue} selectable numberOfLines={1}>
            {group.id}
          </Text>
        </View>

        {/* Module grid */}
        <View style={styles.grid}>
          {MODULES.map((m) => (
            <ModuleCard
              key={m.key}
              module={m}
              onPress={() =>
                navigation.navigate(m.key, {
                  groupId: group.id,
                  groupName: group.name,
                })
              }
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function ModuleCard({ module, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.moduleCard,
        module.comingSoon && styles.moduleCardSoon,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.moduleIcon, { backgroundColor: module.bg }]}>
        <Ionicons name={module.icon} size={22} color={module.fg} />
      </View>
      <Text style={styles.moduleTitle}>{module.title}</Text>
      <Text style={styles.moduleSub}>{module.subtitle}</Text>
      {module.comingSoon ? (
        <View style={styles.soonTag}>
          <Text style={styles.soonTagText}>SOON</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const CARD_GAP = spacing.md;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  groupHead: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
  },
  groupName: {
    ...type.title,
    color: colors.ink,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.muted,
    marginHorizontal: spacing.sm,
  },
  meta: {
    ...type.caption,
    color: colors.muted,
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  codeLeft: { flexDirection: 'row', alignItems: 'center' },
  codeLabel: {
    ...type.label,
    color: colors.muted,
    marginLeft: 6,
  },
  codeValue: {
    ...type.caption,
    color: colors.inkSoft,
    flexShrink: 1,
    marginLeft: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moduleCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: CARD_GAP,
    ...shadow.card,
  },
  moduleCardSoon: {
    borderStyle: 'dashed',
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
    ...({ shadowOpacity: 0, elevation: 0 }),
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  moduleIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  moduleTitle: {
    ...type.heading,
    color: colors.ink,
  },
  moduleSub: {
    ...type.caption,
    color: colors.muted,
    marginTop: 2,
  },
  soonTag: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  soonTagText: {
    ...type.label,
    fontSize: 9,
    color: colors.onPrimary,
  },
});
