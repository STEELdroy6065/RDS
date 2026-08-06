import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import { colors, spacing, radius, type } from '../../theme';
import { useSession } from '../../state/session';

const MIN_PASSWORD = 6;

// Shown when the user arrives via the password-reset deep link.
export default function SetNewPasswordScreen() {
  const { updatePassword, endPasswordRecovery, signOut } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordOk = password.length >= MIN_PASSWORD;
  const matches = password === confirm;
  const canSubmit = passwordOk && matches && !loading;

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const { error: err } = await updatePassword(password);
      if (err) {
        setError(err.message || 'Could not update your password.');
        setLoading(false);
        return;
      }
      // Success — leave the recovery flow (the user is now signed in).
      endPasswordRecovery();
    } catch (e) {
      setError((e && e.message) || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function cancel() {
    await signOut();
    endPasswordRecovery();
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Text style={styles.brand}>
            Synq<Text style={styles.dot}>.</Text>
          </Text>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>
            Choose a new password for your account.
          </Text>

          <View style={styles.form}>
            <Field
              icon="lock-closed-outline"
              placeholder={`New password (min ${MIN_PASSWORD} characters)`}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
            <Field
              icon="lock-closed-outline"
              placeholder="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              editable={!loading}
            />
          </View>

          {!matches && confirm.length > 0 ? (
            <Text style={styles.hint}>Passwords don’t match yet.</Text>
          ) : null}

          {error ? (
            <View style={styles.banner}>
              <Ionicons name="alert-circle" size={16} color={colors.accent} />
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.cta,
              !canSubmit && styles.ctaDisabled,
              pressed && canSubmit && styles.pressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.ctaText, !canSubmit && styles.ctaTextDisabled]}>
                Update password
              </Text>
            )}
          </Pressable>

          <Pressable onPress={cancel} hitSlop={8} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({ icon, ...props }) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        secureTextEntry
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  brand: {
    ...type.title,
    fontSize: 22,
    color: colors.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.xl,
  },
  dot: { color: colors.accent },
  title: { ...type.display, fontSize: 28, color: colors.ink },
  subtitle: {
    ...type.body,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  form: { marginTop: spacing.xxl, gap: spacing.md },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  input: {
    ...type.body,
    color: colors.ink,
    flex: 1,
    paddingVertical: spacing.lg,
    marginLeft: spacing.md,
  },
  hint: { ...type.caption, color: colors.muted, marginTop: spacing.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  bannerText: { ...type.caption, color: colors.accent, flex: 1, lineHeight: 18 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 54,
  },
  ctaDisabled: { backgroundColor: colors.surfaceAlt },
  ctaText: { ...type.bodyStrong, fontSize: 16, color: colors.onPrimary },
  ctaTextDisabled: { color: colors.muted },
  pressed: { opacity: 0.85 },
  cancel: { alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm },
  cancelText: { ...type.body, color: colors.muted },
});
