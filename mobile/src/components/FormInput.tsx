import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { colors, fontSize, radii } from '@/lib/theme';

/** Standard form text field (auth screens, profile forms). */
export function FormInput({ style, ...props }: TextInputProps) {
  return (
    <TextInput style={[styles.input, style]} placeholderTextColor={colors.textFaint} {...props} />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
});
