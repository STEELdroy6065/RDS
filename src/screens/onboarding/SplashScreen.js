import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing, type } from '../../theme';

// Brief branded splash. Auto-advances to Welcome after a moment, or on tap.
const AUTO_ADVANCE_MS = 1600;

export default function SplashScreen({ navigation }) {
  const advanced = useRef(false);

  const go = () => {
    if (advanced.current) return;
    advanced.current = true;
    navigation.replace('Welcome');
  };

  useEffect(() => {
    const t = setTimeout(go, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Pressable style={styles.root} onPress={go}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Text style={styles.wordmark}>
          Synq<Text style={styles.dot}>.</Text>
        </Text>
        <Text style={styles.tagline}>Groups, in sync</Text>
      </View>
    </Pressable>
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
