import { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { colors, fontSize, radii, spacing } from '@/lib/theme';

/** Small tappable pill, e.g. the lines serving a stop. Link-asChild safe. */
export const Chip = forwardRef<View, PressableProps & { label: string }>(function Chip(
  { label, ...props },
  ref,
) {
  return (
    <Pressable ref={ref} style={styles.chip} {...props}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.primarySurface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  text: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: fontSize.xs,
  },
});
