import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Avatar from './Avatar';
import { colors, spacing, radius, type, roleTheme } from '../theme';
import { useGroups } from '../state/groups';

// Discord-style vertical rail of the user's groups, always visible on the main
// surface. Each icon is ringed by the user's role color; tapping jumps into
// that group.
const RAIL_BG = '#0B0C11';

export default function GroupRail() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { groups } = useGroups();

  return (
    <View
      style={[
        styles.rail,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <View style={styles.brand}>
        <Text style={styles.brandText}>S</Text>
      </View>
      <View style={styles.sep} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {groups.map((g) => {
          const rc = roleTheme(g.role);
          return (
            <Pressable
              key={g.id}
              onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Avatar emoji={g.emoji} name={g.name} size={46} ring={rc.ring} />
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => navigation.navigate('NewGroup')}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 72,
    backgroundColor: RAIL_BG,
    alignItems: 'center',
  },
  brand: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { ...type.title, color: colors.onPrimary, fontSize: 22 },
  sep: {
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  list: { alignItems: 'center', paddingBottom: spacing.lg },
  item: { marginBottom: spacing.md },
  pressed: { opacity: 0.7 },
  add: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
});
