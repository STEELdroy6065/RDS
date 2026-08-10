import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { colors, spacing, radius, type } from '../../theme';
import { supabase } from '../../lib/supabase';

const URL_RE = /(https?:\/\/[^\s]+)/gi;
const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i;

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

// Build the Media (images) and Links lists from the feed, newest first.
// Media = uploaded image attachments + image URLs pasted in text.
// Links = every other URL shared in text.
function extract(posts) {
  const media = [];
  const links = [];
  posts.forEach((p) => {
    // Uploaded image attachments.
    if (p.attachment_type === 'image' && p.attachment_url) {
      media.push({
        key: `${p.id}-att`,
        url: p.attachment_url,
        author: p.author_name || 'Group member',
        created_at: p.created_at,
      });
    }
    // URLs shared in the message body.
    const found = (p.text || '').match(URL_RE);
    if (found) {
      found.forEach((url, idx) => {
        const entry = {
          key: `${p.id}-${idx}`,
          url: url.replace(/[).,]+$/, ''), // trim trailing punctuation
          author: p.author_name || 'Group member',
          created_at: p.created_at,
        };
        if (IMAGE_RE.test(entry.url)) media.push(entry);
        else links.push(entry);
      });
    }
  });
  return { media, links };
}

function open(url) {
  Linking.openURL(url).catch(() => {});
}

export default function MediaLinksScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('media');

  const load = useCallback(async () => {
    // Full select first; fall back if the attachments migration isn't in yet.
    const FULL = 'id, text, author_name, created_at, attachment_url, attachment_type';
    const BASE = 'id, text, author_name, created_at';
    let { data, error } = await supabase
      .from('posts')
      .select(FULL)
      .eq('group_id', groupId)
      .eq('deleted', false)
      .order('created_at', { ascending: false });
    if (error) {
      const retry = await supabase
        .from('posts')
        .select(BASE)
        .eq('group_id', groupId)
        .eq('deleted', false)
        .order('created_at', { ascending: false });
      data = retry.data;
    }
    setPosts(data || []);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const { media, links } = useMemo(() => extract(posts), [posts]);

  return (
    <Screen>
      <Header title="Media & links" subtitle={groupName} onBack={() => navigation.goBack()} />

      <View style={styles.tabs}>
        <Tab label={`Media${media.length ? ` · ${media.length}` : ''}`} active={tab === 'media'} onPress={() => setTab('media')} />
        <Tab label={`Links${links.length ? ` · ${links.length}` : ''}`} active={tab === 'links'} onPress={() => setTab('links')} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'media' ? (
          media.length === 0 ? (
            <Empty icon="image-outline" text="No images shared yet." />
          ) : (
            <View style={styles.grid}>
              {media.map((m) => (
                <Pressable key={m.key} onPress={() => open(m.url)} style={styles.thumbWrap}>
                  <Image source={{ uri: m.url }} style={styles.thumb} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          )
        ) : links.length === 0 ? (
          <Empty icon="link-outline" text="No links shared yet." />
        ) : (
          links.map((l, i) => (
            <Pressable
              key={l.key}
              onPress={() => open(l.url)}
              style={({ pressed }) => [
                styles.linkRow,
                i < links.length - 1 && styles.linkBorder,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.linkIcon}>
                <Ionicons name="link" size={18} color={colors.inkSoft} />
              </View>
              <View style={styles.linkBody}>
                <Text style={styles.linkUrl} numberOfLines={1}>{l.url}</Text>
                <Text style={styles.linkMeta} numberOfLines={1}>
                  {l.author} · {relTime(l.created_at)}
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function Tab({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ icon, text }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={30} color={colors.muted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...type.bodyStrong, fontSize: 14, color: colors.inkSoft },
  tabTextActive: { color: colors.onPrimary },

  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: {
    width: '31.8%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: '100%', height: '100%' },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  linkBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  pressed: { opacity: 0.6 },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBody: { flex: 1 },
  linkUrl: { ...type.body, color: colors.ink },
  linkMeta: { ...type.caption, color: colors.muted, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { ...type.body, color: colors.muted },
});
