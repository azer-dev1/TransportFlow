import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

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

  if (loading) return <ActivityIndicator style={styles.spinner} />;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Quiet hours</Text>
        <Switch value={enabled} onValueChange={toggle} />
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

          {error && <Text style={styles.error}>Saving failed: {error}</Text>}
          {saved && !error && <Text style={styles.success}>Quiet hours saved.</Text>}

          <Pressable
            style={[styles.saveButton, (!valid || saving) && styles.saveButtonDisabled]}
            disabled={!valid || saving}
            onPress={save}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save quiet hours</Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const { session, profile } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.greeting}>{profile ? profile.full_name : 'Loading…'}</Text>
        {profile && (
          <View style={[styles.badge, profile.role !== 'rider' && styles.badgeStaff]}>
            <Text style={styles.badgeText}>{profile.role}</Text>
          </View>
        )}
        <Text style={styles.email}>{session?.user.email}</Text>
      </View>

      {session && <QuietHoursCard userId={session.user.id} />}

      <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 24,
    gap: 24,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardHint: {
    color: '#475467',
    fontSize: 13,
    lineHeight: 18,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff8ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeStaff: {
    backgroundColor: '#fef0c7',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
  },
  email: {
    color: '#475467',
  },
  spinner: {
    marginVertical: 8,
  },
  timesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  timeField: {
    flex: 1,
    gap: 4,
  },
  timeLabel: {
    color: '#475467',
    fontSize: 13,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  timeInputInvalid: {
    borderColor: '#fda29b',
  },
  error: {
    color: '#d92d20',
  },
  success: {
    color: '#067647',
  },
  saveButton: {
    backgroundColor: '#175cd3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  signOut: {
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#344054',
  },
});
