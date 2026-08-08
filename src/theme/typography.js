import { Platform } from 'react-native';

// Clean, professional system type. Confident but restrained weights — no
// oversized display treatment, minimal letter-spacing tricks.
const family = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const familyMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
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
};
