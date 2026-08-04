import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from './session';
import { groupTemplates } from '../data/discoverable';

// Real groups & memberships, backed by Supabase. The provider loads the groups
// the logged-in user belongs to (with their real role and member count), and
// creating/joining writes real rows. Feed / Votes / Attendance still key off
// these group ids but keep their own local mock state.

const GroupsContext = createContext(null);

function templateFor(type) {
  return groupTemplates.find((t) => t.id === type);
}

function emojiForType(type) {
  const t = templateFor(type);
  return t ? t.emoji : '👥';
}

function kindForType(type) {
  const t = templateFor(type);
  return t ? t.kind : 'Group';
}

export function GroupsProvider({ children }) {
  const { user } = useSession();
  const [groups, setGroups] = useState([]);
  const [rosters, setRosters] = useState({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setRosters({});
      return;
    }
    setLoading(true);

    // 1) My memberships + the group each one points at (RLS scopes this to me).
    const { data: mine, error } = await supabase
      .from('memberships')
      .select('role, group:groups(id, name, type, created_by, created_at)')
      .eq('user_id', user.id);

    if (error) {
      setLoading(false);
      return;
    }

    const rows = (mine || []).filter((m) => m.group);
    const groupIds = rows.map((m) => m.group.id);

    // 2) All membership rows for those groups — for counts and a basic roster.
    let all = [];
    if (groupIds.length) {
      const { data } = await supabase
        .from('memberships')
        .select('group_id, user_id, role')
        .in('group_id', groupIds);
      all = data || [];
    }

    const counts = {};
    const rosterByGroup = {};
    all.forEach((m) => {
      counts[m.group_id] = (counts[m.group_id] || 0) + 1;
      if (!rosterByGroup[m.group_id]) rosterByGroup[m.group_id] = [];
      rosterByGroup[m.group_id].push({
        id: m.user_id,
        // No profiles table yet, so we can only name ourselves.
        name: m.user_id === user.id ? user.name : 'Group member',
        role: m.role,
      });
    });

    const mapped = rows.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      role: m.role,
      type: m.group.type,
      members: counts[m.group.id] || 1,
      emoji: emojiForType(m.group.type),
      kind: kindForType(m.group.type),
    }));

    setGroups(mapped);
    setRosters(rosterByGroup);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const api = useMemo(
    () => ({
      groups,
      loading,
      refresh: load,

      getGroup: (groupId) => groups.find((g) => g.id === groupId) || null,

      roleForGroup: (groupId) => {
        const g = groups.find((x) => x.id === groupId);
        return g ? g.role : 'Member';
      },

      membersForGroup: (groupId) =>
        rosters[groupId] ||
        (user
          ? [
              {
                id: user.id,
                name: user.name,
                role:
                  (groups.find((g) => g.id === groupId) || {}).role || 'Member',
              },
            ]
          : []),

      // Create a real group and make the creator its Admin.
      createGroup: async ({ name, templateId }) => {
        const { data: group, error } = await supabase
          .from('groups')
          .insert({ name: name.trim(), type: templateId, created_by: user.id })
          .select()
          .single();
        if (error) throw error;

        const { error: mErr } = await supabase
          .from('memberships')
          .insert({ user_id: user.id, group_id: group.id, role: 'Admin' });
        if (mErr) throw mErr;

        await load();
        return group.id;
      },

      // Join a group by its code (the group id) as a regular Member.
      joinByCode: async (code) => {
        const groupId = code.trim();
        const { error } = await supabase
          .from('memberships')
          .insert({ user_id: user.id, group_id: groupId, role: 'Member' });
        if (error) throw error;

        await load();
        return groupId;
      },
    }),
    [groups, rosters, loading, load, user]
  );

  return <GroupsContext.Provider value={api}>{children}</GroupsContext.Provider>;
}

export function useGroups() {
  const ctx = useContext(GroupsContext);
  if (!ctx) throw new Error('useGroups must be used within a GroupsProvider');
  return ctx;
}
