import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Avatar from '../../components/Avatar';
import RoleBadge from '../../components/RoleBadge';
import Badge from '../../components/Badge';
import Header from '../../components/Header';
import { colors, spacing, type, roleTheme } from '../../theme';
import { useGroups } from '../../state/groups';

// The three permission roles get the role-colored badge + ring; other
// descriptive roles (Coach, Player, …) use a neutral badge.
const APP_ROLES = ['Admin', 'Captain', 'Member'];

export default function MembersScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { membersForGroup, roleForGroup } = useGroups();
  const members = membersForGroup(groupId);
  // Moderators can open a member's record (to view or verify it).
  const isModerator = ['Admin', 'Captain'].includes(roleForGroup(groupId));

  const openRecord = (m) =>
    navigation.navigate('Record', {
      groupId,
      groupName,
      studentId: m.id,
      studentName: m.name,
    });

  return (
    <Screen>
      <Header title={groupName} subtitle="Members" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.count}>
          {members.length} {members.length === 1 ? 'person' : 'people'}
        </Text>

        {members.map((m, i) => {
          const isAppRole = APP_ROLES.includes(m.role);
          const ring = isAppRole ? roleTheme(m.role).ring : undefined;
          // Records are for students (participants), not guardians.
          const canOpen = isModerator && m.role !== 'Guardian';
          return (
            <Pressable
              key={m.id}
              onPress={canOpen ? () => openRecord(m) : undefined}
              style={({ pressed }) => [
                styles.row,
                i < members.length - 1 && styles.rowBorder,
                canOpen && pressed && styles.rowPressed,
              ]}
            >
              <Avatar name={m.name} uri={m.avatarUrl} size={40} ring={ring} />
              <Text style={styles.name} numberOfLines={1}>
                {m.name}
              </Text>
              {isAppRole ? (
                <RoleBadge role={m.role} />
              ) : (
                <Badge label={m.role} tone="neutral" />
              )}
              {canOpen ? (
                <Ionicons name="chevron-forward" size={18} color={colors.muted} style={styles.chev} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  count: {
    ...type.label,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  chev: { marginLeft: spacing.sm },
  name: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
});
