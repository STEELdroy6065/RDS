import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, type } from '../theme';

// Icon + label per tab route. Order follows the mockup: Home · Attend · Chat ·
// Record. Active state fills the icon and inks the label; inactive stays muted.
const TABS = {
  Home: { on: 'home', off: 'home-outline', label: 'Home' },
  Attend: { on: 'calendar', off: 'calendar-outline', label: 'Attend' },
  Chat: { on: 'chatbubble', off: 'chatbubble-outline', label: 'Chat' },
  Record: { on: 'document-text', off: 'document-text-outline', label: 'Record' },
};

export default function BottomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = TABS[route.name] || { on: 'ellipse', off: 'ellipse-outline', label: route.name };

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
          >
            <Ionicons
              name={focused ? meta.on : meta.off}
              size={21}
              color={focused ? colors.ink : colors.muted}
            />
            <Text style={[styles.label, focused ? styles.labelOn : null]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  label: {
    ...type.caption,
    fontSize: 10.5,
    fontWeight: '500',
    color: colors.muted,
  },
  labelOn: { color: colors.ink, fontWeight: '600' },
});
