import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colorFromString, radius, type } from '../theme';

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Deterministic colored initials avatar. Pass `emoji` to show a glyph instead.
// Pass `ring` (a color) to draw a colored ring around it — used to signal the
// user's role.
export default function Avatar({ name, emoji, size = 44, ring }) {
  const bg = colorFromString(name || emoji || '');
  const avatar = (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: emoji ? radius.md : size / 2,
          backgroundColor: emoji ? '#FFFFFF' : bg,
          borderWidth: emoji ? 1 : 0,
          borderColor: 'rgba(27,26,46,0.06)',
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
