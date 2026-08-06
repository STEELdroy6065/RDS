// Role is Synq's visual signature and, on the dark theme, the main pop of
// color. Vivid gold / teal / indigo that read strongly against the charcoal
// canvas, each with a dark tinted "soft" panel and a bright text color.

export const roleColors = {
  Admin: {
    solid: '#E0A93A', // vivid amber / gold
    soft: '#332811',
    text: '#F0C061',
    ring: '#E0A93A',
  },
  Captain: {
    solid: '#19B5B5', // vivid teal
    soft: '#0E2E2E',
    text: '#40D4D4',
    ring: '#19B5B5',
  },
  Member: {
    solid: '#7C6CF0', // vivid indigo
    soft: '#232145',
    text: '#A99CF7',
    ring: '#7C6CF0',
  },
};

const RANK = { Admin: 3, Captain: 2, Member: 1 };

export function roleTheme(role) {
  return roleColors[role] || roleColors.Member;
}

// The user's strongest role across all their groups (Admin > Captain > Member).
export function topRole(roles = []) {
  let best = 'Member';
  roles.forEach((r) => {
    if ((RANK[r] || 0) > (RANK[best] || 0)) best = r;
  });
  return best;
}
