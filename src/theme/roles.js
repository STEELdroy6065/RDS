// Role stays meaningful, but in the monochrome system it's expressed with
// grayscale weight (Admin darkest → Member lightest) and the role label itself,
// not bright colors. Keeps the professional black-and-white look.

export const roleColors = {
  Admin: {
    solid: '#15161B',
    soft: '#F0F0F2',
    text: '#15161B',
    ring: '#15161B',
  },
  Captain: {
    solid: '#54555E',
    soft: '#F0F0F2',
    text: '#33343B',
    ring: '#54555E',
  },
  Member: {
    solid: '#9A9BA4',
    soft: '#F3F3F5',
    text: '#54555E',
    ring: '#D7D7DC',
  },
};

const RANK = { Admin: 3, Captain: 2, Member: 1 };

export function roleTheme(role) {
  return roleColors[role] || roleColors.Member;
}

export function topRole(roles = []) {
  let best = 'Member';
  roles.forEach((r) => {
    if ((RANK[r] || 0) > (RANK[best] || 0)) best = r;
  });
  return best;
}
