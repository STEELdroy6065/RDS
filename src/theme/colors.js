// RDS palette — warm "paper" system.
// Off-white paper canvas, near-black warm ink, restrained warm grays.
// Red is reserved for time running out. Green means present, amber means unresolved.

export const colors = {
  // Canvas & surfaces
  bg: '#FBFAF8', // warm paper
  surface: '#FFFFFF', // cards
  surfaceAlt: '#F2F0EC', // sunk — inputs, chips, icon tiles

  // Ink / text (warm neutrals)
  ink: '#14140F', // near-black warm text
  inkSoft: '#57534C', // secondary text
  muted: '#6E6A63', // captions, line icons, placeholders
  onPrimary: '#FFFFFF',

  // Brand / primary = near-black warm
  primary: '#14140F',
  primaryDark: '#000000',
  primarySoft: '#F2F0EC',

  // Accent — reserved for time running out / urgent attention
  accent: '#D93A2B',
  accentSoft: '#FBEAE7',

  // Semantic — present / unresolved
  success: '#2E7D5B', // present
  successSoft: '#E6F1EC',
  warning: '#B5730E', // unresolved
  warningSoft: '#FAF0DC',
  info: '#3C6CA6',
  infoSoft: '#EBF1F8',

  // Lines & shadow
  border: '#E7E3DC', // warm hairline
  divider: '#EFECE6',
  shadow: '#14140F',
};

// Restrained, warm avatar tones so initials read as calm, not colorful.
export const avatarPalette = ['#3D3A34', '#57534C', '#6E6A63'];

export function colorFromString(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}
