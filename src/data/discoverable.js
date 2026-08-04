// Mock "discoverable" groups shown on the Join tab of the New Group screen.
// Purely local — joining one copies it into the live groups list.

export const discoverableGroups = [
  {
    key: 'd_chess',
    name: 'Downtown Chess Club',
    emoji: '♟️',
    kind: 'Club',
    members: 34,
    blurb: 'Casual matches & ladder every Thursday',
    roster: [
      { name: 'Ana Powell', role: 'Organizer' },
      { name: 'Ben Cho', role: 'Member' },
    ],
  },
  {
    key: 'd_debate',
    name: 'City Debate League',
    emoji: '🗣️',
    kind: 'Club',
    members: 26,
    blurb: 'Weekly practice rounds, open to all levels',
    roster: [
      { name: 'Carla Reyes', role: 'Captain' },
      { name: 'Dev Anand', role: 'Member' },
    ],
  },
  {
    key: 'd_run',
    name: 'Sunrise Run Club',
    emoji: '🏃',
    kind: 'Community',
    members: 58,
    blurb: 'Saturday morning 5Ks around the park',
    roster: [
      { name: 'Elena Voss', role: 'Organizer' },
      { name: 'Frank Ojo', role: 'Member' },
    ],
  },
];

// Group templates offered when creating a group.
export const groupTemplates = [
  { id: 'class', label: 'School Class', emoji: '📚', kind: 'Class' },
  { id: 'club', label: 'Club/Team', emoji: '🏆', kind: 'Club' },
  { id: 'community', label: 'Community/Fellowship', emoji: '🤝', kind: 'Community' },
  { id: 'other', label: 'Other', emoji: '✨', kind: 'Group' },
];
