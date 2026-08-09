// RDS palette — clean, professional, monochrome.
// White canvas, near-black ink, restrained grays, black as the primary accent.
// Color is used sparingly (red only for destructive/attention).

export const colors = {
  // Canvas & surfaces
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F3F5', // inputs, chips, icon tiles

  // Ink / text
  ink: '#15161B', // near-black text
  inkSoft: '#54555E', // secondary text
  muted: '#9A9BA4', // captions, line icons, placeholders
  onPrimary: '#FFFFFF',

  // Brand / primary = near-black
  primary: '#15161B',
  primaryDark: '#000000',
  primarySoft: '#F3F3F5',

  // Accent — reserved for destructive / attention only
  accent: '#CF3B2E',
  accentSoft: '#FBECE9',

  // Semantic — muted, used sparingly
  success: '#2F7D5B',
  successSoft: '#ECF4EF',
  warning: '#8C6D1E',
  warningSoft: '#F4EFDF',
  info: '#3C6CA6',
  infoSoft: '#EBF1F8',

  // Lines & shadow
  border: '#E7E7EB',
  divider: '#EFEFF2',
  shadow: '#15161B',
};

// Restrained, professional avatar tones (neutral grays) so initials read as
// clean, not colorful.
export const avatarPalette = ['#3F4048', '#54555E', '#6B6C75'];

export function colorFromString(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}
