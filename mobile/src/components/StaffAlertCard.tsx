import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorText } from '@/components/ErrorText';
import { PillSelect } from '@/components/PillSelect';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, radii, spacing } from '@/lib/theme';

const SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'disruption', label: 'Disruption' },
] as const;

type Severity = (typeof SEVERITIES)[number]['value'];

/**
 * Staff/admin-only service-alert announcement for a line ("strike Friday",
 * "station closed"). Inserts into service_alerts (RLS: staff/admin only);
 * the INSERT webhook fans out to everyone with an unmuted favorite on the
 * line or a stop it serves.
 */
export function StaffAlertCard({ lineId, onPosted }: { lineId: string; onPosted?: () => void }) {
  const { session, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<Severity>('info');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  if (!session || (profile?.role !== 'staff' && profile?.role !== 'admin')) return null;

  const canSubmit = !submitting && title.trim().length > 0;

  async function submit() {
    setSubmitting(true);
    setError(null);
    setPosted(false);
    const { error: insertError } = await supabase.from('service_alerts').insert({
      line_id: lineId,
      title: title.trim(),
      body: body.trim(),
      severity,
      created_by: session!.user.id,
    });
    if (insertError) {
      setError(insertError.message);
    } else {
      setPosted(true);
      setTitle('');
      setBody('');
      onPosted?.();
    }
    setSubmitting(false);
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Post service alert</Text>

      <PillSelect
        options={SEVERITIES}
        value={severity}
        onChange={(s) => {
          setSeverity(s);
          setPosted(false);
        }}
      />

      <TextInput
        style={styles.input}
        placeholder="Title (e.g. Strike this Friday)"
        placeholderTextColor={colors.textFaint}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />
      <TextInput
        style={[styles.input, styles.bodyInput]}
        placeholder="Details for riders"
        placeholderTextColor={colors.textFaint}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={500}
      />

      {error && <ErrorText>Alert failed: {error}</ErrorText>}
      {posted && !error && <Text style={styles.success}>Posted — riders are being notified.</Text>}

      <Button label="Post alert" onPress={submit} disabled={!canSubmit} loading={submitting} />
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
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSize.sm,
  },
  bodyInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  success: {
    color: colors.success,
  },
});
