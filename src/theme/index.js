import { colors, avatarPalette, colorFromString } from './colors';
import { type, monoFamily } from './typography';
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
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  raised: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
};

export { colors, avatarPalette, colorFromString, type, monoFamily };
export { roleColors, roleTheme, topRole };
