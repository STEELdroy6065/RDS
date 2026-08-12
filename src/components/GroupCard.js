import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import RoleBadge from './RoleBadge';
import { colors, spacing, radius, type } from '../theme';

// A single group row. Calm paper card: rounded avatar tile, name, a live-state
// line, and a quiet mono role tag on the right. Role is a label, not decoration.
export default function GroupCard({ group, onPress, status }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Avatar emoji={group.emoji} name={group.name} size={46} />

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        {status ? (
          <Text style={styles.status} numberOfLines={1}>{status}</Text>
        ) : (
          <Text style={styles.meta} numberOfLines={1}>{group.members} members</Text>
        )}
      </View>

      <RoleBadge role={group.role} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
  body: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  name: {
    ...type.heading,
    color: colors.ink,
    marginBottom: 3,
  },
  meta: {
    ...type.caption,
    color: colors.muted,
  },
  status: {
    ...type.caption,
    color: colors.inkSoft,
    fontWeight: '600',
    flexShrink: 1,
  },
});
