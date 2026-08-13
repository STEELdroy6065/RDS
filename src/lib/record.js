import { supabase } from './supabase';

// Builds a student's portable participation record from attendance (+ votes for
// one's own record) and the latest school verification. All reads are RLS
// scoped: participants and a linked guardian may build a student's record.

// Ordered attendance series (oldest → newest) of P/L/A/E for a student, plus a
// tally, rate, streak and session count.
async function attendanceSeries(groupId, studentId) {
  const empty = { series: [], tally: { P: 0, L: 0, A: 0, E: 0 }, rate: null, streak: 0, sessions: 0 };
  try {
    const { data: recs } = await supabase
      .from('attendance_records')
      .select('id, date')
      .eq('group_id', groupId)
      .eq('status', 'submitted')
      .order('date', { ascending: true });
    const ids = (recs || []).map((r) => r.id);
    if (!ids.length) return empty;

    const { data: entries } = await supabase
      .from('attendance_entries')
      .select('record_id, status, present')
      .eq('user_id', studentId)
      .in('record_id', ids);
    const byRecord = {};
    (entries || []).forEach((e) => {
      byRecord[e.record_id] = e.status || (e.present ? 'P' : 'A');
    });

    const series = (recs || [])
      .map((r) => ({ date: r.date, status: byRecord[r.id] || null }))
      .filter((d) => d.status);

    const tally = { P: 0, L: 0, A: 0, E: 0 };
    series.forEach((d) => {
      if (tally[d.status] != null) tally[d.status] += 1;
    });
    const attended = tally.P + tally.L;
    const counted = tally.P + tally.L + tally.A;
    const rate = counted > 0 ? Math.round((attended / counted) * 100) : null;

    // Streak counts from the most recent day backwards.
    let streak = 0;
    for (let i = series.length - 1; i >= 0; i--) {
      const s = series[i].status;
      if (s === 'P' || s === 'L') streak += 1;
      else if (s === 'E') continue;
      else break;
    }

    return { series, tally, rate, streak, sessions: series.length };
  } catch {
    return empty;
  }
}

// Count votes this user has cast in the group (own record only — ballots for
// other users may be hidden by anonymity RLS).
async function votesCast(groupId, studentId) {
  try {
    const { data: votes } = await supabase.from('votes').select('id').eq('group_id', groupId);
    const ids = (votes || []).map((v) => v.id);
    if (!ids.length) return 0;
    const { count } = await supabase
      .from('vote_ballots')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', studentId)
      .in('vote_id', ids);
    return count || 0;
  } catch {
    return null;
  }
}

// How many Captain terms this student has held in the group (from the
// captain_terms history written when an election is closed).
async function captainTerms(groupId, studentId) {
  try {
    const { count } = await supabase
      .from('captain_terms')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('user_id', studentId);
    return count || 0;
  } catch {
    return 0;
  }
}

export async function fetchVerification(groupId, studentId) {
  try {
    const { data } = await supabase
      .from('record_verifications')
      .select('verified_by_name, note, verified_at')
      .eq('group_id', groupId)
      .eq('student_id', studentId)
      .order('verified_at', { ascending: false })
      .limit(1);
    return (data && data[0]) || null;
  } catch {
    return null;
  }
}

// Assemble the full record. `self` enables the votes tile (own record only).
export async function buildRecord(groupId, studentId, { self = false } = {}) {
  const [att, verification, votes, terms] = await Promise.all([
    attendanceSeries(groupId, studentId),
    fetchVerification(groupId, studentId),
    self ? votesCast(groupId, studentId) : Promise.resolve(null),
    captainTerms(groupId, studentId),
  ]);
  return { ...att, votes, captainTerms: terms, verification };
}

export async function verifyRecord({ groupId, studentId, name, note }) {
  const { data, error } = await supabase.rpc('verify_record', {
    gid: groupId,
    student_uid: studentId,
    lname: name || null,
    lnote: note || null,
  });
  if (error) throw error;
  return data;
}

// A plain-text version of the record for the native Share sheet.
export function recordAsText({ studentName, groupName, record }) {
  const { rate, sessions, tally, streak, verification } = record;
  const lines = [
    `Participation record — ${studentName || 'Student'}`,
    groupName ? `Group: ${groupName}` : null,
    '',
    `Attendance: ${rate == null ? '—' : rate + '%'} across ${sessions} session${sessions === 1 ? '' : 's'}`,
    `Present ${tally.P} · Late ${tally.L} · Absent ${tally.A} · Excused ${tally.E}`,
    `Current streak: ${streak} day${streak === 1 ? '' : 's'}`,
    verification
      ? `Verified by ${verification.verified_by_name || 'the school'} on ${new Date(
          verification.verified_at
        ).toLocaleDateString()}`
      : 'Not yet verified',
    '',
    'Shared from RDS',
  ];
  return lines.filter((l) => l !== null).join('\n');
}
