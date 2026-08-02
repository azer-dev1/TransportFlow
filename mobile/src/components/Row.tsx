import { forwardRef } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type ViewProps } from 'react-native';

import { colors, spacing } from '@/lib/theme';

/**
 * A flat horizontal list row. Pressable so it can be the child of
 * `<Link asChild>` (which needs the forwarded ref); use `RowView` for
 * non-tappable rows so screen readers don't announce a button.
 *
 * Deliberately has no surface, border or radius: a list of twenty bordered
 * boxes is forty horizontal lines competing with the content. One hairline
 * divider between rows does the same grouping for a third of the noise.
 * Lists that use these must not set a `gap`, or the dividers won't meet.
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: {
    // Tint rather than fade: with no surface of its own, dropping opacity
    // would wash out the text instead of reading as a press.
    backgroundColor: colors.neutralSurface,
  },
});
