import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import Avatar from '../../components/Avatar';
import RoleBadge from '../../components/RoleBadge';
import { colors, spacing, radius, type, monoFamily } from '../../theme';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { fetchGroupGuardianLinks, setGuardian, removeGuardianLink } from '../../lib/guardian';
import { confirm, notify } from '../../lib/confirm';

// Admin-only: link a parent/guardian (an existing member) to a student. Names
// for other members aren't available yet (no profiles table), so members are
// shown by role and a short id, and the admin types the student's name.
export default function GuardiansScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useSession();
  const { membersForGroup } = useGroups();
  const members = membersForGroup(groupId);

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guardianId, setGuardianId] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLinks(await fetchGroupGuardianLinks(groupId));
    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const label = (m) =>
    m.id === user.id ? `${m.name} (you)` : `${m.name} · ${m.id.slice(0, 6)}`;

  const canLink = guardianId && studentId && guardianId !== studentId;

  async function link() {
    if (!canLink || busy) return;
    setBusy(true);
    try {
      await setGuardian({ groupId, guardianId, studentId, studentName: studentName.trim() });
      setGuardianId(null);
      setStudentId(null);
      setStudentName('');
      await refresh();
      notify({ title: 'Guardian linked', message: 'They now see this student’s attendance only.' });
    } catch (e) {
      notify({ title: 'Could not link', message: (e && e.message) || 'Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(l) {
    confirm({
      title: 'Remove guardian link?',
      message: 'They will no longer see this student’s attendance.',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: async () => {
        try {
          await removeGuardianLink(l.id);
          await refresh();
        } catch (e) {
          notify({ title: 'Could not remove', message: (e && e.message) || 'Please try again.' });
        }
      },
    });
  }

  return (
    <Screen>
      <Header title="Guardians" subtitle={groupName} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        {/* New link */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Link a guardian</Text>

          <Text style={styles.pickLabel}>GUARDIAN</Text>
          <MemberPicker members={members} selected={guardianId} onSelect={setGuardianId} label={label} />

          <Text style={styles.pickLabel}>STUDENT</Text>
          <MemberPicker members={members} selected={studentId} onSelect={setStudentId} label={label} />

          <Text style={styles.pickLabel}>STUDENT NAME (SHOWN TO GUARDIAN)</Text>
          <TextInput
            value={studentName}
            onChangeText={setStudentName}
            placeholder="e.g. Naomi Sarufa"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Pressable
            onPress={link}
            disabled={!canLink || busy}
            style={({ pressed }) => [
              styles.linkBtn,
              (!canLink || busy) && styles.linkBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.linkBtnText}>Link guardian</Text>
            )}
          </Pressable>
          {guardianId && studentId && guardianId === studentId ? (
            <Text style={styles.warn}>A guardian can’t be linked to themselves.</Text>
          ) : null}
        </View>

        {/* Existing links */}
        <Text style={styles.section}>LINKED · {links.length}</Text>
        {links.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-circle-outline" size={28} color={colors.muted} />
            <Text style={styles.emptyText}>{loading ? 'Loading…' : 'No guardians linked yet.'}</Text>
          </View>
        ) : (
          links.map((l) => (
            <View key={l.id} style={styles.linkRow}>
              <Avatar name={l.student_name || 'Student'} size={36} />
              <View style={styles.linkBody}>
                <Text style={styles.linkName}>{l.student_name || 'Student'}</Text>
                <Text style={styles.linkSub}>
                  Guardian {l.guardian_id.slice(0, 6)} · student {l.student_id.slice(0, 6)}
                </Text>
              </View>
              <Pressable onPress={() => confirmRemove(l)} hitSlop={8} style={styles.remove}>
                <Ionicons name="close-circle" size={22} color={colors.muted} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function MemberPicker({ members, selected, onSelect, label }) {
  const rows = useMemo(() => members, [members]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.pickRow}
    >
      {rows.map((m) => {
        const on = m.id === selected;
        return (
          <Pressable
            key={m.id}
            onPress={() => onSelect(on ? null : m.id)}
            style={[styles.pickChip, on && styles.pickChipOn]}
          >
            <Avatar name={m.name} uri={m.avatarUrl} size={26} />
            <Text style={[styles.pickChipText, on && styles.pickChipTextOn]} numberOfLines={1}>
              {label(m)}
            </Text>
            <RoleBadge role={m.role} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  pressed: { opacity: 0.85 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: { ...type.heading, color: colors.ink, marginBottom: spacing.md },
  pickLabel: { ...type.monoLabel, fontSize: 10, letterSpacing: 1, color: colors.muted, marginBottom: spacing.sm, marginTop: spacing.sm },
  pickRow: { gap: spacing.sm, paddingBottom: spacing.xs },
  pickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
    maxWidth: 200,
  },
  pickChipOn: { borderColor: colors.primary, backgroundColor: colors.surface },
  pickChipText: { ...type.caption, color: colors.inkSoft, flexShrink: 1 },
  pickChipTextOn: { color: colors.ink, fontWeight: '600' },
  input: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  linkBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  linkBtnDisabled: { backgroundColor: colors.surfaceAlt },
  linkBtnText: { ...type.bodyStrong, color: colors.onPrimary },
  warn: { ...type.caption, color: colors.accent, marginTop: spacing.sm, textAlign: 'center' },

  section: { ...type.monoLabel, fontSize: 11, letterSpacing: 1, color: colors.muted, marginBottom: spacing.sm },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { ...type.body, color: colors.muted },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  linkBody: { flex: 1, marginLeft: spacing.md },
  linkName: { ...type.bodyStrong, color: colors.ink },
  linkSub: { fontFamily: monoFamily, fontSize: 11, color: colors.muted, marginTop: 2 },
  remove: { padding: 2 },
});
