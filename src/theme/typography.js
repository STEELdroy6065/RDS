import { Platform } from 'react-native';

// System stack keeps the skeleton offline-friendly while still feeling
// deliberate — tight display headings, comfortable body, spaced labels.
const family = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const familyMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

export const type = {
  display: {
    fontFamily: familyMedium,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: familyMedium,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heading: {
    fontFamily: familyMedium,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: family,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  bodyStrong: {
    fontFamily: familyMedium,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  caption: {
    fontFamily: family,
    fontSize: 13,
    fontWeight: '400',
  },
  label: {
    fontFamily: familyMedium,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
};
