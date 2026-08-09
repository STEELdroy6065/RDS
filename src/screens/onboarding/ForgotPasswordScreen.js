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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }) {
  const { resetPassword } = useSession();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const emailOk = EMAIL_RE.test(email.trim());

  async function submit() {
    if (!emailOk || loading) return;
    setLoading(true);
    setError('');
    try {
      const { error: err } = await resetPassword(email);
      if (err) setError(err.message || 'Could not send the reset email.');
      else setSent(true);
    } catch (e) {
      setError((e && e.message) || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.brand}>
            RDS<Text style={styles.dot}>.</Text>
          </Text>

          {sent ? (
            <>
              <View style={styles.sentIcon}>
                <Ionicons name="mail-unread" size={30} color={colors.primary} />
              </View>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                If an account exists for {email.trim()}, we’ve sent a link to
                reset your password. Open it on this device to continue.
              </Text>
              <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              >
                <Text style={styles.ctaText}>Back to log in</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Reset your password</Text>
              <Text style={styles.subtitle}>
                Enter your email and we’ll send you a link to set a new password.
              </Text>

              <View style={styles.field}>
                <Ionicons name="mail-outline" size={20} color={colors.muted} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              {error ? (
                <View style={styles.banner}>
                  <Ionicons name="alert-circle" size={16} color={colors.accent} />
                  <Text style={styles.bannerText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={submit}
                disabled={!emailOk || loading}
                style={({ pressed }) => [
                  styles.cta,
                  (!emailOk || loading) && styles.ctaDisabled,
                  pressed && emailOk && !loading && styles.pressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.ctaText, !emailOk && styles.ctaTextDisabled]}>
                    Send reset link
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  brand: {
    ...type.title,
    fontSize: 22,
    color: colors.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.xl,
  },
  dot: { color: colors.accent },
  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...type.display, fontSize: 28, color: colors.ink },
  subtitle: {
    ...type.body,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
  },
  input: {
    ...type.body,
    color: colors.ink,
    flex: 1,
    paddingVertical: spacing.lg,
    marginLeft: spacing.md,
  },
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
});
