import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import GroupCard from '../components/GroupCard';
import SectionLabel from '../components/SectionLabel';
import { colors, spacing, radius, type, shadow } from '../theme';
import { useGroups } from '../state/groups';

export default function GroupsScreen({ navigation }) {
  const { groups } = useGroups();
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Groups</Text>

        <Pressable
          onPress={() => navigation.navigate('NewGroup')}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
        >
          <View style={styles.plusCircle}>
            <Ionicons name="add" size={22} color={colors.onPrimary} />
          </View>
          <View style={styles.newBtnBody}>
            <Text style={styles.newBtnTitle}>New group</Text>
            <Text style={styles.newBtnSub}>
              Create or join a team, club, or class
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <SectionLabel style={styles.section} right={<Text style={styles.count}>{groups.length}</Text>}>
          All groups
        </SectionLabel>

        {groups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...type.display,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.7,
  },
  plusCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  newBtnBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  newBtnTitle: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  newBtnSub: {
    ...type.caption,
    color: colors.muted,
    marginTop: 1,
  },
  section: {
    marginTop: spacing.xs,
  },
  count: {
    ...type.caption,
    color: colors.muted,
  },
});
