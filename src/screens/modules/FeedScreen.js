import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import Header from '../../components/Header';
import { colors, spacing, radius, type, shadow } from '../../theme';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { notify } from '../../lib/confirm';

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
  const { user } = useSession();
  const { roleForGroup } = useGroups();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Report modal state.
  const [reportPost, setReportPost] = useState(null);
  const [reason, setReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const role = roleForGroup(groupId);
  const isModerator = role === 'Admin' || role === 'Captain';

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

  function openReport(post) {
    setReportPost(post);
    setReason('');
  }

  async function submitReport() {
    if (!reportPost || reporting) return;
    setReporting(true);
    const { error } = await supabase.from('post_reports').insert({
      post_id: reportPost.id,
      reported_by: user.id,
      reason: reason.trim() || null,
    });
    setReporting(false);
    setReportPost(null);
    if (error) {
      notify({ title: 'Could not send report', message: error.message });
    } else {
      notify({ title: 'Thanks for the report', message: 'A group Admin or Captain will review it.' });
    }
  }

  return (
    <Screen>
      <Header
        title="Feed"
        subtitle={groupName}
        onBack={() => navigation.goBack()}
        right={
          isModerator ? (
            <Pressable
              onPress={() => navigation.navigate('ReportedPosts', { groupId, groupName })}
              hitSlop={10}
              style={({ pressed }) => [styles.modBtn, pressed && styles.pressed]}
            >
              <Ionicons name="flag" size={18} color={colors.accent} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
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
            <Text style={styles.emptyTitle}>{loading ? 'Loading…' : 'No posts yet'}</Text>
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
                <Pressable
                  onPress={() => openReport(p)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
                </Pressable>
              </View>
              <Text style={styles.text}>{p.text}</Text>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Report modal */}
      <Modal
        visible={!!reportPost}
        transparent
        animationType="fade"
        onRequestClose={() => setReportPost(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setReportPost(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetIcon}>
              <Ionicons name="flag" size={22} color={colors.accent} />
            </View>
            <Text style={styles.sheetTitle}>Report this post</Text>
            <Text style={styles.sheetSub}>
              Let the group’s Admin or Captain know. You can add a short reason
              (optional).
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.muted}
              style={styles.reasonInput}
              multiline
            />
            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => setReportPost(null)}
                style={({ pressed }) => [styles.sheetBtn, styles.sheetCancel, pressed && styles.pressed]}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitReport}
                disabled={reporting}
                style={({ pressed }) => [styles.sheetBtn, styles.sheetReport, pressed && styles.pressed]}
              >
                <Text style={styles.sheetReportText}>
                  {reporting ? 'Sending…' : 'Report'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  modBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
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
  post: { marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  headBody: { flex: 1, marginLeft: spacing.md },
  author: { ...type.bodyStrong, color: colors.ink },
  time: { ...type.caption, color: colors.muted, marginTop: 1 },
  moreBtn: { paddingLeft: 6, marginLeft: 6 },
  text: { ...type.body, color: colors.inkSoft, lineHeight: 21 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(27,26,46,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  sheetIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: { ...type.title, fontSize: 19, color: colors.ink },
  sheetSub: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  reasonInput: {
    ...type.body,
    color: colors.ink,
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 64,
    textAlignVertical: 'top',
    marginTop: spacing.lg,
  },
  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, alignSelf: 'stretch' },
  sheetBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  sheetCancel: { backgroundColor: colors.surfaceAlt },
  sheetCancelText: { ...type.bodyStrong, color: colors.inkSoft },
  sheetReport: { backgroundColor: colors.accent },
  sheetReportText: { ...type.bodyStrong, color: colors.onPrimary },
});
