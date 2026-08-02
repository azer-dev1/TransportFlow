import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fontSize } from '@/lib/theme';

export function SectionTitle({ style, ...props }: TextProps) {
  return <Text style={[styles.title, style]} {...props} />;
}

const styles = StyleSheet.create({
  // A quiet label, not a heading. With rows flattened there is no card edge
  // marking where a group starts, so this does that job — and it has to sit
  // *below* the row text in emphasis, or every list reads as a stack of
  // headings.
  title: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
