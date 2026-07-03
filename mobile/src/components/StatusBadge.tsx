import { StyleSheet, Text, View } from 'react-native';

const STATUS_STYLES: Record<string, { label: string; fg: string; bg: string }> = {
  on_time: { label: 'On time', fg: '#067647', bg: '#ecfdf3' },
  delayed: { label: 'Delayed', fg: '#b54708', bg: '#fffaeb' },
  cancelled: { label: 'Cancelled', fg: '#d92d20', bg: '#fef3f2' },
};

export function StatusBadge({ status, delayMinutes }: { status: string; delayMinutes?: number }) {
  const s = STATUS_STYLES[status] ?? { label: status, fg: '#344054', bg: '#f2f4f7' };
  const label =
    status === 'delayed' && delayMinutes ? `${s.label} +${delayMinutes} min` : s.label;

  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});
