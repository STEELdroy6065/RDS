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
const MIN_PASSWORD = 6;

// Turn Supabase auth errors into clear, user-facing messages.
function friendlyError(message = '') {
  if (/already registered|already exists/i.test(message))
    return 'That email is already registered — try logging in instead.';
  if (/invalid login credentials/i.test(message))
    return 'Wrong email or password.';
  if (/email not confirmed/i.test(message))
    return 'Please confirm your email first, then log in.';
  if (/rate limit|too many/i.test(message))
    return 'Too many attempts. Please wait a moment and try again.';
  return message || 'Something went wrong. Please try again.';
}

export default function AuthScreen({ navigation }) {
  const { signUp, signIn } = useSession();
  const [mode, setMode] = useState('signup'); // 'signup' | 'login'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const isLogin = mode === 'login';

  const emailOk = EMAIL_RE.test(email.trim());
  const passwordOk = password.length >= MIN_PASSWORD;
  const nameOk = isLogin || name.trim().length > 0;
  const canSubmit = emailOk && passwordOk && nameOk && !loading;

  function switchMode() {
    setMode(isLogin ? 'signup' : 'login');
    setError('');
    setInfo('');
  }

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setInfo('');

    try {
      if (isLogin) {
        const { error: err } = await signIn({ email, password });
        if (err) setError(friendlyError(err.message));
        // On success, the auth listener swaps the navigator into the app.
      } else {
        const { data, error: err } = await signUp({ name, email, password });
        if (err) {
          setError(friendlyError(err.message));
        } else if (!data.session) {
          // Email confirmation is enabled on the project.
          setInfo('Account created! Check your email to confirm, then log in.');
          setMode('login');
          setPassword('');
        }
      }
    } catch (e) {
      setError(friendlyError(e && e.message));
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
          <Text style={styles.title}>
            {isLogin ? 'Welcome back' : 'Create your account'}
          </Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? 'Log in to pick up where you left off.'
              : 'Set up RDS in a few seconds.'}
          </Text>

          <View style={styles.form}>
            {!isLogin ? (
              <Field
                icon="person-outline"
                placeholder="Full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            ) : null}
            <Field
              icon="mail-outline"
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            <Field
              icon="lock-closed-outline"
              placeholder={`Password (min ${MIN_PASSWORD} characters)`}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          {isLogin ? (
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              hitSlop={6}
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          ) : null}

          {error ? (
            <View style={styles.banner}>
              <Ionicons name="alert-circle" size={16} color={colors.accent} />
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}
          {info ? (
            <View style={[styles.banner, styles.bannerInfo]}>
              <Ionicons name="mail-unread" size={16} color={colors.primary} />
              <Text style={[styles.bannerText, styles.bannerTextInfo]}>{info}</Text>
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
              <>
                <Text
                  style={[styles.ctaText, !canSubmit && styles.ctaTextDisabled]}
                >
                  {isLogin ? 'Log in' : 'Create account'}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={canSubmit ? colors.onPrimary : colors.muted}
                />
              </>
            )}
          </Pressable>

          {!isLogin ? (
            <Text style={styles.consent}>
              By continuing you agree to how your data is used —{' '}
              <Text
                style={styles.consentLink}
                onPress={() => navigation.navigate('PrivacyNotice')}
              >
                view
              </Text>
            </Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.togglePrompt}>
            {isLogin ? 'New to RDS?' : 'Already have an account?'}
          </Text>
          <Pressable onPress={switchMode} hitSlop={8} disabled={loading}>
            <Text style={styles.toggleLink}>{isLogin ? 'Sign up' : 'Log in'}</Text>
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
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
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
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  brand: {
    ...type.title,
    fontSize: 22,
    color: colors.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.xl,
  },
  dot: { color: colors.accent },
  title: {
    ...type.display,
    fontSize: 30,
    color: colors.ink,
  },
  subtitle: {
    ...type.body,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
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
  forgot: {
    alignSelf: 'flex-end',
    marginTop: spacing.md,
    paddingVertical: 2,
  },
  forgotText: { ...type.bodyStrong, fontSize: 13, color: colors.primary },
  consent: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  consentLink: { color: colors.primary, fontWeight: '700' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  bannerInfo: { backgroundColor: colors.primarySoft },
  bannerText: { ...type.caption, color: colors.accent, flex: 1, lineHeight: 18 },
  bannerTextInfo: { color: colors.primaryDark },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
    minHeight: 54,
  },
  ctaDisabled: { backgroundColor: colors.surfaceAlt },
  pressed: { opacity: 0.85 },
  ctaText: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.onPrimary,
  },
  ctaTextDisabled: { color: colors.muted },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: 6,
  },
  togglePrompt: {
    ...type.body,
    color: colors.muted,
  },
  toggleLink: {
    ...type.bodyStrong,
    color: colors.primary,
  },
});
