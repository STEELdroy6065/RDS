import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useStatusBar } from '../components/useStatusBar';
import { colors, spacing, radius, type } from '../theme';
import { useGroups } from '../state/groups';
import { groupTemplates } from '../data/discoverable';

// A discovery surface: create or join a group, and browse the kinds of groups
// RDS is built for. Kept intentionally action-first.
export default function ExploreScreen({ navigation }) {
  useStatusBar('dark');
  const { groups } = useGroups();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>EXPLORE</Text>
        <Text style={styles.title}>Start something</Text>

        {/* Primary actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => navigation.navigate('NewGroup', { initialTab: 'create' })}
            style={({ pressed }) => [styles.actionCard, styles.actionPrimary, pressed && styles.pressed]}
          >
            <View style={styles.actionIconDark}>
              <Ionicons name="add" size={24} color={colors.onPrimary} />
            </View>
            <Text style={styles.actionTitleLight}>Create a group</Text>
            <Text style={styles.actionSubLight}>Start a class, club or community</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('NewGroup', { initialTab: 'join' })}
            style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="enter-outline" size={22} color={colors.ink} />
            </View>
            <Text style={styles.actionTitle}>Join a group</Text>
            <Text style={styles.actionSub}>Enter a code or scan a QR</Text>
          </Pressable>
        </View>

        {/* Scan shortcut */}
        <Pressable
          onPress={() => navigation.navigate('ScanGroup')}
          style={({ pressed }) => [styles.scanRow, pressed && styles.pressedRow]}
        >
          <View style={styles.scanIcon}>
            <Ionicons name="qr-code-outline" size={20} color={colors.inkSoft} />
          </View>
          <View style={styles.scanBody}>
            <Text style={styles.scanTitle}>Scan a QR code</Text>
            <Text style={styles.scanSub}>Point your camera at a group’s invite</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        {/* Browse by kind */}
        <Text style={styles.section}>WHAT ARE YOU ORGANISING?</Text>
        {groupTemplates.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => navigation.navigate('NewGroup', { initialTab: 'create', templateId: t.id })}
            style={({ pressed }) => [styles.kindRow, pressed && styles.pressedRow]}
          >
            <View style={styles.kindEmoji}>
              <Text style={styles.kindEmojiText}>{t.emoji}</Text>
            </View>
            <View style={styles.kindBody}>
              <Text style={styles.kindTitle}>{t.label}</Text>
              <Text style={styles.kindSub}>{kindBlurb(t.id)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}

        {groups.length === 0 ? (
          <View style={styles.tip}>
            <Ionicons name="sparkles-outline" size={16} color={colors.inkSoft} />
            <Text style={styles.tipText}>
              New here? Create your first group above — you’ll be its Admin and can invite others by code.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function kindBlurb(id) {
  switch (id) {
    case 'class':
      return 'Attendance, announcements, and a portable record';
    case 'club':
      return 'Rosters, votes, and a captain your members elect';
    case 'community':
      return 'Keep everyone in the loop, one calm feed';
    default:
      return 'Any group that needs to coordinate';
  }
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  kicker: { ...type.monoLabel, fontSize: 11, letterSpacing: 1.2, color: colors.muted },
  title: { ...type.display, fontSize: 28, color: colors.ink, marginTop: 6, marginBottom: spacing.lg },
  pressed: { opacity: 0.9 },
  pressedRow: { backgroundColor: colors.surfaceAlt },

  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm + 2 },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 6,
  },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionIconDark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionTitle: { ...type.bodyStrong, color: colors.ink },
  actionSub: { ...type.caption, color: colors.muted, lineHeight: 16 },
  actionTitleLight: { ...type.bodyStrong, color: colors.onPrimary },
  actionSubLight: { ...type.caption, color: 'rgba(255,255,255,0.75)', lineHeight: 16 },

  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  scanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBody: { flex: 1, marginLeft: spacing.md },
  scanTitle: { ...type.bodyStrong, color: colors.ink },
  scanSub: { ...type.caption, color: colors.muted, marginTop: 1 },

  section: { ...type.monoLabel, fontSize: 11, letterSpacing: 1, color: colors.muted, marginBottom: spacing.md },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  kindEmoji: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindEmojiText: { fontSize: 22 },
  kindBody: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  kindTitle: { ...type.heading, color: colors.ink },
  kindSub: { ...type.caption, color: colors.muted, marginTop: 2 },

  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  tipText: { ...type.caption, color: colors.inkSoft, flex: 1, lineHeight: 18 },
});
