import { supabase } from './supabase';
import { localDateStr } from '../state/attendance';

// Builds a weekly teacher digest for a group from attendance — computed, not
// AI-guessed, so the numbers are trustworthy. Names three students who need a
// word, shows the class trend, and holds the teacher accountable for missed
// rolls. All reads are RLS-scoped (moderators see the whole group).

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

function rateOf(present, total) {
  return total > 0 ? Math.round((present / total) * 100) : null;
}

// members: [{ id, name }] from the group roster (for real names).
export async function buildDigest(groupId, members = []) {
  const nameById = {};
  members.forEach((m) => (nameById[m.id] = m.name));

  const weekStart = daysAgoStr(6); // last 7 days incl. today
  const prevStart = daysAgoStr(13);
  const prevEnd = daysAgoStr(7);

  const empty = {
    weekLabel: 'This week',
    classRate: null,
    prevRate: null,
    delta: null,
    bars: [],
    flags: [],
    accountability: null,
    sessions: 0,
  };

  try {
    // Records over the last two weeks (to compare) — submitted + missed.
    const { data: recs } = await supabase
      .from('attendance_records')
      .select('id, date, status, present_count, total_count, marked_by_name')
      .eq('group_id', groupId)
      .gte('date', prevStart)
      .order('date', { ascending: true });
    const records = recs || [];
    if (!records.length) return empty;

    const thisWeek = records.filter((r) => r.date >= weekStart);
    const prevWeek = records.filter((r) => r.date >= prevStart && r.date <= prevEnd);

    // Class attendance rate = mean of each submitted roll's present/total.
    const meanRate = (rows) => {
      const rs = rows
        .filter((r) => r.status === 'submitted' && r.total_count > 0)
        .map((r) => (r.present_count / r.total_count) * 100);
      if (!rs.length) return null;
      return Math.round(rs.reduce((a, b) => a + b, 0) / rs.length);
    };
    const classRate = meanRate(thisWeek);
    const prevRate = meanRate(prevWeek);
    const delta = classRate != null && prevRate != null ? classRate - prevRate : null;

    // Daily bars for this week's submitted rolls.
    const bars = thisWeek
      .filter((r) => r.status === 'submitted' && r.total_count > 0)
      .map((r) => ({ date: r.date, rate: rateOf(r.present_count, r.total_count) }));

    // Per-student flags from this week's entries.
    const thisIds = thisWeek.map((r) => r.id);
    let entries = [];
    if (thisIds.length) {
      const { data } = await supabase
        .from('attendance_entries')
        .select('record_id, user_id, member_name, status, present')
        .in('record_id', thisIds);
      entries = data || [];
    }

    // Approved leave this week, to suppress "no leave sent".
    let leaveByUser = new Set();
    try {
      const { data: lv } = await supabase
        .from('leave_requests')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('status', 'approved')
        .gte('date', weekStart);
      (lv || []).forEach((l) => leaveByUser.add(l.user_id));
    } catch {
      /* leave migration may not be run */
    }

    const byStudent = {};
    entries.forEach((e) => {
      const s = e.status || (e.present ? 'P' : 'A');
      const rec = (byStudent[e.user_id] = byStudent[e.user_id] || {
        id: e.user_id,
        name: nameById[e.user_id] || e.member_name || 'Member',
        P: 0, L: 0, A: 0, E: 0, n: 0,
      });
      if (rec[s] != null) rec[s] += 1;
      rec.n += 1;
    });

    const flags = [];
    Object.values(byStudent).forEach((r) => {
      if (r.A >= 2) {
        const noLeave = !leaveByUser.has(r.id);
        flags.push({
          id: r.id,
          name: r.name,
          tone: 'urgent',
          weight: 100 + r.A,
          text: `${r.A} absence${r.A === 1 ? '' : 's'} this week${noLeave ? ', no leave sent' : ''}`,
        });
      } else if (r.L >= 2) {
        flags.push({
          id: r.id,
          name: r.name,
          tone: 'warn',
          weight: 50 + r.L,
          text: `Late ${r.L} of ${r.n} session${r.n === 1 ? '' : 's'}`,
        });
      }
    });
    flags.sort((a, b) => b.weight - a.weight);
    const topFlags = flags.slice(0, 5);

    // Accountability: rolls this week the teacher didn't open (a Captain
    // covered — those records carry a "missed_*" status).
    const missed = thisWeek.filter((r) => r.status && r.status.startsWith('missed'));
    let accountability = null;
    if (missed.length) {
      const who = [...new Set(missed.map((r) => r.marked_by_name).filter(Boolean))].join(', ');
      accountability = {
        tone: 'warn',
        title: `You missed opening the roll ${missed.length} time${missed.length === 1 ? '' : 's'}`,
        sub: who
          ? `${who} covered. Nothing was lost — but the class noticed.`
          : 'A Captain covered. Nothing was lost — but the class noticed.',
      };
    } else if (thisWeek.some((r) => r.status === 'submitted')) {
      accountability = {
        tone: 'ok',
        title: 'You opened every roll this week',
        sub: 'Consistent check-ins keep the cascade quiet.',
      };
    }

    return {
      weekLabel: 'Last 7 days',
      classRate,
      prevRate,
      delta,
      bars,
      flags: topFlags,
      accountability,
      sessions: thisWeek.filter((r) => r.status === 'submitted').length,
    };
  } catch {
    return empty;
  }
}

export function digestAsText({ groupName, digest }) {
  const { classRate, delta, flags, accountability, sessions } = digest;
  const lines = [
    `Weekly digest — ${groupName || 'Group'}`,
    '',
    `Class attendance: ${classRate == null ? '—' : classRate + '%'}${
      delta == null ? '' : ` (${delta >= 0 ? '+' : ''}${delta} pts on last week)`
    } across ${sessions} session${sessions === 1 ? '' : 's'}`,
    '',
    flags.length ? 'Students to check in with:' : 'No students flagged this week.',
    ...flags.map((f) => `• ${f.name} — ${f.text}`),
  ];
  if (accountability) {
    lines.push('', accountability.title + '.');
  }
  lines.push('', 'Shared from RDS');
  return lines.join('\n');
}
