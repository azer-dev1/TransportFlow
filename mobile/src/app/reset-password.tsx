import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { supabase } from '@/lib/supabase';

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
          <TextInput
            style={styles.input}
            placeholder="New password"
            autoComplete="new-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Repeat new password"
            autoComplete="new-password"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={() => canSubmit && submit()}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            disabled={!canSubmit}
            onPress={submit}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Set new password</Text>
            )}
          </Pressable>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    color: '#475467',
    fontSize: 15,
    lineHeight: 21,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: '#d92d20',
  },
  button: {
    backgroundColor: '#175cd3',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
