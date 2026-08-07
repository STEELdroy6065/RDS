// All content here is placeholder/mock data for the UI-only skeleton.
// No network, no persistence — screens read from these constants and hold
// any interaction (e.g. poll votes) in local component state.

export const currentUser = {
  id: 'u_jordan',
  name: 'Jordan Lee',
  handle: '@jordan',
  role: 'Student · Lincoln High',
  stats: {
    groups: 3,
    votesCast: 27,
    attendance: '94%',
  },
};

export const groups = [
  {
    id: 'g1',
    name: 'Lincoln HS Soccer',
    role: 'Captain',
    members: 22,
    emoji: '⚽️',
    kind: 'Team',
  },
  {
    id: 'g2',
    name: 'Robotics Club',
    role: 'Member',
    members: 15,
    emoji: '🤖',
    kind: 'Club',
  },
  {
    id: 'g3',
    name: 'AP Bio Study Group',
    role: 'Admin',
    members: 9,
    emoji: '🧬',
    kind: 'Class',
  },
];

// The `role` field on each group is the current user's permission role within
// it (Admin / Captain / Member) — the single source of truth for "what may I do
// here". The GroupsProvider (src/state/groups.js) owns this at runtime so newly
// created/joined groups carry a role too; swap it for real auth later.

// Note: votes, attendance, and feed posts now live in Supabase. The mock
// members roster below is still used as a fallback for the seeded group ids.

// Members keyed by group id.
export const membersByGroup = {
  g1: [
    { id: 'm1', name: 'Coach Rivera', role: 'Coach' },
    { id: 'm2', name: 'Jordan Lee', role: 'Captain' },
    { id: 'm3', name: 'Sam Okafor', role: 'Player' },
    { id: 'm4', name: 'Maya Torres', role: 'Player' },
    { id: 'm5', name: 'Diego Alvarez', role: 'Player' },
    { id: 'm6', name: 'Ella Fournier', role: 'Player' },
  ],
  g2: [
    { id: 'm1', name: 'Ms. Chen', role: 'Advisor' },
    { id: 'm2', name: 'Priya Nadar', role: 'Lead' },
    { id: 'm3', name: 'Jordan Lee', role: 'Member' },
    { id: 'm4', name: 'Owen Brooks', role: 'Member' },
    { id: 'm5', name: 'Hana Sato', role: 'Member' },
  ],
  g3: [
    { id: 'm1', name: 'Jordan Lee', role: 'Organizer' },
    { id: 'm2', name: 'Alex Kim', role: 'Member' },
    { id: 'm3', name: 'Riley Cooper', role: 'Member' },
    { id: 'm4', name: 'Noah Bennett', role: 'Member' },
  ],
};

// Alerts are now real, in-app notifications from Supabase — see
// src/state/notifications.js and supabase/notifications.sql.
