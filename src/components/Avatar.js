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
export default function Avatar({ name, emoji, size = 44 }) {
  const bg = colorFromString(name || emoji || '');
  return (
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
        <Text style={[styles.text, { fontSize: size * 0.36 }]}>
          {initials(name)}
        </Text>
      )}
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
