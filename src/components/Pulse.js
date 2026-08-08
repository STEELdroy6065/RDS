import React from 'react';
import { View } from 'react-native';
import { colors } from '../theme';

// A small, static status dot. (Formerly an animated pulse — simplified to a
// plain dot for the clean, professional look.) Kept as a component with the
// same API so existing call sites don't change.
export default function Pulse({ color = colors.accent, size = 8, style }) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}
