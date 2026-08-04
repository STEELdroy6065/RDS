import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing, type } from '../../theme';

// Branded splash shown while the auth session is being restored on launch.
export default function SplashScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Text style={styles.wordmark}>
          Synq<Text style={styles.dot}>.</Text>
        </Text>
        <Text style={styles.tagline}>Groups, in sync</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  wordmark: {
    ...type.display,
    fontSize: 52,
    color: colors.onPrimary,
    letterSpacing: -1.5,
  },
  dot: {
    color: colors.accent,
  },
  tagline: {
    ...type.body,
    color: 'rgba(255,255,255,0.75)',
    marginTop: spacing.sm,
    letterSpacing: 0.2,
  },
});
