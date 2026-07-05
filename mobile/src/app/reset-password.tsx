import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { PasswordInput } from '@/components/PasswordInput';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, spacing } from '@/lib/theme';

/**
 * Deep-link target of the recovery email (transportflow://reset-password?code=…).
 * Lives outside both Stack.Protected groups: it must render while signed out,
 * and must survive the stack swap that happens the moment the code exchange
 * signs the user in.
 */
export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The recovery code is single-use; remember that it was already redeemed so
  // a failed password update can be retried without re-exchanging.
  const exchanged = useRef(false);

  async function submit() {
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);

    if (!exchanged.current) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code!);
      if (exchangeError) {
        setError(
          `This reset link is no longer valid (${exchangeError.message}). ` +
            'Request a new one from the sign-in screen.',
        );
        setSubmitting(false);
        return;
      }
      exchanged.current = true;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    Alert.alert('Password updated', 'You are now signed in with your new password.');
    router.replace('/');
  }

  const canSubmit = password.length > 0 && confirm.length > 0 && !submitting;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Reset password' }} />
      <Text style={styles.title}>Choose a new password</Text>

      {!code ? (
        <Text style={styles.hint}>
          This screen only works when opened from a password reset email. Request one from the
          sign-in screen.
        </Text>
      ) : (
        <>
          <PasswordInput
            placeholder="New password"
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
          />
          <PasswordInput
            placeholder="Repeat new password"
            autoComplete="new-password"
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={() => canSubmit && submit()}
          />

          {error && <ErrorText>{error}</ErrorText>}

          <Button
            label="Set new password"
            onPress={submit}
            disabled={!canSubmit}
            loading={submitting}
          />
        </>
      )}
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
  },
});
