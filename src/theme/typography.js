import { Platform } from 'react-native';

// Type system: sans for everything spoken, mono for everything counted —
// times, tallies, percentages, IDs. Mono uses the platform monospace so we
// add no font dependency (a real IBM Plex Mono can be loaded later).
const family = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const familyMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});
export const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const type = {
  display: {
    fontFamily: familyMedium,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: familyMedium,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heading: {
    fontFamily: familyMedium,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: family,
    fontSize: 15,
    fontWeight: '400',
  },
  bodyStrong: {
    fontFamily: familyMedium,
    fontSize: 15,
    fontWeight: '600',
  },
  caption: {
    fontFamily: family,
    fontSize: 13,
    fontWeight: '400',
  },
  label: {
    fontFamily: familyMedium,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // Mono — everything counted.
  mono: {
    fontFamily: monoFamily,
    fontSize: 14,
    fontWeight: '500',
  },
  monoSmall: {
    fontFamily: monoFamily,
    fontSize: 12,
    fontWeight: '500',
  },
  // Mono uppercase chip label — role tags, kickers.
  monoLabel: {
    fontFamily: monoFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
};
