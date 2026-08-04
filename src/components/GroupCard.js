import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import Avatar from './Avatar';
import Badge from './Badge';
import { colors, spacing, type } from '../theme';

// A single group row used on Home and Groups.
export default function GroupCard({ group, onPress }) {
  const roleTone =
    group.role === 'Captain' || group.role === 'Organizer'
      ? 'primary'
      : 'neutral';

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Avatar emoji={group.emoji} name={group.name} size={48} />

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
          <View style={styles.metaRow}>
            <Badge label={group.role} tone={roleTone} />
            <View style={styles.dot} />
            <Text style={styles.meta}>{group.members} members</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  name: {
    ...type.heading,
    color: colors.ink,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
