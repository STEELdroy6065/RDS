import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import { colors, spacing, radius, type } from '../../theme';

const HIGHLIGHTS = [
  { icon: 'calendar-outline', label: 'Attendance' },
  { icon: 'bar-chart-outline', label: 'Decisions' },
  { icon: 'chatbubbles-outline', label: 'Updates' },
];

export default function WelcomeScreen({ navigation }) {
  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.top}>
          <Text style={styles.brand}>
            Synq<Text style={styles.dot}>.</Text>
          </Text>

          <View style={styles.hero}>
            <Text style={styles.heading}>
              Everything your group needs, in one place.
            </Text>
            <Text style={styles.pitch}>
              Attendance, decisions, and updates for any team, club, or
              class — no more scattered group chats.
            </Text>
          </View>

          <View style={styles.chips}>
            {HIGHLIGHTS.map((h) => (
              <View key={h.label} style={styles.chip}>
                <Ionicons name={h.icon} size={16} color={colors.primary} />
                <Text style={styles.chipText}>{h.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottom}>
          <Pressable
            onPress={() => navigation.navigate('Auth')}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
          </Pressable>
          <Text style={styles.fineprint}>
            Coordinate attendance, votes, and announcements in seconds.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  top: {
    flex: 1,
    justifyContent: 'center',
  },
  brand: {
    ...type.title,
    fontSize: 26,
    color: colors.primary,
    letterSpacing: -0.6,
    marginBottom: spacing.xxl,
  },
  dot: { color: colors.accent },
  hero: {
    marginBottom: spacing.xl,
  },
  heading: {
    ...type.display,
    fontSize: 34,
    lineHeight: 40,
    color: colors.ink,
  },
  pitch: {
    ...type.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSoft,
    marginTop: spacing.lg,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    ...type.bodyStrong,
    fontSize: 13,
    color: colors.primary,
    marginLeft: 6,
  },
  bottom: {
    alignItems: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.9 },
  ctaText: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.onPrimary,
  },
  fineprint: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
