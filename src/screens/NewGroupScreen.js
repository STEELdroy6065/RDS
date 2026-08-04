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
import Screen from '../components/Screen';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import Header from '../components/Header';
import { colors, spacing, radius, type, shadow } from '../theme';
import { useGroups } from '../state/groups';
import { discoverableGroups, groupTemplates } from '../data/discoverable';

export default function NewGroupScreen({ navigation }) {
  const [tab, setTab] = useState('create'); // 'create' | 'join'

  // Replace this screen so Back returns to the Groups list, not the form.
  const openGroup = (groupId) =>
    navigation.replace('GroupDetail', { groupId });

  return (
    <Screen>
      <Header title="New group" onBack={() => navigation.goBack()} />

      <View style={styles.segmentWrap}>
        <Segment label="Create" active={tab === 'create'} onPress={() => setTab('create')} />
        <Segment label="Join" active={tab === 'join'} onPress={() => setTab('join')} />
      </View>

      {tab === 'create' ? (
        <CreateTab onCreated={openGroup} />
      ) : (
        <JoinTab onJoined={openGroup} />
      )}
    </Screen>
  );
}

function Segment({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segment, active && styles.segmentActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// --- Create -------------------------------------------------------------

function CreateTab({ onCreated }) {
  const { createGroup } = useGroups();
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('class');

  const isValid = name.trim().length > 0;

  function submit() {
    if (!isValid) return;
    const id = createGroup({ name, templateId });
    onCreated(id);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Group name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Junior Track Team"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="words"
        />

        <Text style={[styles.label, styles.spacedLabel]}>Template</Text>
        <View style={styles.templates}>
          {groupTemplates.map((t) => {
            const active = templateId === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTemplateId(t.id)}
                style={[styles.template, active && styles.templateActive]}
              >
                <Text style={styles.templateEmoji}>{t.emoji}</Text>
                <Text
                  style={[styles.templateLabel, active && styles.templateLabelActive]}
                >
                  {t.label}
                </Text>
                {active ? (
                  <View style={styles.templateCheck}>
                    <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.roleHint}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <Text style={styles.roleHintText}>
            You'll be the Admin of this group, starting with 1 member.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={submit}
          disabled={!isValid}
          style={({ pressed }) => [
            styles.cta,
            !isValid && styles.ctaDisabled,
            pressed && isValid && styles.pressed,
          ]}
        >
          <Text style={[styles.ctaText, !isValid && styles.ctaTextDisabled]}>
            Create group
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- Join ---------------------------------------------------------------

function JoinTab({ onJoined }) {
  const { joinGroup, joinByCode } = useGroups();
  const [code, setCode] = useState('');

  const codeValid = code.trim().length > 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Group code</Text>
      <View style={styles.codeRow}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Enter a code"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.codeInput]}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Pressable
          onPress={() => codeValid && onJoined(joinByCode(code))}
          disabled={!codeValid}
          style={({ pressed }) => [
            styles.codeBtn,
            !codeValid && styles.codeBtnDisabled,
            pressed && codeValid && styles.pressed,
          ]}
        >
          <Text style={[styles.codeBtnText, !codeValid && styles.ctaTextDisabled]}>
            Join
          </Text>
        </Pressable>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or discover</Text>
        <View style={styles.dividerLine} />
      </View>

      {discoverableGroups.map((g) => (
        <Card key={g.key} style={styles.discCard}>
          <View style={styles.discRow}>
            <Avatar emoji={g.emoji} name={g.name} size={46} />
            <View style={styles.discBody}>
              <Text style={styles.discName} numberOfLines={1}>
                {g.name}
              </Text>
              <Text style={styles.discBlurb} numberOfLines={1}>
                {g.blurb}
              </Text>
              <Text style={styles.discMeta}>
                {g.kind} · {g.members} members
              </Text>
            </View>
            <Pressable
              onPress={() => onJoined(joinGroup(g))}
              style={({ pressed }) => [styles.joinBtn, pressed && styles.pressed]}
            >
              <Text style={styles.joinBtnText}>Join</Text>
            </Pressable>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  segmentText: { ...type.bodyStrong, color: colors.muted },
  segmentTextActive: { color: colors.ink },

  label: { ...type.label, color: colors.muted, marginBottom: spacing.sm },
  spacedLabel: { marginTop: spacing.xl },
  input: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  templates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  template: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  templateActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  templateEmoji: { fontSize: 26, marginBottom: spacing.sm },
  templateLabel: { ...type.bodyStrong, color: colors.inkSoft },
  templateLabelActive: { color: colors.ink },
  templateCheck: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  roleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  roleHintText: {
    ...type.caption,
    color: colors.primaryDark,
    marginLeft: spacing.sm,
    flex: 1,
  },

  codeRow: { flexDirection: 'row', gap: spacing.md },
  codeInput: { flex: 1 },
  codeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBtnDisabled: { backgroundColor: colors.surfaceAlt },
  codeBtnText: { ...type.bodyStrong, color: colors.onPrimary },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: {
    ...type.label,
    color: colors.muted,
    marginHorizontal: spacing.md,
  },

  discCard: { marginBottom: spacing.md },
  discRow: { flexDirection: 'row', alignItems: 'center' },
  discBody: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  discName: { ...type.bodyStrong, color: colors.ink },
  discBlurb: { ...type.caption, color: colors.inkSoft, marginTop: 1 },
  discMeta: { ...type.caption, color: colors.muted, marginTop: 3 },
  joinBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  joinBtnText: { ...type.bodyStrong, color: colors.primary },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: colors.surfaceAlt },
  ctaText: { ...type.bodyStrong, color: colors.onPrimary },
  ctaTextDisabled: { color: colors.muted },
  pressed: { opacity: 0.85 },
});
