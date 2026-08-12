import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import RoleBadge from '../components/RoleBadge';
import Header from '../components/Header';
import { colors, spacing, radius, type, shadow, roleTheme } from '../theme';
import { useGroups } from '../state/groups';
import { confirm, notify } from '../lib/confirm';

const APP_ROLES = ['Admin', 'Captain', 'Member'];

const MODULES = [
  { key: 'Feed', title: 'Feed', subtitle: 'Posts & announcements', icon: 'chatbubbles-outline' },
  { key: 'Votes', title: 'Votes', subtitle: 'Polls & decisions', icon: 'bar-chart-outline' },
  { key: 'Members', title: 'Members', subtitle: 'Roster & roles', icon: 'people-outline' },
  { key: 'Attendance', title: 'Attendance', subtitle: 'Roll & check-ins', icon: 'calendar-outline' },
];

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { getGroup, membersForGroup, leaveGroup, deleteGroup, updateDescription } = useGroups();
  const group = getGroup(groupId);

  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);

  function onLeave() {
    confirm({
      title: 'Leave group?',
      message: 'You’ll be removed and stop seeing this group.',
      confirmLabel: 'Leave',
      destructive: true,
      onConfirm: async () => {
        try {
          await leaveGroup(groupId);
          navigation.goBack();
        } catch (e) {
          notify({ title: 'Could not leave', message: e && e.message });
        }
      },
    });
  }

  function onDelete() {
    confirm({
      title: 'Delete this group?',
      message:
        'This permanently removes the group and all its posts, votes, and attendance for everyone. This can’t be undone.',
      confirmLabel: 'Delete group',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteGroup(groupId);
          navigation.goBack();
        } catch (e) {
          notify({ title: 'Could not delete', message: e && e.message });
        }
      },
    });
  }

  async function saveDesc() {
    setSavingDesc(true);
    try {
      await updateDescription(groupId, descDraft);
      setEditingDesc(false);
    } catch (e) {
      notify({ title: 'Could not save', message: e && e.message });
    } finally {
      setSavingDesc(false);
    }
  }

  if (!group) {
    return (
      <Screen>
        <Header title="Group info" onBack={() => navigation.goBack()} />
        <View style={styles.groupHead}>
          <Text style={styles.meta}>This group is no longer available.</Text>
        </View>
      </Screen>
    );
  }

  const isAdmin = group.role === 'Admin';
  const isModerator = group.role === 'Admin' || group.role === 'Captain';
  const canInvite = isModerator || group.allowMemberInvite;
  const canViewMembers = isModerator || group.allowMemberViewMembers;
  const members = membersForGroup(groupId);
  const modules = MODULES.filter((m) => m.key !== 'Members' || canViewMembers);

  return (
    <Screen>
      <Header title="Group info" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Identity + editable description */}
        <View style={styles.groupHead}>
          <Avatar emoji={group.emoji} name={group.name} size={84} ring={roleTheme(group.role).ring} />
          <Text style={styles.groupName}>{group.name}</Text>
          <View style={styles.metaRow}>
            <RoleBadge role={group.role} />
            <Badge label={group.kind} tone="neutral" style={{ marginLeft: 8 }} />
            <View style={styles.dot} />
            <Text style={styles.meta}>{group.members} members</Text>
          </View>
        </View>

        <View style={styles.descCard}>
          {editingDesc ? (
            <>
              <TextInput
                value={descDraft}
                onChangeText={setDescDraft}
                placeholder="Add a group description…"
                placeholderTextColor={colors.muted}
                style={styles.descInput}
                multiline
                autoFocus
              />
              <View style={styles.descActions}>
                <Pressable
                  onPress={() => setEditingDesc(false)}
                  style={({ pressed }) => [styles.descBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.descCancel}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveDesc}
                  disabled={savingDesc}
                  style={({ pressed }) => [styles.descBtn, styles.descSave, pressed && styles.pressed]}
                >
                  <Text style={styles.descSaveText}>{savingDesc ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.descRow}>
              <Text style={[styles.descText, !group.description && styles.descEmpty]}>
                {group.description || (isAdmin ? 'Add a group description…' : 'No description yet.')}
              </Text>
              {isAdmin ? (
                <Pressable
                  onPress={() => {
                    setDescDraft(group.description || '');
                    setEditingDesc(true);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [styles.descEdit, pressed && styles.pressed]}
                >
                  <Ionicons name="pencil" size={16} color={colors.inkSoft} />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        {/* 2. Invite QR / code */}
        {canInvite ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Invite to this group</Text>
            <View style={styles.qrTile}>
              <QRCode value={group.id} size={168} color="#000000" backgroundColor="#FFFFFF" />
            </View>
            <Text style={styles.codeHint}>Scan this to join · {group.name}</Text>
            <Text style={styles.codeValue} selectable numberOfLines={1}>
              {group.id}
            </Text>
          </View>
        ) : null}

        {/* 3. Module row */}
        <View style={styles.grid}>
          {modules.map((m) => (
            <ModuleCard
              key={m.key}
              module={m}
              onPress={() =>
                navigation.navigate(m.key, { groupId: group.id, groupName: group.name })
              }
            />
          ))}
        </View>

        {/* 4. Media & links */}
        <InfoRow
          icon="images-outline"
          title="Media & links"
          subtitle="Images and links shared in Feed"
          onPress={() =>
            navigation.navigate('MediaLinks', { groupId: group.id, groupName: group.name })
          }
        />

        {/* 5. Member list */}
        {canViewMembers ? (
          <>
            <Text style={styles.sectionLabel}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
            <View style={styles.memberCard}>
              {members.map((m, i) => {
                const isAppRole = APP_ROLES.includes(m.role);
                const ring = isAppRole ? roleTheme(m.role).ring : undefined;
                return (
                  <View
                    key={m.id}
                    style={[styles.memberRow, i < members.length - 1 && styles.memberBorder]}
                  >
                    <Avatar name={m.name} size={38} ring={ring} />
                    <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                    {isAppRole ? <RoleBadge role={m.role} /> : <Badge label={m.role} tone="neutral" />}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* 6. Group settings */}
        <Text style={styles.sectionLabel}>Group settings</Text>

        {isAdmin ? (
          <InfoRow
            icon="options-outline"
            title="Group permissions"
            subtitle="Control what members can do"
            onPress={() =>
              navigation.navigate('GroupPermissions', { groupId: group.id, groupName: group.name })
            }
          />
        ) : null}

        {isAdmin ? (
          <InfoRow
            icon="people-circle-outline"
            title="Guardians"
            subtitle="Link a parent/guardian to a student"
            onPress={() =>
              navigation.navigate('Guardians', { groupId: group.id, groupName: group.name })
            }
          />
        ) : null}

        <Pressable
          onPress={onLeave}
          style={({ pressed }) => [styles.actionRow, pressed && styles.actionPressed]}
        >
          <Ionicons name="exit-outline" size={20} color={colors.inkSoft} />
          <View style={styles.actionBody}>
            <Text style={styles.actionTitle}>Leave group</Text>
            <Text style={styles.actionSub}>Remove yourself from this group</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        {isAdmin ? (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [styles.actionRow, styles.dangerRow, pressed && styles.actionPressed]}
          >
            <Ionicons name="trash-outline" size={20} color={colors.accent} />
            <View style={styles.actionBody}>
              <Text style={[styles.actionTitle, { color: colors.accent }]}>Delete group</Text>
              <Text style={styles.actionSub}>Permanently removes it and all its data</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.accent} />
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ModuleCard({ module, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.moduleCard, pressed && styles.pressed]}
    >
      <View style={styles.moduleIcon}>
        <Ionicons name={module.icon} size={22} color={colors.inkSoft} />
      </View>
      <Text style={styles.moduleTitle}>{module.title}</Text>
      <Text style={styles.moduleSub}>{module.subtitle}</Text>
    </Pressable>
  );
}

function InfoRow({ icon, title, subtitle, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionPressed]}
    >
      <Ionicons name={icon} size={20} color={colors.inkSoft} />
      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const CARD_GAP = spacing.md;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  groupHead: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  groupName: {
    ...type.title,
    color: colors.ink,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.muted,
    marginHorizontal: spacing.sm,
  },
  meta: { ...type.caption, color: colors.muted },

  // description
  descCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  descRow: { flexDirection: 'row', alignItems: 'flex-start' },
  descText: { ...type.body, color: colors.ink, flex: 1, lineHeight: 21 },
  descEmpty: { color: colors.muted },
  descEdit: { marginLeft: spacing.md, padding: 2 },
  descInput: {
    ...type.body,
    color: colors.ink,
    minHeight: 56,
    textAlignVertical: 'top',
    lineHeight: 21,
  },
  descActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  descBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  descCancel: { ...type.bodyStrong, color: colors.inkSoft },
  descSave: { backgroundColor: colors.primary },
  descSaveText: { ...type.bodyStrong, color: colors.onPrimary },

  // invite QR
  codeCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  codeLabel: { ...type.label, color: colors.muted, marginBottom: spacing.lg },
  qrTile: {
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeHint: { ...type.bodyStrong, fontSize: 13, color: colors.ink, marginTop: spacing.lg },
  codeValue: { ...type.caption, color: colors.muted, marginTop: spacing.xs, fontSize: 11 },

  // module grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  moduleCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: CARD_GAP,
    ...shadow.card,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  moduleIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  moduleTitle: { ...type.heading, color: colors.ink },
  moduleSub: { ...type.caption, color: colors.muted, marginTop: 2 },

  // section label
  sectionLabel: {
    ...type.label,
    color: colors.muted,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },

  // member list
  memberCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  memberBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  memberName: {
    ...type.bodyStrong,
    color: colors.ink,
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },

  // action / info rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  dangerRow: { borderColor: colors.accent },
  actionPressed: { opacity: 0.7 },
  actionBody: { flex: 1, marginLeft: spacing.md },
  actionTitle: { ...type.bodyStrong, color: colors.ink },
  actionSub: { ...type.caption, color: colors.muted, marginTop: 1 },
});
