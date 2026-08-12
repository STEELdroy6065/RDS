import { supabase } from './supabase';

// Guardian links + the read-only slice a guardian is allowed to see, backed by
// Supabase RLS (see supabase/guardian.sql). A guardian sees the group, its
// announcements, and their linked student's attendance — nothing else.

const LINK_COLS = 'id, group_id, guardian_id, student_id, student_name, created_at';

// The students the current (guardian) user is linked to in a group.
export async function fetchMyGuardianLinks(groupId) {
  try {
    const { data, error } = await supabase
      .from('guardian_links')
      .select(LINK_COLS)
      .eq('group_id', groupId)
      .eq('guardian_id', (await supabase.auth.getUser()).data.user.id);
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

// All links in a group (Admin view).
export async function fetchGroupGuardianLinks(groupId) {
  try {
    const { data, error } = await supabase
      .from('guardian_links')
      .select(LINK_COLS)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

// Recent announcements a guardian (or member) may read.
export async function fetchAnnouncements(groupId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, author_name, text, created_at')
      .eq('group_id', groupId)
      .eq('type', 'Announcement')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

// Admin designates a member as a Guardian linked to a student.
export async function setGuardian({ groupId, guardianId, studentId, studentName }) {
  const { data, error } = await supabase.rpc('set_guardian', {
    gid: groupId,
    guardian_uid: guardianId,
    student_uid: studentId,
    sname: studentName || null,
  });
  if (error) throw error;
  return data;
}

export async function removeGuardianLink(id) {
  const { error } = await supabase.from('guardian_links').delete().eq('id', id);
  if (error) throw error;
}
