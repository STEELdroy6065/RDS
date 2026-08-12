import { supabase } from './supabase';

// Profiles: real names + avatars for users the caller is allowed to see
// (see supabase/profiles.sql). Falls back gracefully if the migration hasn't
// been run — callers keep their existing "Group member" placeholder.

// Fetch a map of userId -> { name, avatarUrl } for the given ids.
export async function fetchProfiles(ids = []) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', unique);
    if (error) throw error;
    const map = {};
    (data || []).forEach((p) => {
      map[p.id] = { name: p.full_name || null, avatarUrl: p.avatar_url || null };
    });
    return map;
  } catch {
    return {};
  }
}

// Read the caller's own profile.
export async function fetchMyProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { name: data.full_name || null, avatarUrl: data.avatar_url || null };
  } catch {
    return null;
  }
}

// Upsert the caller's own profile (name and/or avatar).
export async function saveMyProfile(userId, { name, avatarUrl }) {
  const patch = { id: userId, updated_at: new Date().toISOString() };
  if (name !== undefined) patch.full_name = name;
  if (avatarUrl !== undefined) patch.avatar_url = avatarUrl;
  const { error } = await supabase.from('profiles').upsert(patch);
  if (error) throw error;
}
