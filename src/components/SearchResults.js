import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GroupCard from './GroupCard';
import SectionLabel from './SectionLabel';
import { colors, spacing, radius, type } from '../theme';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

// Renders `text` with each case-insensitive occurrence of `query` emphasized.
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.msgRow, pressed && styles.pressed]}>
      <View style={styles.msgIcon}>
        <Ionicons name={icon} size={18} color={colors.inkSoft} />
      </View>
      <View style={styles.msgBody}>
        <Text style={styles.msgText} numberOfLines={1}>{title}</Text>
        {snippet ? <Highlight text={snippet} query={query} style={styles.msgSnippet} numberOfLines={2} /> : null}
        {meta ? <Text style={styles.msgMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

// Cross-entity search results (groups, messages, files, votes, people).
export default function SearchResults({ query, results, navigation, onOpenGroup }) {
  const { groups, messages, files, votes, people } = results;
  const total = groups.length + messages.length + files.length + votes.length + people.length;

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
            <GroupCard key={g.id} group={g} onPress={() => onOpenGroup(g)} />
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
  emptySub: { ...type.caption, color: colors.muted, marginTop: 4, textAlign: 'center' },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pressed: { opacity: 0.6 },
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
