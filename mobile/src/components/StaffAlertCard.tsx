import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

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
    <View style={styles.card}>
      <Text style={styles.title}>Post service alert</Text>

      <View style={styles.pills}>
        {SEVERITIES.map((s) => (
          <Pressable
            key={s.value}
            style={[styles.pill, severity === s.value && styles.pillActive]}
            onPress={() => {
              setSeverity(s.value);
              setPosted(false);
            }}
          >
            <Text style={[styles.pillText, severity === s.value && styles.pillTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Title (e.g. Strike this Friday)"
        placeholderTextColor="#98a2b3"
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />
      <TextInput
        style={[styles.input, styles.bodyInput]}
        placeholder="Details for riders"
        placeholderTextColor="#98a2b3"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={500}
      />

      {error && <Text style={styles.error}>Alert failed: {error}</Text>}
      {posted && !error && <Text style={styles.success}>Posted — riders are being notified.</Text>}

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={submit}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Post alert</Text>
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
  input: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  bodyInput: {
    minHeight: 64,
    textAlignVertical: 'top',
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
