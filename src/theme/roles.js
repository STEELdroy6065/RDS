// Role stays meaningful, but in the monochrome system it's expressed with
// grayscale weight (Admin darkest → Member lightest) and the role label itself,
// not bright colors. Keeps the professional black-and-white look.

export const roleColors = {
  Admin: {
    solid: '#14140F',
    soft: '#EFEDE8',
    text: '#14140F',
    ring: '#14140F',
  },
  Captain: {
    solid: '#57534C',
    soft: '#EFEDE8',
    text: '#3D3A34',
    ring: '#57534C',
  },
  Member: {
    solid: '#6E6A63',
    soft: '#F2F0EC',
    text: '#57534C',
    ring: '#DAD5CC',
  },
  Guardian: {
    solid: '#3C6CA6',
    soft: '#EBF1F8',
    text: '#2F5580',
    ring: '#BCD0E6',
  },
};

const RANK = { Admin: 3, Captain: 2, Member: 1, Guardian: 0 };

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
