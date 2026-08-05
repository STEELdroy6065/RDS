import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import Header from '../../components/Header';
import { colors, spacing, radius, type, shadow } from '../../theme';
import { supabase } from '../../lib/supabase';

const TYPE_TONE = {
  Announcement: 'accent',
  Resource: 'info',
  Discussion: 'primary',
};

function relTime(iso) {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function FeedScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select('id, author_id, author_name, type, text, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (!error) setPosts(data || []);
    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <Header title="Feed" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        {/* New post — any member can post */}
        <Pressable
          onPress={() => navigation.navigate('NewPost', { groupId, groupName })}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
        >
          <View style={styles.plusCircle}>
            <Ionicons name="add" size={22} color={colors.onPrimary} />
          </View>
          <View style={styles.newBtnBody}>
            <Text style={styles.newBtnTitle}>New post</Text>
            <Text style={styles.newBtnSub}>Share an announcement, resource, or discussion</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        {posts.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {loading ? 'Loading…' : 'No posts yet'}
            </Text>
            {!loading ? (
              <Text style={styles.emptySub}>Be the first to post in this group.</Text>
            ) : null}
          </Card>
        ) : (
          posts.map((p) => (
            <Card key={p.id} style={styles.post}>
              <View style={styles.head}>
                <Avatar name={p.author_name || 'Member'} size={38} />
                <View style={styles.headBody}>
                  <Text style={styles.author}>{p.author_name || 'Group member'}</Text>
                  <Text style={styles.time}>{relTime(p.created_at)}</Text>
                </View>
                <Badge label={p.type} tone={TYPE_TONE[p.type] || 'neutral'} />
              </View>
              <Text style={styles.text}>{p.text}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  plusCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  newBtnBody: { flex: 1, marginLeft: spacing.md },
  newBtnTitle: { ...type.bodyStrong, color: colors.ink },
  newBtnSub: { ...type.caption, color: colors.muted, marginTop: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { ...type.heading, color: colors.ink },
  emptySub: { ...type.caption, color: colors.muted, marginTop: 4, textAlign: 'center' },
  post: {
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  author: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  time: {
    ...type.caption,
    color: colors.muted,
    marginTop: 1,
  },
  text: {
    ...type.body,
    color: colors.inkSoft,
    lineHeight: 21,
  },
});
