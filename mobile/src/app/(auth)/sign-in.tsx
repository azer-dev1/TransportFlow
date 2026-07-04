import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { FormInput } from '@/components/FormInput';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, spacing } from '@/lib/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn() {
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    // On success the root layout swaps stacks via the auth listener;
    // this screen unmounts, so only reset state on failure.
    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Welcome back</Text>

      <FormInput
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <FormInput
        placeholder="Password"
        autoComplete="current-password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => canSubmit && signIn()}
      />

      {error && <ErrorText>{error}</ErrorText>}

      <Link href="/forgot-password" style={styles.forgotLink}>
        Forgot password?
      </Link>

      <Button label="Sign in" onPress={signIn} disabled={!canSubmit} loading={submitting} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>No account yet? </Text>
        <Link href="/sign-up" style={styles.footerLink}>
          Create one
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  forgotLink: {
    color: colors.primary,
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    color: colors.textMuted,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
