import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { FormInput } from '@/components/FormInput';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, spacing } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendResetEmail() {
    setSubmitting(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Must stay in the hosted project's auth uri_allow_list.
      redirectTo: 'transportflow://reset-password',
    });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  }

  const canSubmit = email.trim().length > 0 && !submitting;

  if (sent) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.hint}>
          If an account exists for {email.trim()}, we sent it a password reset link. Open the
          link on this phone to choose a new password.
        </Text>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Forgot your password?</Text>
      <Text style={styles.hint}>
        Enter your account email and we'll send you a link to reset it.
      </Text>

      <FormInput
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => canSubmit && sendResetEmail()}
      />

      {error && <ErrorText>{error}</ErrorText>}

      <Button
        label="Send reset link"
        onPress={sendResetEmail}
        disabled={!canSubmit}
        loading={submitting}
      />
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
    marginBottom: spacing.xs,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 21,
    marginBottom: spacing.sm,
  },
});
