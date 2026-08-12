import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useSession } from '../state/session';
import { useNotifications } from '../state/notifications';
import { localDateStr, isPastDeadline } from '../state/attendance';

// Computes, for the Home screen:
//   - statusByGroup: a short live status string per group ("2 unread · vote open")
//   - forYou: the single most time-sensitive item across all groups (or null)
// Uses targeted count queries so it stays fast regardless of message volume.

async function countRows(build) {
  try {
    const { count } = await build;
    return count || 0;
  } catch {
    return 0;
  }
}

function buildStatus(s) {
  const parts = [];
  if (s.attendanceDue) parts.push('Attendance due');
  if (s.unread > 0) parts.push(`${s.unread} unread`);
  if (s.voteOpen) parts.push('vote open');
  return parts.length ? parts.join(' · ') : null;
}

// The single most urgent thing, by priority (votes have no close time in the
// schema, so deadline-based attendance/cascade items rank above open votes).
function pickForYou(groups, statusByGroup, items) {
  const byId = {};
  groups.forEach((g) => (byId[g.id] = g));

  // 1) A missed check-in that escalated to a Captain who hasn't resolved it.
  const cascade = items.find(
    (n) =>
      n.type === 'attendance_missed' &&
      !n.read &&
      byId[n.group_id] &&
      byId[n.group_id].role === 'Captain' &&
      statusByGroup[n.group_id] &&
      statusByGroup[n.group_id].attendanceUnresolved
  );
  if (cascade) {
    const g = byId[cascade.group_id];
    return {
      kind: 'cascade',
      tone: 'urgent',
      icon: 'alert-circle',
      title: 'A missed check-in needs your response',
      subtitle: g.name,
      target: { screen: 'Attendance', params: { groupId: g.id, groupName: g.name } },
    };
  }

  // 2) Attendance overdue (Admin, past the deadline, not marked).
  const overdue = groups.find(
    (g) => statusByGroup[g.id] && statusByGroup[g.id].attendanceDue && isPastDeadline(g.checkInDeadline)
  );
  if (overdue) {
    return {
      kind: 'attendance_overdue',
      tone: 'urgent',
      icon: 'time',
      title: `Attendance is overdue in ${overdue.name}`,
      subtitle: `Was due at ${overdue.checkInDeadline}`,
      target: { screen: 'Attendance', params: { groupId: overdue.id, groupName: overdue.name } },
    };
  }

  // 3) Attendance due later today (Admin, not yet past deadline).
  const due = groups.find((g) => statusByGroup[g.id] && statusByGroup[g.id].attendanceDue);
  if (due) {
    return {
      kind: 'attendance_due',
      tone: 'due',
      icon: 'calendar',
      title: `Mark attendance in ${due.name}`,
      subtitle: `Due by ${due.checkInDeadline}`,
      target: { screen: 'Attendance', params: { groupId: due.id, groupName: due.name } },
    };
  }

  // 4) An open vote (any member).
  const voteGroup = groups.find((g) => statusByGroup[g.id] && statusByGroup[g.id].voteOpen);
  if (voteGroup) {
    return {
      kind: 'vote',
      tone: 'due',
      icon: 'bar-chart',
      title: `A vote is open in ${voteGroup.name}`,
      subtitle: 'Cast your vote',
      target: { screen: 'Votes', params: { groupId: voteGroup.id, groupName: voteGroup.name } },
    };
  }

  return null;
}

export function useHomeSignals(groups) {
  const { user } = useSession();
  const { items } = useNotifications();
  const [signals, setSignals] = useState({ statusByGroup: {}, forYou: null });

  const compute = useCallback(async () => {
    if (!user || !groups.length) {
      setSignals({ statusByGroup: {}, forYou: null });
      return;
    }
    const ids = groups.map((g) => g.id);
    const today = localDateStr();

    // Per-group last-opened times (for unread).
    const lastSeen = {};
    await Promise.all(
      groups.map(async (g) => {
        try {
          const v = await AsyncStorage.getItem(`lastSeen:${g.id}`);
          if (v) lastSeen[g.id] = v;
        } catch {
          /* ignore */
        }
      })
    );

    // Which groups have attendance marked today.
    let marked = new Set();
    try {
      const { data } = await supabase
        .from('attendance_records')
        .select('group_id')
        .in('group_id', ids)
        .eq('date', today);
      marked = new Set((data || []).map((r) => r.group_id));
    } catch {
      marked = new Set();
    }

    const statusByGroup = {};
    await Promise.all(
      groups.map(async (g) => {
        let unread = 0;
        if (lastSeen[g.id]) {
          unread = await countRows(
            supabase.from('posts').select('*', { count: 'exact', head: true })
              .eq('group_id', g.id).eq('deleted', false)
              .gt('created_at', lastSeen[g.id]).neq('author_id', user.id)
          );
        }
        const openVotes = await countRows(
          supabase.from('votes').select('*', { count: 'exact', head: true })
            .eq('group_id', g.id).eq('status', 'open')
        );
        const attendanceUnresolved = !marked.has(g.id);
        const s = {
          unread,
          voteOpen: openVotes > 0,
          attendanceUnresolved,
          // Only an Admin is prompted to mark attendance.
          attendanceDue: g.role === 'Admin' && attendanceUnresolved,
        };
        s.text = buildStatus(s);
        statusByGroup[g.id] = s;
      })
    );

    setSignals({ statusByGroup, forYou: pickForYou(groups, statusByGroup, items) });
  }, [user, groups, items]);

  useFocusEffect(
    useCallback(() => {
      compute();
    }, [compute])
  );

  return signals;
}
