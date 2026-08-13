import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import AvatarMenu from '../components/AvatarMenu';
import { useStatusBar } from '../components/useStatusBar';
import { colors, spacing, radius, type } from '../theme';
import { useSession } from '../state/session';
import { useGroups } from '../state/groups';
import { useNotifications } from '../state/notifications';
import { useHomeSignals } from '../lib/homeSignals';
import { confirm } from '../lib/confirm';

const HEADER_AVATAR_COLOR = '#3F4048';

function greetingFor(date) {
  const h = date.getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

// "TUE 12 AUGUST" — mono kicker above the greeting.
function fmtDayLine(date) {
  return date
    .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' })
    .toUpperCase();
}

export default function HomeScreen({ navigation }) {
  useStatusBar('dark');
  const { user, signOut } = useSession();
  const { groups } = useGroups();
  const { needsYouUnreadCount } = useNotifications();
  const { forYou } = useHomeSignals(groups);

  const firstName = user && user.name ? user.name.split(' ')[0] : 'there';

  // Keep the greeting + date line current while Home is focused.
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), 60 * 1000);
      return () => clearInterval(id);
    }, [])
  );
  const greeting = greetingFor(now);

  const [menuOpen, setMenuOpen] = useState(false);

  function confirmSignOut() {
    confirm({
      title: 'Sign out',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Sign out',
      destructive: true,
      onConfirm: () => signOut(),
    });
  }

  const menuItems = [
    { id: 'profile', icon: 'person-outline', label: 'Profile', onPress: () => navigation.navigate('Profile') },
    { id: 'notifications', icon: 'notifications-outline', label: 'Notifications settings', onPress: () => navigation.navigate('Alerts') },
    { id: 'privacy', icon: 'lock-closed-outline', label: 'Privacy', onPress: () => navigation.navigate('PrivacyNotice') },
    { id: 'appearance', icon: 'contrast-outline', label: 'Appearance' },
    { id: 'help', icon: 'help-circle-outline', label: 'Help & support' },
    { id: 'about', icon: 'information-circle-outline', label: 'About RDS' },
    { id: 'signout', icon: 'log-out-outline', label: 'Sign out', danger: true, onPress: confirmSignOut },
  ];

  return (
    <Screen>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>
          RDS<Text style={styles.dot}>.</Text>
        </Text>
        <View style={styles.topRight}>
          <Pressable
            onPress={() => navigation.navigate('Alerts')}
            hitSlop={8}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.ink} />
            {needsYouUnreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {needsYouUnreadCount > 9 ? '9+' : needsYouUnreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Avatar name={firstName} uri={user ? user.avatarUrl : null} size={34} color={HEADER_AVATAR_COLOR} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Date + greeting */}
        <Text style={styles.dayLine}>{fmtDayLine(now)}</Text>
        <Text style={styles.greeting}>
          {greeting}, {firstName}
        </Text>

        {/* Needs you now — the single most time-sensitive thing right now */}
        {forYou ? (
          <ForYouCard item={forYou} navigation={navigation} />
        ) : (
          <View style={styles.calm}>
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
            <Text style={styles.calmText}>
              {groups.length
                ? 'You’re all caught up. Nothing needs you right now.'
                : 'Head to Explore to create or join your first group.'}
            </Text>
          </View>
        )}
      </ScrollView>

      <AvatarMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        name={user ? user.name : 'Member'}
        email={user ? user.email : ''}
        avatarColor={HEADER_AVATAR_COLOR}
        items={menuItems}
      />
    </Screen>
  );
}

function ForYouCard({ item, navigation }) {
  const urgent = item.tone === 'urgent';
  const go = () => navigation.navigate(item.target.screen, item.target.params);
  return (
    <Pressable
      onPress={go}
      style={({ pressed }) => [
        styles.forYou,
        urgent ? styles.forYouUrgent : styles.forYouDue,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.forYouKicker}>
        <View style={styles.forYouDot} />
        <Text style={styles.forYouLabel}>
          {urgent ? 'Needs you now' : 'For you'}
        </Text>
      </View>
      <Text style={styles.forYouTitle}>{item.title}</Text>
      {item.actionLabel ? (
        <View style={styles.forYouActions}>
          <View style={styles.forYouBtn}>
            <Text style={styles.forYouBtnText}>{item.actionLabel}</Text>
          </View>
          {item.subtitle ? (
            <Text style={styles.forYouSub} numberOfLines={1}>{item.subtitle}</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  wordmark: { ...type.title, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  dot: { color: colors.accent },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bell: {},
  pressed: { opacity: 0.6 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { ...type.label, fontSize: 9, color: colors.onPrimary },

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 40,
  },
  dayLine: {
    ...type.monoLabel,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.muted,
  },
  greeting: {
    ...type.display,
    fontSize: 30,
    color: colors.ink,
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  forYou: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  forYouUrgent: { backgroundColor: colors.accent },
  forYouDue: { backgroundColor: colors.warning },
  forYouKicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  forYouDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  forYouLabel: {
    ...type.monoLabel,
    color: '#FFFFFF',
    opacity: 0.9,
    letterSpacing: 1,
  },
  forYouTitle: {
    ...type.title,
    fontSize: 20,
    lineHeight: 26,
    color: '#FFFFFF',
    marginTop: spacing.md,
  },
  forYouActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  forYouBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
  },
  forYouBtnText: { ...type.bodyStrong, color: colors.ink },
  forYouSub: { ...type.caption, color: '#FFFFFF', opacity: 0.85, flexShrink: 1 },
  calm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  calmText: { ...type.body, color: colors.inkSoft, flex: 1, lineHeight: 20 },
});
