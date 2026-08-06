import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import Header from '../../components/Header';
import { colors, spacing, radius, type } from '../../theme';
import { supabase } from '../../lib/supabase';
import { confirm, notify } from '../../lib/confirm';

const TYPE_TONE = {
  Announcement: 'accent',
  Resource: 'info',
  Discussion: 'primary',
};

export default function ReportedPostsScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const [items, setItems] = useState([]); // [{ post, reports: [] }]
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('post_reports')
      .select('id, reason, created_at, post:posts!inner(id, text, type, author_name, group_id)')
      .eq('post.group_id', groupId)
      .order('created_at', { ascending: false });

    if (!error) {
      const byPost = new Map();
      (data || []).forEach((r) => {
        if (!r.post) return;
        if (!byPost.has(r.post.id)) byPost.set(r.post.id, { post: r.post, reports: [] });
        byPost.get(r.post.id).reports.push({ id: r.id, reason: r.reason });
      });
      setItems(Array.from(byPost.values()));
    }
    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function onRemove(post) {
    confirm({
      title: 'Remove this post?',
      message: 'It will be deleted from the feed for everyone. This can’t be undone.',
      confirmLabel: 'Remove post',
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('posts').delete().eq('id', post.id);
        if (error) {
          notify({ title: 'Could not remove the post', message: error.message });
        } else {
          load();
        }
      },
    });
  }

  return (
    <Screen>
      <Header title="Reported posts" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        {items.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="shield-checkmark" size={28} color={colors.success} />
            <Text style={styles.emptyTitle}>
              {loading ? 'Loading…' : 'Nothing reported'}
            </Text>
            {!loading ? (
              <Text style={styles.emptySub}>
                Reports from members will show up here for you to review.
              </Text>
            ) : null}
          </Card>
        ) : (
          items.map(({ post, reports }) => (
            <Card key={post.id} style={styles.item}>
              <View style={styles.head}>
                <Avatar name={post.author_name || 'Member'} size={34} />
                <Text style={styles.author}>{post.author_name || 'Group member'}</Text>
                <Badge label={post.type} tone={TYPE_TONE[post.type] || 'neutral'} />
              </View>
              <Text style={styles.text}>{post.text}</Text>

              <View style={styles.reportsBox}>
                <Text style={styles.reportsLabel}>
                  {reports.length} {reports.length === 1 ? 'report' : 'reports'}
                </Text>
                {reports
                  .filter((r) => r.reason && r.reason.trim())
                  .map((r) => (
                    <Text key={r.id} style={styles.reason}>
                      “{r.reason.trim()}”
                    </Text>
                  ))}
              </View>

              <Pressable
                onPress={() => onRemove(post)}
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={16} color={colors.accent} />
                <Text style={styles.removeText}>Remove post</Text>
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...type.heading, color: colors.ink },
  emptySub: { ...type.caption, color: colors.muted, textAlign: 'center' },
  item: { marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  author: { ...type.bodyStrong, color: colors.ink, flex: 1, marginLeft: spacing.md },
  text: { ...type.body, color: colors.inkSoft, lineHeight: 21 },
  reportsBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  reportsLabel: { ...type.label, color: colors.accent },
  reason: { ...type.caption, color: colors.inkSoft, marginTop: 6, fontStyle: 'italic' },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  removeText: { ...type.bodyStrong, fontSize: 13, color: colors.accent },
  pressed: { opacity: 0.8 },
});
