import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

// Small pill label. `tone` selects a soft background + matching text color.
const TONES = {
  primary: { bg: colors.primarySoft, fg: colors.primary },
  accent: { bg: colors.accentSoft, fg: colors.accent },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  info: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: colors.surfaceAlt, fg: colors.inkSoft },
};

export default function Badge({ label, tone = 'neutral', style }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <View style={[styles.wrap, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  text: {
    ...type.label,
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
