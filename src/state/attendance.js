import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from './session';

// Attendance backed by Supabase. The "missed check-in" state is NOT stored — it
// is computed on read (past today's deadline + no record for today). Submitting
// or resolving simply inserts today's record.

const AttendanceContext = createContext(null);

// Permission helpers (roles come from the groups store).
export const canMarkAttendance = (role) => role === 'Admin';
export const receivesCascade = (role) => role === 'Captain';

// Local calendar date as YYYY-MM-DD (matches the `date` column).
export function localDateStr(d = new Date()) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Is the current local time at/after the group's "HH:MM" deadline?
export function isPastDeadline(deadline) {
  if (!deadline) return false;
  const [h, m] = deadline.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h)) return false;
  const now = new Date();
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= (m || 0));
}

// Four-state status metadata (Present / Late / Absent / Excused).
export const STATUS_ORDER = ['P', 'L', 'A', 'E'];
export const STATUS_LABEL = { P: 'Present', L: 'Late', A: 'Absent', E: 'Excused' };

// Compute a single member's record across a group's submitted rolls:
// the P/L/A/E tally, an attendance rate (excused days don't count against it),
// and the current present-streak (most-recent consecutive P/L days; excused
// days are skipped, an absence breaks it). Reads are RLS-scoped to members.
export async function fetchMemberTermRecord(groupId, userId) {
  const empty = { tally: { P: 0, L: 0, A: 0, E: 0 }, total: 0, rate: null, streak: 0 };
  try {
    const { data: recs } = await supabase
      .from('attendance_records')
      .select('id, date, status')
      .eq('group_id', groupId)
      .eq('status', 'submitted')
      .order('date', { ascending: false });
    const ids = (recs || []).map((r) => r.id);
    if (!ids.length) return empty;

    const { data: entries } = await supabase
      .from('attendance_entries')
      .select('record_id, status, present')
      .eq('user_id', userId)
      .in('record_id', ids);

    const byRecord = {};
    (entries || []).forEach((e) => {
      byRecord[e.record_id] = e.status || (e.present ? 'P' : 'A');
    });

    // Most-recent first, only days where this member has an entry.
    const days = (recs || [])
      .map((r) => byRecord[r.id])
      .filter(Boolean);

    const tally = { P: 0, L: 0, A: 0, E: 0 };
    days.forEach((s) => {
      if (tally[s] != null) tally[s] += 1;
    });
    const attended = tally.P + tally.L;
    const counted = tally.P + tally.L + tally.A; // excused excluded from the rate
    const rate = counted > 0 ? Math.round((attended / counted) * 100) : null;

    let streak = 0;
    for (const s of days) {
      if (s === 'P' || s === 'L') streak += 1;
      else if (s === 'E') continue;
      else break;
    }
    return { tally, total: days.length, rate, streak };
  } catch {
    return empty;
  }
}

export function AttendanceProvider({ children }) {
  const { user } = useSession();
  const [recordsByGroup, setRecordsByGroup] = useState({});
  const [loadingByGroup, setLoadingByGroup] = useState({});

  const refreshGroup = useCallback(async (groupId) => {
    setLoadingByGroup((prev) => ({ ...prev, [groupId]: true }));
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, group_id, date, marked_by, marked_by_name, status, present_count, total_count, created_at')
      .eq('group_id', groupId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error) {
      setRecordsByGroup((prev) => ({ ...prev, [groupId]: data || [] }));
    }
    setLoadingByGroup((prev) => ({ ...prev, [groupId]: false }));
  }, []);

  // Admin/Teacher submits today's roll.
  const submitAttendance = useCallback(
    async (groupId, { entries, presentCount, totalCount }) => {
      const { data: rec, error } = await supabase
        .from('attendance_records')
        .insert({
          group_id: groupId,
          date: localDateStr(),
          marked_by: user.id,
          marked_by_name: user.name,
          status: 'submitted',
          present_count: presentCount,
          total_count: totalCount,
        })
        .select()
        .single();
      if (error) throw error;

      if (entries && entries.length) {
        const rows = entries.map((e) => ({
          record_id: rec.id,
          user_id: e.user_id,
          member_name: e.member_name,
          // Four-state status is the source of truth; `present` is kept in sync
          // by a DB trigger (and passed here for older DBs without the trigger).
          status: e.status || (e.present ? 'P' : 'A'),
          present: (e.status ? e.status === 'P' || e.status === 'L' : !!e.present),
        }));
        const { error: eErr } = await supabase.from('attendance_entries').insert(rows);
        if (eErr) throw eErr;
      }
      await refreshGroup(groupId);
    },
    [user, refreshGroup]
  );

  // Captain resolves a missed check-in — creates today's record.
  const resolveMissed = useCallback(
    async (groupId, resolution) => {
      const status =
        resolution === 'self-study' ? 'missed_self_study' : 'missed_escalated';
      const { error } = await supabase.from('attendance_records').insert({
        group_id: groupId,
        date: localDateStr(),
        marked_by: user.id,
        marked_by_name: user.name,
        status,
      });
      if (error) throw error;
      await refreshGroup(groupId);
    },
    [user, refreshGroup]
  );

  const value = useMemo(
    () => ({
      historyFor: (groupId) => recordsByGroup[groupId] || [],
      todayRecordFor: (groupId) =>
        (recordsByGroup[groupId] || []).find((r) => r.date === localDateStr()) || null,
      isLoading: (groupId) => !!loadingByGroup[groupId],
      refreshGroup,
      submitAttendance,
      resolveMissed,
    }),
    [recordsByGroup, loadingByGroup, refreshGroup, submitAttendance, resolveMissed]
  );

  return (
    <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be used within an AttendanceProvider');
  return ctx;
}
