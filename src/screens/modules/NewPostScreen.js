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
import { colors, spacing, radius, type } from '../../theme';
import { useSession } from '../../state/session';
import { supabase } from '../../lib/supabase';

const TYPES = [
  { id: 'Announcement', icon: 'megaphone', tone: colors.accent },
  { id: 'Resource', icon: 'link', tone: colors.info },
  { id: 'Discussion', icon: 'chatbubbles', tone: colors.primary },
];

export default function NewPostScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user } = useSession();

  const [postType, setPostType] = useState('Announcement');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isValid = text.trim().length > 0 && !busy;

  async function submit() {
    if (!isValid) return;
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.from('posts').insert({
        group_id: groupId,
        author_id: user.id,
        author_name: user.name,
        type: postType,
        text: text.trim(),
      });
      if (err) throw err;
      navigation.goBack();
    } catch (e) {
      setError((e && e.message) || 'Could not post. Please try again.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="New post" subtitle={groupName} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Type</Text>
          <View style={styles.types}>
            {TYPES.map((t) => {
              const active = postType === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setPostType(t.id)}
                  style={[styles.type, active && { borderColor: t.tone, backgroundColor: colors.surfaceAlt }]}
                >
                  <Ionicons name={t.icon} size={18} color={active ? t.tone : colors.muted} />
                  <Text style={[styles.typeLabel, active && { color: colors.ink }]}>
                    {t.id}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, styles.spacedLabel]}>Message</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="What do you want to share?"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            editable={!busy}
          />

          {error ? (
            <View style={styles.errorNote}>
              <Ionicons name="alert-circle" size={16} color={colors.accent} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
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
              <Text style={[styles.ctaText, !isValid && styles.ctaTextDisabled]}>Post</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  label: { ...type.label, color: colors.muted, marginBottom: spacing.sm },
  spacedLabel: { marginTop: spacing.xl },
  types: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  type: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    gap: 6,
  },
  typeLabel: { ...type.caption, fontWeight: '600', color: colors.inkSoft },
  input: {
    ...type.body,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    minHeight: 120,
    textAlignVertical: 'top',
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
    justifyContent: 'center',
    minHeight: 54,
  },
  ctaDisabled: { backgroundColor: colors.surfaceAlt },
  ctaText: { ...type.bodyStrong, color: colors.onPrimary },
  ctaTextDisabled: { color: colors.muted },
  pressed: { opacity: 0.85 },
});
