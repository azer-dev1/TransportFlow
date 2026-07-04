import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { FormInput } from '@/components/FormInput';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, spacing } from '@/lib/theme';

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signUp() {
    setSubmitting(true);
    setError(null);
    // handle_new_user() creates the profiles row from this metadata.
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
    }
  }

  const canSubmit =
    fullName.trim().length > 0 && email.trim().length > 0 && password.length >= 6 && !submitting;

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
      <FormInput
        placeholder="Password (min 6 characters)"
        autoComplete="new-password"
        secureTextEntry
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
