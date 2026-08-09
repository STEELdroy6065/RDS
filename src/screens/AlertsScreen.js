import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import Pulse from '../components/Pulse';
import { useStatusBar } from '../components/useStatusBar';
import { colors, spacing, radius, type } from '../theme';
import { useNotifications } from '../state/notifications';
import { useGroups } from '../state/groups';

const TYPE_META = {
  new_vote: { icon: 'bar-chart-outline', bg: colors.surfaceAlt, fg: colors.inkSoft, label: 'Vote' },
  new_announcement: { icon: 'megaphone-outline', bg: colors.surfaceAlt, fg: colors.inkSoft, label: 'Announcement' },
  attendance_missed: { icon: 'alert-circle-outline', bg: colors.surfaceAlt, fg: colors.inkSoft, label: 'Attendance' },
  post_reported: { icon: 'flag-outline', bg: colors.accentSoft, fg: colors.accent, label: 'Report' },
};

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

export default function AlertsScreen({ navigation }) {
  useStatusBar('dark');
  const { items, loading, unreadCount, refresh, markRead, markAllRead } = useNotifications();
  const { getGroup } = useGroups();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  function open(n) {
    if (!n.read) markRead(n.id);
    const group = getGroup(n.group_id);
    const groupName = group ? group.name : 'Group';
    switch (n.type) {
      case 'new_vote':
        if (n.entity_id) navigation.navigate('VoteDetail', { voteId: n.entity_id, groupName });
        else navigation.navigate('Votes', { groupId: n.group_id, groupName });
        break;
      case 'new_announcement':
        navigation.navigate('Feed', { groupId: n.group_id, groupName });
        break;
      case 'attendance_missed':
        navigation.navigate('Attendance', { groupId: n.group_id, groupName });
        break;
      case 'post_reported':
        navigation.navigate('ReportedPosts', { groupId: n.group_id, groupName });
        break;
      default:
        break;
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.head}>
          <View style={styles.headLeft}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.ink} />
            </Pressable>
            <Text style={styles.title}>Alerts</Text>
          </View>
          <View style={styles.headRight}>
            {unreadCount > 0 ? (
              <Pressable onPress={markAllRead} hitSlop={8}>
                <Text style={styles.markAll}>Mark all read</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={30} color={colors.muted} />
            <Text style={styles.emptyText}>
              {loading ? 'Loading…' : 'No alerts yet'}
            </Text>
          </View>
        ) : (
          items.map((n, i) => {
            const meta = TYPE_META[n.type] || TYPE_META.new_announcement;
            const group = getGroup(n.group_id);
            return (
              <Pressable
                key={n.id}
                onPress={() => open(n)}
                style={({ pressed }) => [
                  styles.row,
                  i < items.length - 1 && styles.rowBorder,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.icon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.fg} />
                </View>
                <View style={styles.body}>
                  <Text style={[styles.message, !n.read && styles.messageUnread]} numberOfLines={2}>
                    {n.message}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {group ? group.name : meta.label}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.time}>{relTime(n.created_at)}</Text>
                  {!n.read ? <Pulse color={colors.accent} size={7} /> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  back: { marginLeft: -6 },
  title: { ...type.display, color: colors.ink },
  headRight: { flexDirection: 'row', alignItems: 'center' },
  markAll: { ...type.bodyStrong, fontSize: 13, color: colors.primary },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...type.body, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  pressed: { opacity: 0.7 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  message: { ...type.body, color: colors.inkSoft, lineHeight: 19 },
  messageUnread: { ...type.bodyStrong, color: colors.ink },
  meta: { ...type.caption, color: colors.muted, marginTop: 3 },
  right: { alignItems: 'flex-end', gap: 6 },
  time: { ...type.caption, color: colors.muted, fontSize: 11 },
});
