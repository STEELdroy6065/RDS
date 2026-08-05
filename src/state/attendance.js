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
          present: e.present,
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
