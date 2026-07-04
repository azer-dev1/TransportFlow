import { forwardRef } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type ViewProps } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';

/**
 * A horizontal list-row card. Pressable so it can be the child of
 * `<Link asChild>` (which needs the forwarded ref); use `RowView` for
 * non-tappable rows so screen readers don't announce a button.
 */
export const Row = forwardRef<View, PressableProps>(function Row({ style, ...props }, ref) {
  return (
    <Pressable
      ref={ref}
      style={(state) => [
        styles.row,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    />
  );
});

export function RowView({ style, ...props }: ViewProps) {
  return <View style={[styles.row, style]} {...props} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
});
