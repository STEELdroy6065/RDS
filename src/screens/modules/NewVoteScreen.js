import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import Avatar from '../../components/Avatar';
import { colors, spacing, radius, type } from '../../theme';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { useVotes } from '../../state/votes';
import { canCreateVote } from '../../state/voteRules';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

// Term-length presets for an election (weeks → a concrete end date).
const TERMS = [
  { label: '6 weeks', weeks: 6 },
  { label: '1 term', weeks: 13 },
  { label: '1 semester', weeks: 20 },
  { label: 'No end date', weeks: null },
];

function dateStr(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function termEndDate(weeks) {
  if (!weeks) return null;
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return dateStr(d);
}

export default function NewVoteScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useSession();
  const { roleForGroup, membersForGroup } = useGroups();
  const { createVote } = useVotes();

  const [kind, setKind] = useState('poll'); // 'poll' | 'captain_election'
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [candidates, setCandidates] = useState([]); // member ids
  const [termWeeks, setTermWeeks] = useState(13);
  const [visibility, setVisibility] = useState('live'); // 'live' | 'hidden'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const role = roleForGroup(groupId);
  if (!canCreateVote(role)) {
    return (
      <Screen>
        <Header title="New vote" subtitle={groupName} onBack={() => navigation.goBack()} />
        <View style={styles.denied}>
          <Ionicons name="lock-closed" size={28} color={colors.muted} />
          <Text style={styles.deniedText}>Only Captains and Admins can create votes.</Text>
        </View>
      </Screen>
    );
  }

  // Eligible candidates: members of the group who aren't guardians.
  const eligible = membersForGroup(groupId).filter((m) => m.role !== 'Guardian');
  const isElection = kind === 'captain_election';

  const filledOptions = options.map((o) => o.trim()).filter(Boolean);
  const isValid = isElection
    ? question.trim().length > 0 && candidates.length >= 2 && !busy
    : question.trim().length > 0 && filledOptions.length >= MIN_OPTIONS && !busy;

  function switchKind(next) {
    setKind(next);
    if (next === 'captain_election' && !question.trim()) setQuestion('Elect the new Captain');
    if (next === 'captain_election') setVisibility('hidden');
  }

  function setOption(index, value) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }
  function addOption() {
    if (options.length < MAX_OPTIONS) setOptions((prev) => [...prev, '']);
  }
  function removeOption(index) {
    if (options.length > MIN_OPTIONS) setOptions((prev) => prev.filter((_, i) => i !== index));
  }
  function toggleCandidate(id) {
    setCandidates((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (!isValid) return;
    setBusy(true);
    setError('');
    try {
      const opts = isElection
        ? candidates.map((id) => {
            const m = eligible.find((e) => e.id === id);
            return { label: m ? m.name : 'Candidate', candidateId: id };
          })
        : filledOptions;
      const voteId = await createVote({
        groupId,
        question,
        options: opts,
        visibility,
        creator: user,
        kind,
        termEnds: isElection ? termEndDate(termWeeks) : null,
      });
      navigation.replace('VoteDetail', { voteId, groupName });
    } catch (e) {
      setError((e && e.message) || 'Could not create the vote. Please try again.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="New vote" subtitle={groupName} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type */}
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            <TypeChip
              active={kind === 'poll'}
              icon="bar-chart-outline"
              label="Poll"
              onPress={() => switchKind('poll')}
            />
            <TypeChip
              active={isElection}
              icon="ribbon-outline"
              label="Captain election"
              onPress={() => switchKind('captain_election')}
            />
          </View>

          {/* Question */}
          <Text style={styles.label}>Question</Text>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder={isElection ? 'Elect the new Captain' : 'What do you want to ask?'}
            placeholderTextColor={colors.muted}
            style={styles.questionInput}
            multiline
          />

          {isElection ? (
            <>
              <View style={styles.optionsHead}>
                <Text style={styles.label}>Candidates</Text>
                <Text style={styles.hintSmall}>{candidates.length} selected</Text>
              </View>
              <Text style={styles.helpText}>
                Pick who's standing. The winner becomes Captain when you close the election.
              </Text>
              <View style={styles.candidateList}>
                {eligible.length === 0 ? (
                  <Text style={styles.hintSmall}>No eligible members yet.</Text>
                ) : (
                  eligible.map((m) => {
                    const on = candidates.includes(m.id);
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => toggleCandidate(m.id)}
                        style={({ pressed }) => [styles.candidate, on && styles.candidateOn, pressed && styles.pressed]}
                      >
                        <Avatar name={m.name} uri={m.avatarUrl} size={34} />
                        <Text style={styles.candidateName} numberOfLines={1}>
                          {m.id === user.id ? `${m.name} (you)` : m.name}
                        </Text>
                        <View style={[styles.check, on && styles.checkOn]}>
                          {on ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>

              <Text style={[styles.label, styles.visLabel]}>Term length</Text>
              <View style={styles.termRow}>
                {TERMS.map((t) => {
                  const on = termWeeks === t.weeks;
                  return (
                    <Pressable
                      key={t.label}
                      onPress={() => setTermWeeks(t.weeks)}
                      style={[styles.termChip, on && styles.termChipOn]}
                    >
                      <Text style={[styles.termChipText, on && styles.termChipTextOn]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <View style={styles.optionsHead}>
                <Text style={styles.label}>Options</Text>
                <Text style={styles.hintSmall}>
                  {filledOptions.length}/{MAX_OPTIONS}
                </Text>
              </View>

              {options.map((opt, i) => (
                <View key={i} style={styles.optionRow}>
                  <View style={styles.optionBullet}>
                    <Text style={styles.optionBulletText}>{i + 1}</Text>
                  </View>
                  <TextInput
                    value={opt}
                    onChangeText={(v) => setOption(i, v)}
                    placeholder={`Option ${i + 1}`}
                    placeholderTextColor={colors.muted}
                    style={styles.optionInput}
                  />
                  {options.length > MIN_OPTIONS ? (
                    <Pressable onPress={() => removeOption(i)} hitSlop={8} style={styles.removeBtn}>
                      <Ionicons name="close" size={18} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
              ))}

              {options.length < MAX_OPTIONS ? (
                <Pressable onPress={addOption} style={({ pressed }) => [styles.addOption, pressed && styles.pressed]}>
                  <Ionicons name="add" size={18} color={colors.primary} />
                  <Text style={styles.addOptionText}>Add option</Text>
                </Pressable>
              ) : null}
            </>
          )}

          {/* Visibility */}
          <Text style={[styles.label, styles.visLabel]}>Results visibility</Text>
          <VisibilityCard
            active={visibility === 'live'}
            onPress={() => setVisibility('live')}
            icon="radio"
            title="Show results live"
            subtitle="Everyone sees counts and voter names as votes come in."
          />
          <VisibilityCard
            active={visibility === 'hidden'}
            onPress={() => setVisibility('hidden')}
            icon="eye-off"
            title="Hide until I close it"
            subtitle="Members only see how many voted. You reveal results when you close it."
          />
        </ScrollView>

        <View style={styles.footer}>
          {error ? (
            <View style={styles.errorNote}>
              <Ionicons name="alert-circle" size={16} color={colors.accent} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={submit}
            disabled={!isValid}
            style={({ pressed }) => [styles.submit, !isValid && styles.submitDisabled, pressed && isValid && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.submitText, !isValid && styles.submitTextDisabled]}>
                {isElection ? 'Open election' : 'Create vote'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TypeChip({ active, icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.typeChip, active && styles.typeChipOn, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={active ? colors.onPrimary : colors.inkSoft} />
      <Text style={[styles.typeChipText, active && styles.typeChipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function VisibilityCard({ active, onPress, icon, title, subtitle }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.visCard, active && styles.visCardActive, pressed && styles.pressed]}>
      <View style={[styles.visIcon, active && styles.visIconActive]}>
        <Ionicons name={icon} size={18} color={active ? colors.onPrimary : colors.muted} />
      </View>
      <View style={styles.visBody}>
        <Text style={styles.visTitle}>{title}</Text>
        <Text style={styles.visSub}>{subtitle}</Text>
      </View>
      <View style={[styles.check, active && styles.checkOn]}>
        {active ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  denied: { alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  deniedText: { ...type.body, color: colors.muted, textAlign: 'center' },
  label: { ...type.label, color: colors.muted, marginBottom: spacing.sm },
  helpText: { ...type.caption, color: colors.muted, marginBottom: spacing.md, marginTop: -2, lineHeight: 18 },

  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  typeChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { ...type.bodyStrong, fontSize: 14, color: colors.inkSoft },
  typeChipTextOn: { color: colors.onPrimary },

  questionInput: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: spacing.xl,
  },
  optionsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hintSmall: { ...type.caption, color: colors.muted },

  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  optionBullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionBulletText: { ...type.label, fontSize: 11, color: colors.primary },
  optionInput: {
    ...type.body,
    color: colors.ink,
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  removeBtn: { padding: spacing.sm, marginLeft: 2 },
  addOption: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: spacing.sm, marginTop: 2 },
  addOptionText: { ...type.bodyStrong, color: colors.primary, marginLeft: 4 },

  candidateList: { gap: spacing.sm },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  candidateOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  candidateName: { ...type.bodyStrong, color: colors.ink, flex: 1 },

  termRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  termChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  termChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  termChipText: { ...type.caption, fontWeight: '700', color: colors.inkSoft },
  termChipTextOn: { color: colors.onPrimary },

  visLabel: { marginTop: spacing.xl },
  visCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  visCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  visIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  visIconActive: { backgroundColor: colors.primary },
  visBody: { flex: 1, marginHorizontal: spacing.md },
  visTitle: { ...type.bodyStrong, color: colors.ink },
  visSub: { ...type.caption, color: colors.inkSoft, marginTop: 2, lineHeight: 17 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  submitDisabled: { backgroundColor: colors.surfaceAlt },
  submitText: { ...type.bodyStrong, color: colors.onPrimary },
  submitTextDisabled: { color: colors.muted },
  pressed: { opacity: 0.85 },
  errorNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md },
  errorText: { ...type.caption, color: colors.accent, marginLeft: spacing.sm, flex: 1, lineHeight: 18 },
});
