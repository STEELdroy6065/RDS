import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type } from '../theme';
import { useNetwork } from '../state/network';

// Thin banner shown at the top whenever the app is offline.
export default function OfflineBanner() {
  const { online } = useNetwork();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 4 }]}>
      <Ionicons name="cloud-offline-outline" size={15} color={colors.onPrimary} />
      <Text style={styles.text} numberOfLines={1}>
        You’re offline — messages will send once you’re back.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
  },
  text: { ...type.caption, color: colors.onPrimary, fontWeight: '600' },
});
