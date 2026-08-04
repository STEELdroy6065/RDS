import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../components/Screen';
import { colors, spacing, radius, type } from '../../theme';

// Mock auth: UI only. "Continue" always drops into the app on the existing
// mock data — no accounts, no validation, no persistence yet. The Log in /
// Sign up toggle is purely visual and doesn't branch.
export default function AuthScreen({ navigation }) {
  const [mode, setMode] = useState('signup'); // 'signup' | 'login'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const isLogin = mode === 'login';

  const enterApp = () => {
    // Reset so Back can't return to onboarding.
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

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
            Synq<Text style={styles.dot}>.</Text>
          </Text>
          <Text style={styles.title}>
            {isLogin ? 'Welcome back' : 'Create your account'}
          </Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? 'Log in to pick up where you left off.'
              : 'Set up Synq in a few seconds.'}
          </Text>

          <View style={styles.form}>
            {/* Name — shown for sign up; the toggle is visual only so we keep
                the field mounted and simply de-emphasize it on login. */}
            <Field
              icon="person-outline"
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <Field
              icon="mail-outline"
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Pressable
            onPress={enterApp}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
          </Pressable>

          <Text style={styles.disclaimer}>
            Demo only — no account is created and nothing is saved.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.togglePrompt}>
            {isLogin ? 'New to Synq?' : 'Already have an account?'}
          </Text>
          <Pressable onPress={() => setMode(isLogin ? 'signup' : 'login')} hitSlop={8}>
            <Text style={styles.toggleLink}>
              {isLogin ? 'Sign up' : 'Log in'}
            </Text>
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
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  ctaText: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.onPrimary,
  },
  disclaimer: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
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
