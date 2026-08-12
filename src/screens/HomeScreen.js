import React, { useCallback, useEffect, useState } from 'react';
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
import AssistantPanel from '../components/AssistantPanel';
import { useStatusBar } from '../components/useStatusBar';
import { colors, spacing, radius, type } from '../theme';
import { useSession } from '../state/session';
import { useGroups } from '../state/groups';
import { useNotifications } from '../state/notifications';
import { searchAll } from '../lib/search';
import { useHomeSignals } from '../lib/homeSignals';
import { confirm } from '../lib/confirm';

const EMPTY_RESULTS = { groups: [], messages: [], files: [], votes: [], people: [] };

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
  const { needsYouUnreadCount } = useNotifications();
  const { statusByGroup, forYou } = useHomeSignals(groups);

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
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(EMPTY_RESULTS);
  const q = query.trim();

  // Real cross-entity search (messages, files, votes, people, groups),
  // scoped by RLS to the user's groups. Debounced.
  useEffect(() => {
    if (!q) {
      setResults(EMPTY_RESULTS);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchAll(q, { groups, user });
      if (!cancelled) setResults(r);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, groups, user]);

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
            <Avatar name={firstName} size={34} color={HEADER_AVATAR_COLOR} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* For you — the single most time-sensitive thing right now */}
        {!searching && forYou ? (
          <ForYouCard item={forYou} navigation={navigation} />
        ) : null}

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
          <Pressable
            onPress={() => setAssistantOpen(true)}
            hitSlop={8}
            style={styles.aiBtn}
          >
            <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>

        {searching ? (
          <SearchResults query={q} results={results} navigation={navigation} />
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
                  status={statusByGroup[g.id] && statusByGroup[g.id].text}
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

      <AssistantPanel visible={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </Screen>
  );
}

function ForYouCard({ item, navigation }) {
  const urgent = item.tone === 'urgent';
  return (
    <Pressable
      onPress={() => navigation.navigate(item.target.screen, item.target.params)}
      style={({ pressed }) => [
        styles.forYou,
        urgent && styles.forYouUrgent,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.forYouIcon, urgent && styles.forYouIconUrgent]}>
        <Ionicons name={item.icon} size={20} color={urgent ? colors.onPrimary : colors.onPrimary} />
      </View>
      <View style={styles.forYouBody}>
        <Text style={styles.forYouLabel}>FOR YOU</Text>
        <Text style={styles.forYouTitle} numberOfLines={2}>{item.title}</Text>
        {item.subtitle ? <Text style={styles.forYouSub} numberOfLines={1}>{item.subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

// Renders `text` with each case-insensitive occurrence of `query` emphasized
// (bold ink) against the muted body — a monochrome search highlight.
function Highlight({ text, query, style, numberOfLines }) {
  if (!text) return null;
  const runs = [];
  const low = text.toLowerCase();
  const qlow = (query || '').toLowerCase();
  if (qlow) {
    let i = 0;
    while (i < text.length) {
      const idx = low.indexOf(qlow, i);
      if (idx < 0) {
        runs.push({ t: text.slice(i), h: false });
        break;
      }
      if (idx > i) runs.push({ t: text.slice(i, idx), h: false });
      runs.push({ t: text.slice(idx, idx + query.length), h: true });
      i = idx + query.length;
    }
  } else {
    runs.push({ t: text, h: false });
  }
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {runs.map((r, k) => (r.h ? <Text key={k} style={styles.hl}>{r.t}</Text> : r.t))}
    </Text>
  );
}

function ResultRow({ icon, title, snippet, query, meta, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.msgRow, pressed && styles.pressed]}
    >
      <View style={styles.msgIcon}>
        <Ionicons name={icon} size={18} color={colors.inkSoft} />
      </View>
      <View style={styles.msgBody}>
        <Text style={styles.msgText} numberOfLines={1}>{title}</Text>
        {snippet ? (
          <Highlight text={snippet} query={query} style={styles.msgSnippet} numberOfLines={2} />
        ) : null}
        {meta ? <Text style={styles.msgMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

function SearchResults({ query, results, navigation }) {
  const { groups, messages, files, votes, people } = results;
  const total =
    groups.length + messages.length + files.length + votes.length + people.length;

  if (total === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="search-outline" size={28} color={colors.muted} />
        <Text style={styles.emptySub}>No matches for “{query}”.</Text>
      </View>
    );
  }

  const toFeed = (groupId, groupName) => navigation.navigate('Feed', { groupId, groupName });

  return (
    <>
      {groups.length ? (
        <>
          <SectionLabel style={styles.section}>Groups</SectionLabel>
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} onPress={() => toFeed(g.id, g.name)} />
          ))}
        </>
      ) : null}

      {messages.length ? (
        <>
          <SectionLabel style={styles.section}>Messages</SectionLabel>
          {messages.map((m) => (
            <ResultRow
              key={m.id}
              icon="chatbubble-ellipses-outline"
              title={m.groupName}
              snippet={m.snippet}
              query={query}
              meta={`${m.author_name || 'Member'} · ${fmtDate(m.created_at)}`}
              onPress={() => toFeed(m.group_id, m.groupName)}
            />
          ))}
        </>
      ) : null}

      {files.length ? (
        <>
          <SectionLabel style={styles.section}>Files & media</SectionLabel>
          {files.map((f) => (
            <ResultRow
              key={f.id}
              icon={f.attachment_type === 'image' ? 'image-outline' : 'document-outline'}
              title={f.attachment_name || 'Attachment'}
              snippet={f.snippet}
              query={query}
              meta={`${f.groupName} · ${fmtDate(f.created_at)}`}
              onPress={() => toFeed(f.group_id, f.groupName)}
            />
          ))}
        </>
      ) : null}

      {votes.length ? (
        <>
          <SectionLabel style={styles.section}>Votes</SectionLabel>
          {votes.map((v) => (
            <ResultRow
              key={v.id}
              icon="bar-chart-outline"
              title={v.question}
              meta={`${v.groupName} · ${v.status === 'open' ? 'Open' : 'Closed'}`}
              onPress={() => navigation.navigate('VoteDetail', { voteId: v.id, groupName: v.groupName })}
            />
          ))}
        </>
      ) : null}

      {people.length ? (
        <>
          <SectionLabel style={styles.section}>People</SectionLabel>
          {people.map((p) => (
            <ResultRow
              key={p.key}
              icon="person-outline"
              title={p.you ? `${p.name} (you)` : p.name}
              meta={p.groupName}
              onPress={() => navigation.navigate('Members', { groupId: p.groupId, groupName: p.groupName })}
            />
          ))}
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
  forYou: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  forYouUrgent: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  forYouIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forYouIconUrgent: { backgroundColor: colors.accent },
  forYouBody: { flex: 1 },
  forYouLabel: { ...type.label, fontSize: 10, color: colors.muted, marginBottom: 2 },
  forYouTitle: { ...type.bodyStrong, color: colors.ink },
  forYouSub: { ...type.caption, color: colors.muted, marginTop: 2 },
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
  aiBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  msgText: { ...type.bodyStrong, color: colors.ink },
  msgSnippet: { ...type.caption, color: colors.muted, marginTop: 2, lineHeight: 18 },
  hl: { ...type.caption, color: colors.ink, fontWeight: '700' },
  msgMeta: { ...type.caption, color: colors.muted, marginTop: 3, fontSize: 11 },
});
