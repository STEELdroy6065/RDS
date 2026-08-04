// Synq palette — a considered, restrained system.
// Signature: indigo-violet primary + warm coral accent on a soft cool-neutral canvas.

export const colors = {
  // Canvas & surfaces
  bg: '#F5F4F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EFF8',

  // Ink / text
  ink: '#1B1A2E',
  inkSoft: '#4A4860',
  muted: '#8B8AA0',
  onPrimary: '#FFFFFF',

  // Brand
  primary: '#5646C4',
  primaryDark: '#3E31A0',
  primarySoft: '#ECE9FA',

  // Accent
  accent: '#FF6B57',
  accentSoft: '#FFE7E2',

  // Semantic
  success: '#1FA971',
  successSoft: '#E2F5EC',
  warning: '#E8A33D',
  warningSoft: '#FBF0DC',
  info: '#3D8BF0',
  infoSoft: '#E4EFFD',

  // Lines & shadow
  border: '#E7E4F0',
  divider: '#EFEDF5',
  shadow: '#1B1A2E',
};

// A small, harmonious set used to color group/member avatars deterministically.
export const avatarPalette = [
  '#5646C4',
  '#FF6B57',
  '#1FA971',
  '#3D8BF0',
  '#E8A33D',
  '#B5479A',
];

export function colorFromString(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}
