import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import RoleBadge from '../components/RoleBadge';
import Header from '../components/Header';
import { colors, spacing, radius, type, shadow, roleTheme } from '../theme';
import { useGroups } from '../state/groups';
import { confirm, notify } from '../lib/confirm';

const MODULES = [
  {
    key: 'Feed',
    title: 'Feed',
    subtitle: 'Posts & announcements',
    icon: 'chatbubbles-outline',
    bg: colors.surfaceAlt,
    fg: colors.inkSoft,
  },
  {
    key: 'Votes',
    title: 'Votes',
    subtitle: 'Polls & decisions',
    icon: 'bar-chart-outline',
    bg: colors.surfaceAlt,
    fg: colors.inkSoft,
  },
  {
    key: 'Members',
    title: 'Members',
    subtitle: 'Roster & roles',
    icon: 'people-outline',
    bg: colors.surfaceAlt,
    fg: colors.inkSoft,
  },
  {
    key: 'Attendance',
    title: 'Attendance',
    subtitle: 'Roll & check-ins',
    icon: 'calendar-outline',
    bg: colors.surfaceAlt,
    fg: colors.inkSoft,
  },
];

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { getGroup, leaveGroup, deleteGroup } = useGroups();
  const group = getGroup(groupId);

  function onLeave() {
    confirm({
      title: 'Leave group?',
      message: 'You’ll be removed and stop seeing this group.',
      confirmLabel: 'Leave',
      destructive: true,
      onConfirm: async () => {
        try {
          await leaveGroup(groupId);
          navigation.goBack();
        } catch (e) {
          notify({ title: 'Could not leave', message: e && e.message });
        }
      },
    });
  }

  function onDelete() {
    confirm({
      title: 'Delete this group?',
      message:
        'This permanently removes the group and all its posts, votes, and attendance for everyone. This can’t be undone.',
      confirmLabel: 'Delete group',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteGroup(groupId);
          navigation.goBack();
        } catch (e) {
          notify({ title: 'Could not delete', message: e && e.message });
        }
      },
    });
  }

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
          <Avatar emoji={group.emoji} name={group.name} size={72} ring={roleTheme(group.role).ring} />
          <Text style={styles.groupName}>{group.name}</Text>
          <View style={styles.metaRow}>
            <RoleBadge role={group.role} />
            <Badge label={group.kind} tone="neutral" style={{ marginLeft: 8 }} />
            <View style={styles.dot} />
            <Text style={styles.meta}>{group.members} members</Text>
          </View>
        </View>

        {/* Invite code — share so others can join this group */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Invite to this group</Text>
          <View style={styles.qrTile}>
            <QRCode
              value={group.id}
              size={168}
              color="#000000"
              backgroundColor="#FFFFFF"
            />
          </View>
          <Text style={styles.codeHint}>Scan this to join · {group.name}</Text>
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

        {/* Group settings — leave / delete */}
        <Text style={styles.settingsLabel}>Group settings</Text>

        <Pressable
          onPress={onLeave}
          style={({ pressed }) => [styles.actionRow, pressed && styles.actionPressed]}
        >
          <Ionicons name="exit-outline" size={20} color={colors.inkSoft} />
          <View style={styles.actionBody}>
            <Text style={styles.actionTitle}>Leave group</Text>
            <Text style={styles.actionSub}>Remove yourself from this group</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        {group.role === 'Admin' ? (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [styles.actionRow, styles.dangerRow, pressed && styles.actionPressed]}
          >
            <Ionicons name="trash-outline" size={20} color={colors.accent} />
            <View style={styles.actionBody}>
              <Text style={[styles.actionTitle, { color: colors.accent }]}>Delete group</Text>
              <Text style={styles.actionSub}>Permanently removes it and all its data</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.accent} />
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ModuleCard({ module, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.moduleCard, pressed && styles.pressed]}
    >
      <View style={[styles.moduleIcon, { backgroundColor: module.bg }]}>
        <Ionicons name={module.icon} size={22} color={module.fg} />
      </View>
      <Text style={styles.moduleTitle}>{module.title}</Text>
      <Text style={styles.moduleSub}>{module.subtitle}</Text>
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
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  codeLabel: {
    ...type.label,
    color: colors.muted,
    marginBottom: spacing.lg,
  },
  qrTile: {
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeHint: {
    ...type.bodyStrong,
    fontSize: 13,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  codeValue: {
    ...type.caption,
    color: colors.muted,
    marginTop: spacing.xs,
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  settingsLabel: {
    ...type.label,
    color: colors.muted,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  dangerRow: { borderColor: colors.accent },
  actionPressed: { opacity: 0.7 },
  actionBody: { flex: 1, marginLeft: spacing.md },
  actionTitle: { ...type.bodyStrong, color: colors.ink },
  actionSub: { ...type.caption, color: colors.muted, marginTop: 1 },
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
});
