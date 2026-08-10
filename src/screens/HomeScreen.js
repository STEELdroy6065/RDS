import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import GroupCard from '../components/GroupCard';
import SectionLabel from '../components/SectionLabel';
import Avatar from '../components/Avatar';
import AvatarMenu from '../components/AvatarMenu';
import { useStatusBar } from '../components/useStatusBar';
import { colors, spacing, radius, type } from '../theme';
import { useSession } from '../state/session';
import { useGroups } from '../state/groups';
import { useNotifications } from '../state/notifications';
import { supabase } from '../lib/supabase';
import { confirm } from '../lib/confirm';

const HEADER_AVATAR_COLOR = '#3F4048';

function greetingFor(date) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function relTime(iso) {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export default function HomeScreen({ navigation }) {
  useStatusBar('dark');
  const { user, signOut } = useSession();
  const { groups } = useGroups();
  const { unreadCount } = useNotifications();

  const firstName = user && user.name ? user.name.split(' ')[0] : 'there';

  // Keep the greeting current: refresh when Home is focused and tick each
  // minute while it's open, so it flips as the time of day changes.
  const [greeting, setGreeting] = useState(() => greetingFor(new Date()));
  useFocusEffect(
    useCallback(() => {
      setGreeting(greetingFor(new Date()));
      const id = setInterval(() => setGreeting(greetingFor(new Date())), 60 * 1000);
      return () => clearInterval(id);
    }, [])
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messageHits, setMessageHits] = useState([]);
  const q = query.trim();

  const groupsById = useMemo(() => {
    const map = {};
    groups.forEach((g) => (map[g.id] = g));
    return map;
  }, [groups]);

  const groupHits = useMemo(() => {
    if (!q) return [];
    const needle = q.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(needle));
  }, [q, groups]);

  // Search feed content across the user's groups. RLS already scopes `posts`
  // to groups the user belongs to, so a plain query is safe.
  useEffect(() => {
    if (!q) {
      setMessageHits([]);
      return;
    }
    let cancelled = false;
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, group_id, text, author_name, type, created_at')
        .ilike('text', pattern)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!cancelled) setMessageHits(data || []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

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

  const searching = q.length > 0;

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
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Avatar name={firstName} size={34} color={HEADER_AVATAR_COLOR} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Greeting — centered */}
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{firstName}</Text>

        {/* Search */}
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search groups, messages, files..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {searching ? (
          <SearchResults
            query={q}
            groupHits={groupHits}
            messageHits={messageHits}
            groupsById={groupsById}
            onOpenGroup={(g) => navigation.navigate('Feed', { groupId: g.id, groupName: g.name })}
            onOpenMessage={(m) => {
              const g = groupsById[m.group_id];
              navigation.navigate('Feed', {
                groupId: m.group_id,
                groupName: g ? g.name : 'Group',
              });
            }}
          />
        ) : (
          <>
            <SectionLabel style={styles.section}>Your groups</SectionLabel>
            {groups.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No groups yet</Text>
                <Text style={styles.emptySub}>
                  Tap the + on the left rail to create or join your first group.
                </Text>
              </View>
            ) : (
              groups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  onPress={() => navigation.navigate('Feed', { groupId: g.id, groupName: g.name })}
                />
              ))
            )}
          </>
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

function SearchResults({ query, groupHits, messageHits, groupsById, onOpenGroup, onOpenMessage }) {
  const nothing = groupHits.length === 0 && messageHits.length === 0;
  if (nothing) {
    return (
      <View style={styles.empty}>
        <Ionicons name="search-outline" size={28} color={colors.muted} />
        <Text style={styles.emptySub}>No matches for “{query}”.</Text>
      </View>
    );
  }

  return (
    <>
      {groupHits.length ? (
        <>
          <SectionLabel style={styles.section}>Groups</SectionLabel>
          {groupHits.map((g) => (
            <GroupCard key={g.id} group={g} onPress={() => onOpenGroup(g)} />
          ))}
        </>
      ) : null}

      {messageHits.length ? (
        <>
          <SectionLabel style={styles.section}>Messages</SectionLabel>
          {messageHits.map((m) => {
            const g = groupsById[m.group_id];
            return (
              <Pressable
                key={m.id}
                onPress={() => onOpenMessage(m)}
                style={({ pressed }) => [styles.msgRow, pressed && styles.pressed]}
              >
                <View style={styles.msgIcon}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.inkSoft} />
                </View>
                <View style={styles.msgBody}>
                  <Text style={styles.msgText} numberOfLines={2}>{m.text}</Text>
                  <Text style={styles.msgMeta} numberOfLines={1}>
                    {(g ? g.name : 'Group')}
                    {m.author_name ? ` · ${m.author_name}` : ''} · {relTime(m.created_at)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </>
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
  greeting: {
    ...type.title,
    color: colors.inkSoft,
    fontWeight: '600',
    textAlign: 'center',
  },
  name: {
    ...type.display,
    fontSize: 30,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 2,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  searchInput: {
    ...type.body,
    flex: 1,
    color: colors.ink,
    padding: 0,
  },
  section: { marginTop: spacing.xs },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: { ...type.heading, color: colors.ink },
  emptySub: {
    ...type.caption,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  msgIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgBody: { flex: 1, marginLeft: spacing.md },
  msgText: { ...type.body, color: colors.ink, lineHeight: 20 },
  msgMeta: { ...type.caption, color: colors.muted, marginTop: 3 },
});
