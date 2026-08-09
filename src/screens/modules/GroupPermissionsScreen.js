import React, { useState } from 'react';
import { View, Text, ScrollView, Switch, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { colors, spacing, radius, type } from '../../theme';
import { useGroups } from '../../state/groups';
import { notify } from '../../lib/confirm';

const PERMISSIONS = [
  {
    key: 'allowMemberPost',
    icon: 'chatbubble-ellipses-outline',
    title: 'Post in Feed',
    subtitle: 'Members can send messages in the group feed.',
  },
  {
    key: 'allowMemberInvite',
    icon: 'person-add-outline',
    title: 'Invite new people',
    subtitle: 'Members can see and share the group’s invite code.',
  },
  {
    key: 'allowMemberViewMembers',
    icon: 'people-outline',
    title: 'See the member list',
    subtitle: 'Members can view who else is in the group.',
  },
];

export default function GroupPermissionsScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { getGroup, updatePermissions } = useGroups();
  const group = getGroup(groupId);

  // Track the switches locally for instant feedback; the group reload keeps
  // them in sync and we revert on error.
  const [values, setValues] = useState({
    allowMemberPost: group ? group.allowMemberPost : true,
    allowMemberInvite: group ? group.allowMemberInvite : true,
    allowMemberViewMembers: group ? group.allowMemberViewMembers : true,
  });

  async function toggle(key, next) {
    const prev = values[key];
    setValues((v) => ({ ...v, [key]: next }));
    try {
      await updatePermissions(groupId, { [key]: next });
    } catch (e) {
      setValues((v) => ({ ...v, [key]: prev }));
      notify({ title: 'Could not update', message: e && e.message });
    }
  }

  return (
    <Screen>
      <Header title="Group permissions" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Choose what regular Members can do. Admins and Captains are always allowed.
        </Text>

        <View style={styles.card}>
          {PERMISSIONS.map((p, i) => (
            <View
              key={p.key}
              style={[styles.row, i < PERMISSIONS.length - 1 && styles.rowBorder]}
            >
              <View style={styles.icon}>
                <Ionicons name={p.icon} size={20} color={colors.inkSoft} />
              </View>
              <View style={styles.body}>
                <Text style={styles.title}>{p.title}</Text>
                <Text style={styles.subtitle}>{p.subtitle}</Text>
              </View>
              <Switch
                value={values[p.key]}
                onValueChange={(next) => toggle(p.key, next)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
                ios_backgroundColor={colors.border}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  intro: { ...type.caption, color: colors.muted, marginBottom: spacing.lg, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { ...type.bodyStrong, color: colors.ink },
  subtitle: { ...type.caption, color: colors.muted, marginTop: 2, lineHeight: 17 },
});
