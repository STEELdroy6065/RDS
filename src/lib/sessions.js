import { supabase } from './supabase';

// Recurring weekly timetable sessions for a group (see supabase/sessions.sql).
// Members read; Admin/Captain write. Degrades to an empty list if the migration
// hasn't been run.

const COLS = 'id, group_id, title, weekday, start_time, location, note, created_by';

// Compare "HH:MM" strings for ordering within a day.
function timeKey(t) {
  const [h, m] = (t || '0:0').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

export async function fetchSessions(groupId) {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select(COLS)
      .eq('group_id', groupId);
    if (error) throw error;
    return (data || []).sort(
      (a, b) => a.weekday - b.weekday || timeKey(a.start_time) - timeKey(b.start_time)
    );
  } catch {
    return [];
  }
}

export async function createSession({ groupId, userId, title, weekday, startTime, location, note }) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      group_id: groupId,
      created_by: userId,
      title: title.trim(),
      weekday,
      start_time: startTime,
      location: location ? location.trim() : null,
      note: note ? note.trim() : null,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateSession(id, { title, weekday, startTime, location, note }) {
  const patch = {};
  if (title !== undefined) patch.title = title.trim();
  if (weekday !== undefined) patch.weekday = weekday;
  if (startTime !== undefined) patch.start_time = startTime;
  if (location !== undefined) patch.location = location ? location.trim() : null;
  if (note !== undefined) patch.note = note ? note.trim() : null;
  const { error } = await supabase.from('sessions').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  if (error) throw error;
}
