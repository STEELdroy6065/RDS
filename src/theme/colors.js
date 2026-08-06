// Synq palette — dark theme.
// Deep charcoal-navy canvas, subtly lighter panels, light text, with the
// role-color system as the main pop of color (see roles.js).

export const colors = {
  // Canvas & surfaces
  bg: '#121319', // deep charcoal-navy (not pure black)
  surface: '#1C1D26', // card panels — just enough lift off the bg
  surfaceAlt: '#262733', // inputs, segments, chips

  // Ink / text
  ink: '#F4F4F8', // primary text (near-white)
  inkSoft: '#C4C5D2', // secondary text
  muted: '#8A8B9C', // captions / placeholders
  onPrimary: '#FFFFFF',

  // Brand (brightened to pop on dark)
  primary: '#7C6CF0',
  primaryDark: '#5B4BE1',
  primarySoft: '#24223E', // dark indigo panel (badge/icon backdrop)

  // Accent
  accent: '#FF7A66',
  accentSoft: '#3A2420',

  // Semantic
  success: '#2FCB92',
  successSoft: '#16302A',
  warning: '#E9AE4B',
  warningSoft: '#332811',
  info: '#4F9DF7',
  infoSoft: '#152A40',

  // Lines & shadow (subtle, no harsh borders)
  border: '#2A2B36',
  divider: '#24252F',
  shadow: '#000000',
};

// Vivid avatar colors, keyed to the role palette so initials read as colorful
// on the dark background.
export const avatarPalette = [
  '#7C6CF0', // indigo
  '#19B5B5', // teal
  '#E0A93A', // amber
  '#4F9DF7', // blue
  '#E8557A', // pink
  '#2FCB92', // green
];

export function colorFromString(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}
