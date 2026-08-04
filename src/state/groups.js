import React, { createContext, useContext, useMemo, useState } from 'react';
import { groups as seedGroups, membersByGroup, currentUser } from '../data/mock';
import { groupTemplates } from '../data/discoverable';

// Live, in-memory store for the user's groups. Seeded from mock data, but
// mutable at runtime so a group the user creates or joins appears everywhere
// (Home, Groups, Group Detail) immediately. No backend.
//
// Each group's `role` is the current user's permission role within it
// (Admin / Captain / Member) — the source of truth used for gating actions.

const GroupsContext = createContext(null);

let seq = 0;
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${seq++}`;

function templateFor(templateId) {
  return groupTemplates.find((t) => t.id === templateId) || groupTemplates[3];
}

export function GroupsProvider({ children }) {
  const [groups, setGroups] = useState(seedGroups);
  // Member rosters keyed by group id. Seeded groups start from membersByGroup;
  // created/joined groups add their own roster here.
  const [rosters, setRosters] = useState(() => ({ ...membersByGroup }));

  const api = useMemo(
    () => ({
      groups,

      getGroup: (groupId) => groups.find((g) => g.id === groupId) || null,

      // Current user's permission role in a group (defaults to Member).
      roleForGroup: (groupId) => {
        const g = groups.find((x) => x.id === groupId);
        return g ? g.role : 'Member';
      },

      membersForGroup: (groupId) => rosters[groupId] || [],

      // Create a brand-new group. Current user becomes Admin, sole member.
      createGroup: ({ name, templateId }) => {
        const t = templateFor(templateId);
        const id = uid('g');
        const group = {
          id,
          name: name.trim(),
          role: 'Admin',
          members: 1,
          emoji: t.emoji,
          kind: t.kind,
        };
        setGroups((prev) => [group, ...prev]);
        setRosters((prev) => ({
          ...prev,
          [id]: [{ id: currentUser.id, name: currentUser.name, role: 'Admin' }],
        }));
        return id;
      },

      // Join a discoverable group. Current user joins as a regular Member.
      joinGroup: (discoverable) => {
        const id = uid('g');
        const group = {
          id,
          name: discoverable.name,
          role: 'Member',
          members: discoverable.members + 1,
          emoji: discoverable.emoji,
          kind: discoverable.kind,
        };
        const roster = [
          ...discoverable.roster.map((m, i) => ({
            id: `${id}_m${i}`,
            name: m.name,
            role: m.role,
          })),
          { id: currentUser.id, name: currentUser.name, role: 'Member' },
        ];
        setGroups((prev) => [group, ...prev]);
        setRosters((prev) => ({ ...prev, [id]: roster }));
        return id;
      },

      // Join via a group code — no validation; spins up a Member group.
      joinByCode: (code) => {
        const id = uid('g');
        const group = {
          id,
          name: code.trim().toUpperCase(),
          role: 'Member',
          members: 1,
          emoji: '🔑',
          kind: 'Group',
        };
        setGroups((prev) => [group, ...prev]);
        setRosters((prev) => ({
          ...prev,
          [id]: [{ id: currentUser.id, name: currentUser.name, role: 'Member' }],
        }));
        return id;
      },
    }),
    [groups, rosters]
  );

  return <GroupsContext.Provider value={api}>{children}</GroupsContext.Provider>;
}

export function useGroups() {
  const ctx = useContext(GroupsContext);
  if (!ctx) throw new Error('useGroups must be used within a GroupsProvider');
  return ctx;
}
