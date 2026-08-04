import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing, shadow } from '../theme';

// Surface container. Becomes pressable when `onPress` is provided.
export default function Card({ children, onPress, style, padded = true }) {
  const content = (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  padded: {
    padding: spacing.lg,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
});
