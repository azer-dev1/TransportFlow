import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { ErrorText } from '@/components/ErrorText';
import { PasswordInput } from '@/components/PasswordInput';
import { Spinner } from '@/components/Spinner';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, radii, spacing } from '@/lib/theme';

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Quiet hours: while active (user-local wall clock, midnight wrap OK) the
 * Edge Function still records notifications but skips the push. Stored in
 * notification_prefs (owner-only RLS); off = no row.
 */
function QuietHoursCard({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('07:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('notification_prefs')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.quiet_start && data.quiet_end) {
          setEnabled(true);
          setStart(data.quiet_start.slice(0, 5));
          setEnd(data.quiet_end.slice(0, 5));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const valid = TIME_RE.test(start) && TIME_RE.test(end) && start !== end;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: upsertError } = await supabase.from('notification_prefs').upsert({
      user_id: userId,
      quiet_start: start,
      quiet_end: end,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (upsertError) setError(upsertError.message);
    else setSaved(true);
    setSaving(false);
  }

  async function toggle(on: boolean) {
    setEnabled(on);
    setSaved(false);
    setError(null);
    if (!on) {
      const { error: deleteError } = await supabase
        .from('notification_prefs')
        .delete()
        .eq('user_id', userId);
      if (deleteError) setError(deleteError.message);
    }
  }

  if (loading) return <Spinner style={styles.spinner} />;

  return (
    <View style={styles.section}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Quiet hours</Text>
        <Switch
          value={enabled}
          onValueChange={toggle}
          trackColor={{ false: colors.borderStrong, true: colors.primary }}
          thumbColor={colors.surface}
        />
      </View>
      <Text style={styles.cardHint}>
        No push notifications during these hours — you'll still find everything in your
        notification list.
      </Text>

      {enabled && (
        <>
          <View style={styles.timesRow}>
            <View style={styles.timeField}>
              <Text style={styles.timeLabel}>From</Text>
              <TextInput
                style={[styles.timeInput, !TIME_RE.test(start) && styles.timeInputInvalid]}
                value={start}
                onChangeText={(t) => {
                  setStart(t);
                  setSaved(false);
                }}
                placeholder="22:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.timeLabel}>Until</Text>
              <TextInput
                style={[styles.timeInput, !TIME_RE.test(end) && styles.timeInputInvalid]}
                value={end}
                onChangeText={(t) => {
                  setEnd(t);
                  setSaved(false);
                }}
                placeholder="07:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>

          {error && <ErrorText>Saving failed: {error}</ErrorText>}
          {saved && !error && <Text style={styles.success}>Quiet hours saved.</Text>}

          <Button
            label="Save quiet hours"
            onPress={save}
            disabled={!valid}
            loading={saving}
            style={styles.saveButton}
          />
        </>
      )}
    </View>
  );
}

/** Owner-only column grant: profiles.full_name is the only client-writable field. */
function NameEditor({ currentName, onSaved }: { currentName: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  async function save() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', session!.user.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <View style={styles.nameRow}>
        <Text style={styles.greeting}>{currentName}</Text>
        <Pressable
          onPress={() => {
            setName(currentName);
            setEditing(true);
          }}
        >
          <Text style={styles.editLink}>Edit</Text>
        </Pressable>
      </View>
    );
  }

  const canSave = name.trim().length > 0 && !saving;
  return (
    <View style={styles.nameEdit}>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        autoFocus
        placeholder="Your name"
        onSubmitEditing={() => canSave && save()}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <View style={styles.nameEditActions}>
        <Pressable onPress={() => setEditing(false)}>
          <Text style={styles.cancelLink}>Cancel</Text>
        </Pressable>
        <Button
          label="Save"
          onPress={save}
          disabled={!canSave}
          loading={saving}
          style={styles.saveButtonInline}
        />
      </View>
    </View>
  );
}

function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword('');
    setConfirm('');
    setSaved(true);
    setOpen(false);
  }

  const canSave = password.length > 0 && confirm.length > 0 && !saving;

  return (
    <View style={styles.section}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Password</Text>
        <Pressable onPress={() => setOpen(!open)}>
          <Text style={styles.editLink}>{open ? 'Close' : 'Change'}</Text>
        </Pressable>
      </View>
      {saved && !open && <Text style={styles.success}>Password updated.</Text>}

      {open && (
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
            onSubmitEditing={() => canSave && save()}
          />
          {error && <ErrorText>{error}</ErrorText>}
          <Button
            label="Update password"
            onPress={save}
            disabled={!canSave}
            loading={saving}
            style={styles.saveButton}
          />
        </>
      )}
    </View>
  );
}

/**
 * Play Store requirement: apps with account creation must offer in-app
 * account deletion. The delete-account Edge Function removes the auth user;
 * the DB cascade takes profile, favorites, devices and notifications with it.
 */
function DeleteAccountButton() {
  const [deleting, setDeleting] = useState(false);

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, favorites and notifications. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      setDeleting(false);
      Alert.alert('Deletion failed', error.message);
      return;
    }
    // The server-side session died with the user; only local state remains.
    await supabase.auth.signOut({ scope: 'local' });
  }

  return (
    <Button
      label="Delete account"
      variant="danger-ghost"
      onPress={confirmDelete}
      loading={deleting}
    />
  );
}

/**
 * Shows which JS bundle is actually running (embedded vs OTA update).
 * Updates install themselves: expo-updates downloads in the background on
 * launch and applies on the next cold start — no manual check needed.
 */
function UpdatesCard() {
  return (
    <View style={styles.section}>
      <Text style={styles.cardTitle}>App version</Text>
      <Text style={styles.cardHint}>
        Channel: {Updates.channel ?? 'none'} · runtime {Updates.runtimeVersion ?? '—'}
        {'\n'}
        Running: {Updates.isEmbeddedLaunch ? 'built-in bundle' : `update ${Updates.updateId ?? '?'}`}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();

  // keyboardShouldPersistTaps: with the keyboard open, the first tap must
  // reach Save/Cancel instead of only dismissing the keyboard.
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.section, styles.sectionFirst]}>
        {profile ? (
          <NameEditor currentName={profile.full_name} onSaved={refreshProfile} />
        ) : (
          <Text style={styles.greeting}>Loading…</Text>
        )}
        {/* Everyone is a rider by default — only elevated roles are worth a badge. */}
        {profile && profile.role !== 'rider' && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{profile.role}</Text>
          </View>
        )}
        <Text style={styles.email}>{session?.user.email}</Text>
      </View>

      <ChangePasswordCard />

      {session && <QuietHoursCard userId={session.user.id} />}

      <UpdatesCard />

      <View style={styles.footer}>
        <Button label="Sign out" variant="outline" onPress={() => supabase.auth.signOut()} />
        <DeleteAccountButton />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // No gap: sections carry their own padding and top divider.
  content: {
    paddingHorizontal: spacing.xl,
    flexGrow: 1,
  },
  /**
   * A settings group. Flat like everything else — a divider and real spacing
   * separate groups, so nothing here needs a box around it.
   */
  section: {
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  /** Nothing above it to divide from. */
  sectionFirst: {
    borderTopWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  cardHint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  greeting: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameEdit: {
    gap: spacing.sm,
  },
  nameEditActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
  editLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  cancelLink: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fontSize.md,
  },
  saveButton: {
    marginTop: spacing.xs,
  },
  saveButtonInline: {
    paddingHorizontal: 20,
    paddingVertical: spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warningChip,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textBody,
  },
  email: {
    color: colors.textMuted,
  },
  spinner: {
    marginVertical: spacing.sm,
  },
  timesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  timeField: {
    flex: 1,
    gap: spacing.xs,
  },
  timeLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSize.md,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  timeInputInvalid: {
    borderColor: colors.dangerBorder,
  },
  success: {
    color: colors.success,
  },
  footer: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
});
