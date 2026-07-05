import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radii } from '@/lib/theme';

const STATUS_STYLES: Record<string, { label: string; fg: string; bg: string }> = {
  on_time: { label: 'On time', fg: colors.success, bg: colors.successSurface },
  delayed: { label: 'Delayed', fg: colors.warning, bg: colors.warningSurface },
  cancelled: { label: 'Cancelled', fg: colors.danger, bg: colors.dangerSurface },
  completed: { label: 'Completed', fg: colors.textMuted, bg: colors.neutralSurface },
};

export function StatusBadge({ status, delayMinutes }: { status: string; delayMinutes?: number }) {
  const s = STATUS_STYLES[status] ?? { label: status, fg: colors.textBody, bg: colors.neutralSurface };
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
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
