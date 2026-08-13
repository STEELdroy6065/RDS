import { supabase } from './supabase';
import { fetchMemberTermRecord } from '../state/attendance';

// Data helpers for the Attend / Chat / Record tabs, so each shows real content
// instead of an identical group list.

// Latest non-deleted post per group → { groupId: {author_name, text, type,
// created_at} }. Uses a base column set so it works even without the
// attachments migration.
export async function fetchLastMessages(groupIds = []) {
  if (!groupIds.length) return {};
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('group_id, author_name, text, type, created_at, deleted')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    const out = {};
    (data || []).forEach((p) => {
      if (p.deleted) return;
      if (!out[p.group_id]) out[p.group_id] = p;
    });
    return out;
  } catch {
    return {};
  }
}

// Per-group term record for one user → { groupId: {tally,total,rate,streak} }.
export async function fetchRecordsForGroups(groups = [], userId) {
  const out = {};
  await Promise.all(
    groups.map(async (g) => {
      out[g.id] = await fetchMemberTermRecord(g.id, userId);
    })
  );
  return out;
}

// Aggregate a set of per-group records into one headline figure.
export function aggregateRecords(records = {}) {
  let P = 0, L = 0, A = 0, sessions = 0, best = 0;
  Object.values(records).forEach((r) => {
    if (!r) return;
    P += r.tally.P;
    L += r.tally.L;
    A += r.tally.A;
    sessions += r.total;
    best = Math.max(best, r.streak);
  });
  const attended = P + L;
  const counted = P + L + A;
  return {
    rate: counted > 0 ? Math.round((attended / counted) * 100) : null,
    sessions,
    bestStreak: best,
    present: attended,
    absent: A,
  };
}
