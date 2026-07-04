import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, fontSize, radii, spacing } from '@/lib/theme';

/**
 * The app's one button. `primary` for the main action of a card/screen,
 * `outline` for secondary actions (e.g. sign out), `danger-ghost` for
 * destructive text buttons.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger-ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const blocked = disabled || loading;
  return (
    <Pressable
      style={[styles.base, styles[variant], disabled && styles.disabled, style]}
      disabled={blocked}
      onPress={onPress}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  'danger-ghost': {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.onPrimary, fontSize: fontSize.md },
  outline: { color: colors.textBody, fontSize: fontSize.md },
  'danger-ghost': { color: colors.danger },
});
