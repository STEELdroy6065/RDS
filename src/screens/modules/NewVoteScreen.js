import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { colors, spacing, radius, type } from '../../theme';
import { useSession } from '../../state/session';
import { useGroups } from '../../state/groups';
import { useVotes } from '../../state/votes';
import { canCreateVote } from '../../state/voteRules';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

export default function NewVoteScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useSession();
  const { roleForGroup } = useGroups();
  const { createVote } = useVotes();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [visibility, setVisibility] = useState('live'); // 'live' | 'hidden'

  // Defensive guard: this screen should be unreachable for Members.
  const role = roleForGroup(groupId);
  if (!canCreateVote(role)) {
    return (
      <Screen>
        <Header title="New vote" subtitle={groupName} onBack={() => navigation.goBack()} />
        <View style={styles.denied}>
          <Ionicons name="lock-closed" size={28} color={colors.muted} />
          <Text style={styles.deniedText}>
            Only Captains and Admins can create votes.
          </Text>
        </View>
      </Screen>
    );
  }

  const filledOptions = options.map((o) => o.trim()).filter(Boolean);
  const isValid = question.trim().length > 0 && filledOptions.length >= MIN_OPTIONS;

  function setOption(index, value) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    if (options.length < MAX_OPTIONS) setOptions((prev) => [...prev, '']);
  }

  function removeOption(index) {
    if (options.length > MIN_OPTIONS) {
      setOptions((prev) => prev.filter((_, i) => i !== index));
    }
  }

  function submit() {
    if (!isValid) return;
    const voteId = createVote({
      groupId,
      question,
      options: filledOptions,
      visibility,
      creator: user,
    });
    // Replace so Back returns to the votes list, not the empty form.
    navigation.replace('VoteDetail', { voteId, groupName });
  }

  return (
    <Screen>
      <Header title="New vote" subtitle={groupName} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Question */}
          <Text style={styles.label}>Question</Text>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="What do you want to ask?"
            placeholderTextColor={colors.muted}
            style={styles.questionInput}
            multiline
          />

          {/* Options */}
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
            <Pressable
              onPress={addOption}
              style={({ pressed }) => [styles.addOption, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addOptionText}>Add option</Text>
            </Pressable>
          ) : null}

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
            subtitle="Members only see how many voted. You reveal results when you close the vote."
          />
        </ScrollView>

        {/* Submit */}
        <View style={styles.footer}>
          <Pressable
            onPress={submit}
            disabled={!isValid}
            style={({ pressed }) => [
              styles.submit,
              !isValid && styles.submitDisabled,
              pressed && isValid && styles.pressed,
            ]}
          >
            <Text style={[styles.submitText, !isValid && styles.submitTextDisabled]}>
              Create vote
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function VisibilityCard({ active, onPress, icon, title, subtitle }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.visCard,
        active && styles.visCardActive,
        pressed && styles.pressed,
      ]}
    >
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  denied: { alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  deniedText: { ...type.body, color: colors.muted, textAlign: 'center' },
  label: { ...type.label, color: colors.muted, marginBottom: spacing.sm },
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
  optionsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hintSmall: { ...type.caption, color: colors.muted },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
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
  addOption: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    marginTop: 2,
  },
  addOptionText: {
    ...type.bodyStrong,
    color: colors.primary,
    marginLeft: 4,
  },
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
  visIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  },
  submitDisabled: { backgroundColor: colors.surfaceAlt },
  submitText: { ...type.bodyStrong, color: colors.onPrimary },
  submitTextDisabled: { color: colors.muted },
  pressed: { opacity: 0.85 },
});
