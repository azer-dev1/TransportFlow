import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const STATUSES = [
  { value: 'on_time', label: 'On time' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

type Status = (typeof STATUSES)[number]['value'];

/**
 * Staff-only delay/cancellation reporting. Inserts into the append-only
 * trip_updates log (RLS: staff only); the apply_trip_update trigger syncs
 * the trip and the screen's realtime subscription picks up the change.
 */
export function StaffReportCard({ tripId }: { tripId: string }) {
  const { session, profile } = useAuth();
  const [status, setStatus] = useState<Status>('delayed');
  const [minutes, setMinutes] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!session || (profile?.role !== 'staff' && profile?.role !== 'admin')) return null;

  const delay = status === 'delayed' ? Number.parseInt(minutes, 10) : 0;
  const canSubmit = !submitting && (status !== 'delayed' || (Number.isInteger(delay) && delay > 0));

  async function submit() {
    setSubmitting(true);
    setError(null);
    setSubmitted(false);
    const { error: insertError } = await supabase.from('trip_updates').insert({
      trip_id: tripId,
      reporter_id: session!.user.id,
      status,
      delay_minutes: delay,
    });
    if (insertError) setError(insertError.message);
    else setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Report status</Text>

      <View style={styles.pills}>
        {STATUSES.map((s) => (
          <Pressable
            key={s.value}
            style={[styles.pill, status === s.value && styles.pillActive]}
            onPress={() => {
              setStatus(s.value);
              setSubmitted(false);
            }}
          >
            <Text style={[styles.pillText, status === s.value && styles.pillTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {status === 'delayed' && (
        <View style={styles.delayRow}>
          <Text style={styles.delayLabel}>Delay (minutes)</Text>
          <TextInput
            style={styles.delayInput}
            keyboardType="number-pad"
            value={minutes}
            onChangeText={setMinutes}
            maxLength={3}
          />
        </View>
      )}

      {error && <Text style={styles.error}>Report failed: {error}</Text>}
      {submitted && !error && <Text style={styles.success}>Reported — riders are being notified.</Text>}

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={submit}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit report</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fec84b',
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillActive: {
    backgroundColor: '#175cd3',
    borderColor: '#175cd3',
  },
  pillText: {
    fontWeight: '600',
    color: '#344054',
  },
  pillTextActive: {
    color: '#fff',
  },
  delayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  delayLabel: {
    color: '#475467',
  },
  delayInput: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    textAlign: 'center',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  error: {
    color: '#d92d20',
  },
  success: {
    color: '#067647',
  },
  button: {
    backgroundColor: '#175cd3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
