import { colors, avatarPalette, colorFromString } from './colors';
import { type } from './typography';
import { roleColors, roleTheme, topRole } from './roles';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 14,
  md: 20,
  lg: 26,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 4,
  },
  raised: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 10,
  },
};

export { colors, avatarPalette, colorFromString, type };
export { roleColors, roleTheme, topRole };
