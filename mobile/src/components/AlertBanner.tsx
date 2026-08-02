import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

/**
 * onEnd/onDelete are the staff/admin retraction actions; riders get neither
 * prop, so the footer row does not render for them at all.
 */
export function AlertBanner({
  title,
  body,
  severity,
  onEnd,
  onDelete,
  busy = false,
}: {
  title: string;
  body: string;
  severity: string;
  onEnd?: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;
  return (
    <View style={[styles.banner, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Ionicons name={s.icon} size={20} color={s.fg} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: s.fg }]}>{title}</Text>
        {!!body && <Text style={styles.text}>{body}</Text>}

        {(onEnd || onDelete) && (
          <View style={styles.actions}>
            {onEnd && (
              <Pressable onPress={onEnd} disabled={busy} hitSlop={8}>
                <Text style={[styles.action, { color: s.fg }, busy && styles.actionDisabled]}>
                  End now
                </Text>
              </Pressable>
            )}
            {onDelete && (
              <Pressable onPress={onDelete} disabled={busy} hitSlop={8}>
                <Text style={[styles.action, styles.delete, busy && styles.actionDisabled]}>
                  Delete
                </Text>
              </Pressable>
            )}
          </View>
        )}
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
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  action: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  delete: {
    color: colors.danger,
  },
  actionDisabled: {
    opacity: 0.5,
  },
});
