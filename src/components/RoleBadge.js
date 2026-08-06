import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing, type, roleTheme } from '../theme';

// Role-colored pill (gold / teal / indigo) — the badge form of the app's
// role signature. Replaces the old plain gray role pill.
export default function RoleBadge({ role, style, solid = false }) {
  const rc = roleTheme(role);
  return (
    <View
      style={[
        styles.wrap,
        solid
          ? { backgroundColor: rc.solid }
          : { backgroundColor: rc.soft },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: solid ? '#FFFFFF' : rc.solid }]} />
      <Text style={[styles.text, { color: solid ? '#FFFFFF' : rc.text }]}>{role}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    ...type.label,
    fontSize: 10,
    letterSpacing: 0.4,
  },
});
