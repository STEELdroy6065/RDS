import { supabase } from './supabase';

// Leave requests + audit, backed by Supabase RPCs and RLS. Mutations go through
// the request_leave / decide_leave SECURITY DEFINER functions so the audit row
// and notification are always written with them.

const REQ_COLS =
  'id, group_id, user_id, requester_name, date, reason, attachment_url, status, decided_by_name, decided_at, created_at';

// All requests the caller may see for a group (their own; everything if a
// moderator). Newest first.
export async function fetchLeave(groupId) {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(REQ_COLS)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

// Requests for a specific date (used by the roll). Returns a map of
// userId -> { status, reason, name } so the roll can pre-mark excused members
// and surface pending requests inline.
export async function fetchLeaveForDate(groupId, date) {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('user_id, status, reason, requester_name')
      .eq('group_id', groupId)
      .eq('date', date)
      .in('status', ['pending', 'approved']);
    if (error) throw error;
    const map = {};
    (data || []).forEach((r) => {
      map[r.user_id] = { status: r.status, reason: r.reason, name: r.requester_name };
    });
    return map;
  } catch {
    return {};
  }
}

export async function requestLeave({ groupId, date, reason, name, attachmentUrl }) {
  const { data, error } = await supabase.rpc('request_leave', {
    gid: groupId,
    ldate: date,
    lreason: reason || null,
    lname: name || null,
    lattachment: attachmentUrl || null,
  });
  if (error) throw error;
  return data; // new request id
}

export async function decideLeave({ requestId, decision, name, note }) {
  const { error } = await supabase.rpc('decide_leave', {
    rid: requestId,
    decision,
    lname: name || null,
    note: note || null,
  });
  if (error) throw error;
}

export async function cancelLeave(requestId) {
  const { error } = await supabase.from('leave_requests').delete().eq('id', requestId);
  if (error) throw error;
}

export async function fetchLeaveAudit(requestId) {
  try {
    const { data, error } = await supabase
      .from('leave_audit')
      .select('id, actor_name, action, note, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}
