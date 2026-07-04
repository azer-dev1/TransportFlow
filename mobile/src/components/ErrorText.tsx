import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors } from '@/lib/theme';

export function ErrorText({ style, ...props }: TextProps) {
  return <Text style={[styles.error, style]} {...props} />;
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
  },
});
