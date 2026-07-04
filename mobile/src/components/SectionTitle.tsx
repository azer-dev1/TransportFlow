import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fontSize } from '@/lib/theme';

export function SectionTitle({ style, ...props }: TextProps) {
  return <Text style={[styles.title, style]} {...props} />;
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
});
