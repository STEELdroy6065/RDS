import React, { createContext, useContext, useMemo, useState } from 'react';

// In-memory attendance state: submitted records, a pending "missed check-in"
// per group, and read-only history. No backend — the missed-check-in deadline
// is simulated by a dev button instead of a real timer.
//
// History record shape:
//   { id, at, kind, byName, byRole, presentCount, totalCount }
//   kind: 'marked'      — an Admin/Teacher submitted attendance
//         'self-study'  — Captain started a self-study session after a miss
//         'escalated'   — Captain escalated a miss to Admin

const AttendanceContext = createContext(null);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Platform-safe timestamp (avoids relying on Intl under Hermes).
export function stamp(d = new Date()) {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()} · ${h}:${m} ${ampm}`;
}

// Roles that count as the group's "teacher"/lead for a missed check-in.
const LEAD_ROLES = ['Coach', 'Advisor', 'Admin', 'Teacher', 'Organizer', 'Lead'];

export function leadName(members = []) {
  const lead = members.find((m) => LEAD_ROLES.includes(m.role));
  return lead ? lead.name : 'The teacher';
}

// Permission helpers.
export const canMarkAttendance = (role) => role === 'Admin';
export const receivesCascade = (role) => role === 'Captain';

// Seed a little history so the log isn't empty for the original groups.
const seedHistory = {
  g1: [
    { id: 'ah1', at: 'Yesterday · 8:05 AM', kind: 'marked', byName: 'Coach Rivera', byRole: 'Coach', presentCount: 5, totalCount: 6 },
    { id: 'ah2', at: 'Mon · 8:02 AM', kind: 'marked', byName: 'Coach Rivera', byRole: 'Coach', presentCount: 6, totalCount: 6 },
  ],
  g2: [
    { id: 'ah1', at: 'Fri · 4:00 PM', kind: 'self-study', byName: 'Priya Nadar', byRole: 'Captain', presentCount: null, totalCount: null },
  ],
  g3: [
    { id: 'ah1', at: 'Yesterday · 3:15 PM', kind: 'marked', byName: 'Jordan Lee', byRole: 'Admin', presentCount: 3, totalCount: 4 },
  ],
};

let seq = 0;
const uid = () => `a_${Date.now().toString(36)}_${seq++}`;

export function AttendanceProvider({ children }) {
  const [history, setHistory] = useState(() => ({ ...seedHistory }));
  const [pending, setPending] = useState({}); // groupId -> { teacherName, at } | undefined

  const api = useMemo(
    () => ({
      historyFor: (groupId) => history[groupId] || [],
      pendingFor: (groupId) => pending[groupId] || null,

      submitAttendance: (groupId, { presentCount, totalCount, byName, byRole }) => {
        const record = {
          id: uid(),
          at: stamp(),
          kind: 'marked',
          byName,
          byRole,
          presentCount,
          totalCount,
        };
        setHistory((prev) => ({
          ...prev,
          [groupId]: [record, ...(prev[groupId] || [])],
        }));
      },

      // Stand-in for a missed deadline: flag a pending missed check-in.
      simulateMissed: (groupId, teacherName) => {
        setPending((prev) => ({
          ...prev,
          [groupId]: { teacherName, at: stamp() },
        }));
      },

      // Captain resolves the cascade — logs a status and clears the pending flag.
      resolveMissed: (groupId, resolution, byName) => {
        const record = {
          id: uid(),
          at: stamp(),
          kind: resolution, // 'self-study' | 'escalated'
          byName,
          byRole: 'Captain',
          presentCount: null,
          totalCount: null,
        };
        setHistory((prev) => ({
          ...prev,
          [groupId]: [record, ...(prev[groupId] || [])],
        }));
        setPending((prev) => {
          const next = { ...prev };
          delete next[groupId];
          return next;
        });
      },
    }),
    [history, pending]
  );

  return (
    <AttendanceContext.Provider value={api}>{children}</AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be used within an AttendanceProvider');
  return ctx;
}
