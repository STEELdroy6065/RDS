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
import Screen from '../components/Screen';
import Header from '../components/Header';
import { colors, spacing, radius, type, shadow } from '../theme';
import { useGroups } from '../state/groups';
import { groupTemplates } from '../data/discoverable';

export default function NewGroupScreen({ navigation, route }) {
  const params = route && route.params ? route.params : {};
  const [tab, setTab] = useState(params.initialTab === 'join' ? 'join' : 'create');

  // Replace this screen so Back returns to the Groups list, not the form.
  const openGroup = (groupId) => navigation.replace('GroupDetail', { groupId });

  return (
    <Screen>
      <Header title="New group" onBack={() => navigation.goBack()} />

      <View style={styles.segmentWrap}>
        <Segment label="Create" active={tab === 'create'} onPress={() => setTab('create')} />
        <Segment label="Join" active={tab === 'join'} onPress={() => setTab('join')} />
      </View>

      {tab === 'create' ? (
        <CreateTab onCreated={openGroup} initialTemplateId={params.templateId} />
      ) : (
        <JoinTab onJoined={openGroup} onScan={() => navigation.navigate('ScanGroup')} />
      )}
    </Screen>
  );
}

function Segment({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

// --- Create -------------------------------------------------------------

function CreateTab({ onCreated, initialTemplateId }) {
  const { createGroup } = useGroups();
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(
    groupTemplates.some((t) => t.id === initialTemplateId) ? initialTemplateId : 'class'
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isValid = name.trim().length > 0 && !busy;

  async function submit() {
    if (!isValid) return;
    setBusy(true);
    setError('');
    try {
      const id = await createGroup({ name, templateId });
      onCreated(id);
    } catch (e) {
      setError((e && e.message) || 'Could not create the group. Please try again.');
      setBusy(false);
    }
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
          editable={!busy}
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
                <Text style={[styles.templateLabel, active && styles.templateLabelActive]}>
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

        {error ? <ErrorNote text={error} /> : null}
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
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[styles.ctaText, !isValid && styles.ctaTextDisabled]}>
              Create group
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// --- Join ---------------------------------------------------------------

function JoinTab({ onJoined, onScan }) {
  const { joinByCode } = useGroups();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const codeValid = code.trim().length > 0 && !busy;

  async function join() {
    if (!codeValid) return;
    setBusy(true);
    setError('');
    try {
      const id = await joinByCode(code);
      onJoined(id);
    } catch (e) {
      setError(friendlyJoinError(e && e.message));
      setBusy(false);
    }
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
        <Pressable
          onPress={onScan}
          style={({ pressed }) => [styles.scanBtn, pressed && styles.pressed]}
        >
          <View style={styles.scanIcon}>
            <Ionicons name="qr-code-outline" size={22} color={colors.onPrimary} />
          </View>
          <View style={styles.scanBody}>
            <Text style={styles.scanTitle}>Scan QR code</Text>
            <Text style={styles.scanSub}>Point your camera at a group’s QR</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter a code</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label}>Group code</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Paste a group code"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />

        <View style={styles.joinHint}>
          <Ionicons name="information-circle" size={16} color={colors.muted} />
          <Text style={styles.joinHintText}>
            Ask a group's Admin for its code — you'll find it on the group's
            page. Joining adds you as a Member.
          </Text>
        </View>

        {error ? <ErrorNote text={error} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={join}
          disabled={!codeValid}
          style={({ pressed }) => [
            styles.cta,
            !codeValid && styles.ctaDisabled,
            pressed && codeValid && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[styles.ctaText, !codeValid && styles.ctaTextDisabled]}>
              Join group
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function friendlyJoinError(message = '') {
  if (/duplicate|unique/i.test(message))
    return 'You are already a member of that group.';
  if (/invalid input syntax|uuid/i.test(message))
    return 'That does not look like a valid group code.';
  if (/violates foreign key|not present/i.test(message))
    return 'No group found for that code.';
  return message || 'Could not join. Please check the code and try again.';
}

function ErrorNote({ text }) {
  return (
    <View style={styles.errorNote}>
      <Ionicons name="alert-circle" size={16} color={colors.accent} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
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

  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
  },
  scanIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBody: { flex: 1, marginLeft: spacing.md },
  scanTitle: { ...type.bodyStrong, color: colors.ink },
  scanSub: { ...type.caption, color: colors.muted, marginTop: 1 },
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
  joinHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  joinHintText: {
    ...type.caption,
    color: colors.inkSoft,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },

  errorNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: {
    ...type.caption,
    color: colors.accent,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },

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
    minHeight: 54,
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: colors.surfaceAlt },
  ctaText: { ...type.bodyStrong, color: colors.onPrimary },
  ctaTextDisabled: { color: colors.muted },
  pressed: { opacity: 0.85 },
});
