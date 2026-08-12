import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, type } from '../theme';

// Small uppercase section header with optional trailing element.
export default function SectionLabel({ children, right, style }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.label}>{children}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  label: {
    ...type.monoLabel,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
  },
});
