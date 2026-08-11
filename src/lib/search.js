import { supabase } from './supabase';

// Real cross-entity search, scoped (via RLS) to the groups the user belongs to.
// Matches: group names, message text, file/image names AND their extracted
// contents (OCR / parsed text), vote questions, and people. Content/message
// hits carry a snippet around the match for the UI to highlight.
// Used by the Home search bar; the assistant has its own server-side tools.

function likePattern(q) {
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

// A windowed excerpt around the first match of `q` in `textStr`.
export function makeSnippet(textStr, q) {
  if (!textStr) return '';
  const clean = String(textStr).replace(/\s+/g, ' ').trim();
  const idx = clean.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return clean.slice(0, 120);
  const start = Math.max(0, idx - 40);
  const end = Math.min(clean.length, idx + q.length + 80);
  return (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
}

const EMPTY = { groups: [], messages: [], files: [], votes: [], people: [] };

export async function searchAll(rawQuery, { groups = [], user } = {}) {
  const q = (rawQuery || '').trim();
  if (!q) return EMPTY;

  const low = q.toLowerCase();
  const nameById = {};
  groups.forEach((g) => (nameById[g.id] = g.name));
  const groupIds = groups.map((g) => g.id);

  const groupHits = groups.filter((g) => g.name.toLowerCase().includes(low));
  if (groupIds.length === 0) return { ...EMPTY, groups: groupHits };

  const pattern = likePattern(q);
  // Filename query never selects attachment_text, so it can't break if the
  // extraction migration hasn't been run. Only the content query references it,
  // and that one degrades gracefully (safe() → []) when the column is absent.
  const FILE_BASE =
    'id, group_id, author_name, attachment_name, attachment_type, attachment_url, created_at';
  const FILE_WITH_TEXT = `${FILE_BASE}, attachment_text`;

  const [msgRows, fileByName, fileByContent, voteRows, peopleRows] = await Promise.all([
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
        .select(FILE_BASE)
        .in('group_id', groupIds)
        .eq('deleted', false)
        .ilike('attachment_name', pattern)
        .order('created_at', { ascending: false })
        .limit(20)
    ),
    safe(
      supabase
        .from('posts')
        .select(FILE_WITH_TEXT)
        .in('group_id', groupIds)
        .eq('deleted', false)
        .ilike('attachment_text', pattern)
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

  const gname = (id) => nameById[id] || 'Group';

  const messages = msgRows.map((m) => ({
    ...m,
    groupName: gname(m.group_id),
    snippet: makeSnippet(m.text, q),
  }));

  // Merge file matches by name and by content; content match adds a snippet.
  const filesById = {};
  fileByName.forEach((f) => {
    filesById[f.id] = { ...f, groupName: gname(f.group_id), snippet: '' };
  });
  fileByContent.forEach((f) => {
    const snip = makeSnippet(f.attachment_text, q);
    if (filesById[f.id]) filesById[f.id].snippet = snip;
    else filesById[f.id] = { ...f, groupName: gname(f.group_id), snippet: snip };
  });
  const files = Object.values(filesById)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);

  const votes = voteRows.map((v) => ({ ...v, groupName: gname(v.group_id) }));

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
    people.push({ key, name: r.author_name, groupId: r.group_id, groupName: gname(r.group_id) });
  });

  return { groups: groupHits, messages, files, votes, people: people.slice(0, 20) };
}
