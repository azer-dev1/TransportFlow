import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorText } from '@/components/ErrorText';
import { PillSelect } from '@/components/PillSelect';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, radii, spacing } from '@/lib/theme';

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
    <Card style={styles.card}>
      <Text style={styles.title}>Report status</Text>

      <PillSelect
        options={STATUSES}
        value={status}
        onChange={(s) => {
          setStatus(s);
          setSubmitted(false);
        }}
      />

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

      {error && <ErrorText>Report failed: {error}</ErrorText>}
      {submitted && !error && (
        <Text style={styles.success}>Reported — riders are being notified.</Text>
      )}

      <Button label="Submit report" onPress={submit} disabled={!canSubmit} loading={submitting} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    // Amber border marks the staff-only surface.
    borderColor: colors.warningBorder,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  delayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  delayLabel: {
    color: colors.textMuted,
  },
  delayInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 72,
    textAlign: 'center',
    fontSize: fontSize.md,
    fontVariant: ['tabular-nums'],
  },
  success: {
    color: colors.success,
  },
});
