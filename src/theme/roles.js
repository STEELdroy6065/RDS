// Role is Synq's visual signature. Each role gets a bold, distinct color used
// everywhere the user's standing shows up — group card stripes, avatar rings,
// role badges. Shades chosen to be clearly different (gold / teal / indigo)
// with readable soft+text pairings.

export const roleColors = {
  Admin: {
    solid: '#C0871A', // warm amber / gold
    soft: '#F7EACB',
    text: '#835A0C',
    ring: '#E0A63A',
  },
  Captain: {
    solid: '#0E8C8C', // teal
    soft: '#D3EFEF',
    text: '#0A5C5C',
    ring: '#16A6A6',
  },
  Member: {
    solid: '#4A3DBB', // deep indigo
    soft: '#E6E3F9',
    text: '#362A8C',
    ring: '#6355D8',
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
