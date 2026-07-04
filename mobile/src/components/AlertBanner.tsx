import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radii, spacing } from '@/lib/theme';

const SEVERITY_STYLES: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; fg: string; bg: string; border: string }
> = {
  info: {
    icon: 'information-circle',
    fg: colors.primary,
    bg: colors.primarySurface,
    border: colors.unreadBorder,
  },
  warning: {
    icon: 'warning',
    fg: colors.warning,
    bg: colors.warningSurface,
    border: colors.warningBorder,
  },
  disruption: {
    icon: 'alert-circle',
    fg: colors.danger,
    bg: colors.dangerSurface,
    border: colors.dangerBorder,
  },
};

export function AlertBanner({
  title,
  body,
  severity,
}: {
  title: string;
  body: string;
  severity: string;
}) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;
  return (
    <View style={[styles.banner, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Ionicons name={s.icon} size={20} color={s.fg} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: s.fg }]}>{title}</Text>
        {!!body && <Text style={styles.text}>{body}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.md - 2,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  text: {
    color: colors.textBody,
    lineHeight: 19,
  },
});
