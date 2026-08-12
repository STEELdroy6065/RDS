import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, type, roleTheme } from '../theme';

// Role chip — mono uppercase tag. Quiet by default (sunk bg, muted text);
// `solid` fills it with the role color for emphasis. Roles read as labels,
// not decoration.
export default function RoleBadge({ role, style, solid = false }) {
  const rc = roleTheme(role);
  return (
    <View
      style={[
        styles.wrap,
        solid ? { backgroundColor: rc.solid } : styles.wrapQuiet,
        style,
      ]}
    >
      <Text style={[styles.text, { color: solid ? '#FFFFFF' : colors.muted }]}>{role}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  wrapQuiet: {
    backgroundColor: colors.surfaceAlt,
  },
  text: {
    ...type.monoLabel,
  },
});
