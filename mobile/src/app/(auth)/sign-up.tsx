import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { FormInput } from '@/components/FormInput';
import { PasswordInput } from '@/components/PasswordInput';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, spacing } from '@/lib/theme';

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function signUp() {
    setSubmitting(true);
    setError(null);
    // handle_new_user() creates the profiles row from this metadata.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }
    // With autoconfirm on, a session comes back and the root layout swaps
    // stacks via the auth listener. Without one, the project requires email
    // confirmation — tell the user instead of leaving the button spinning.
    if (!data.session) {
      setNeedsConfirmation(true);
      setSubmitting(false);
    }
  }

  const canSubmit =
    fullName.trim().length > 0 && email.trim().length > 0 && password.length >= 6 && !submitting;

  if (needsConfirmation) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Confirm your email</Text>
        <Text style={styles.hint}>
          We sent a confirmation link to {email.trim()}. Open it on this phone, then sign in with
          your new password.
        </Text>
        <Link href="/sign-in" style={styles.footerLink}>
          Back to sign in
        </Link>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Create your account</Text>

      <FormInput
        placeholder="Full name"
        autoComplete="name"
        value={fullName}
        onChangeText={setFullName}
      />
      <FormInput
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <PasswordInput
        placeholder="Password (min 6 characters)"
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => canSubmit && signUp()}
      />

      {error && <ErrorText>{error}</ErrorText>}

      <Button
        label="Create account"
        onPress={signUp}
        disabled={!canSubmit}
        loading={submitting}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Link href="/sign-in" style={styles.footerLink}>
          Sign in
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
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 21,
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
