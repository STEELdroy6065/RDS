import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, type, shadow } from '../theme';

// Floating pill-shaped bottom navigation (rounded ends, margin from edges).
const ICONS = {
  Home: ['home', 'home-outline'],
  Alerts: ['notifications', 'notifications-outline'],
  Profile: ['person', 'person-outline'],
};

export default function FloatingTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: (insets.bottom || spacing.md) + 2 }]}
    >
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const [active, inactive] = ICONS[route.name] || ['ellipse', 'ellipse-outline'];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.item}
              hitSlop={8}
            >
              <Ionicons
                name={focused ? active : inactive}
                size={22}
                color={focused ? colors.primary : colors.muted}
              />
              <Text style={[styles.label, { color: focused ? colors.primary : colors.muted }]}>
                {route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    ...shadow.raised,
  },
  item: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  label: {
    ...type.label,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
