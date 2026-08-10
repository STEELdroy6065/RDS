import { supabase } from './supabase';

// Real cross-entity search, scoped (via RLS) to the groups the user belongs to.
// Returns matches grouped by type: groups, messages, files, votes, people.
// Used by the Home search bar; the assistant has its own server-side copy.

function likePattern(q) {
  // Escape LIKE metacharacters so a literal % or _ doesn't act as a wildcard.
  return `%${q.replace(/[\\%_]/g, '\\$&')}%`;
}

async function safe(promise) {
  try {
    const { data } = await promise;
    return data || [];
  } catch {
    return [];
  }
}

const EMPTY = { groups: [], messages: [], files: [], votes: [], people: [] };

export async function searchAll(rawQuery, { groups = [], user } = {}) {
  const q = (rawQuery || '').trim();
  if (!q) return EMPTY;

  const low = q.toLowerCase();
  const nameById = {};
  groups.forEach((g) => (nameById[g.id] = g.name));
  const groupIds = groups.map((g) => g.id);

  // Groups match locally by name.
  const groupHits = groups.filter((g) => g.name.toLowerCase().includes(low));

  if (groupIds.length === 0) return { ...EMPTY, groups: groupHits };

  const pattern = likePattern(q);

  const [msgRows, fileRows, voteRows, peopleRows] = await Promise.all([
    safe(
      supabase
        .from('posts')
        .select('id, group_id, author_name, text, created_at')
        .in('group_id', groupIds)
        .eq('deleted', false)
        .ilike('text', pattern)
        .order('created_at', { ascending: false })
        .limit(20)
    ),
    safe(
      supabase
        .from('posts')
        .select('id, group_id, author_name, attachment_name, attachment_type, attachment_url, created_at')
        .in('group_id', groupIds)
        .eq('deleted', false)
        .ilike('attachment_name', pattern)
        .order('created_at', { ascending: false })
        .limit(20)
    ),
    safe(
      supabase
        .from('votes')
        .select('id, group_id, question, status, created_at')
        .in('group_id', groupIds)
        .ilike('question', pattern)
        .order('created_at', { ascending: false })
        .limit(20)
    ),
    safe(
      supabase
        .from('posts')
        .select('group_id, author_name')
        .in('group_id', groupIds)
        .ilike('author_name', pattern)
        .limit(60)
    ),
  ]);

  const withGroup = (rows) =>
    rows.map((r) => ({ ...r, groupName: nameById[r.group_id] || 'Group' }));

  // People: distinct (name, group) from post authors, plus the user themselves.
  const seen = new Set();
  const people = [];
  if (user && user.name && user.name.toLowerCase().includes(low)) {
    groups.forEach((g) => {
      const key = `${user.name}::${g.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        people.push({ key, name: user.name, groupId: g.id, groupName: g.name, you: true });
      }
    });
  }
  peopleRows.forEach((r) => {
    if (!r.author_name) return;
    const key = `${r.author_name}::${r.group_id}`;
    if (seen.has(key)) return;
    seen.add(key);
    people.push({
      key,
      name: r.author_name,
      groupId: r.group_id,
      groupName: nameById[r.group_id] || 'Group',
    });
  });

  return {
    groups: groupHits,
    messages: withGroup(msgRows),
    files: withGroup(fileRows),
    votes: withGroup(voteRows),
    people: people.slice(0, 20),
  };
}
