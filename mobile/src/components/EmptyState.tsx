import { StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/lib/theme';

/** Centered faint message for empty lists. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

const styles = StyleSheet.create({
  empty: {
    textAlign: 'center',
    color: colors.textFaint,
    marginTop: 32,
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
});
