import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, colorFromString, radius, type } from '../theme';

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Colored circular initials avatar. Pass `emoji` for a glyph tile, `color` to
// force the circle color (e.g. by role), or `ring` to draw a colored ring.
export default function Avatar({ name, emoji, size = 44, ring, color }) {
  const bg = color || colorFromString(name || emoji || '');
  const avatar = (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: emoji ? radius.md : size / 2,
          backgroundColor: emoji ? colors.surfaceAlt : bg,
          borderWidth: emoji ? 1 : 0,
          borderColor: colors.border,
        },
      ]}
    >
      {emoji ? (
        <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
      )}
    </View>
  );

  if (!ring) return avatar;

  const pad = Math.max(3, Math.round(size * 0.09));
  const outer = emoji ? radius.md + pad : (size + pad * 2) / 2;
  return (
    <View
      style={{
        padding: pad,
        borderRadius: outer,
        borderWidth: 2,
        borderColor: ring,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {avatar}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...type.bodyStrong,
    color: '#FFFFFF',
  },
});
