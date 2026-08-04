// Group templates offered when creating a group. `id` is stored as the group's
// `type` in Supabase; the emoji/kind are derived from it for display.
export const groupTemplates = [
  { id: 'class', label: 'School Class', emoji: '📚', kind: 'Class' },
  { id: 'club', label: 'Club/Team', emoji: '🏆', kind: 'Club' },
  { id: 'community', label: 'Community/Fellowship', emoji: '🤝', kind: 'Community' },
  { id: 'other', label: 'Other', emoji: '✨', kind: 'Group' },
];
