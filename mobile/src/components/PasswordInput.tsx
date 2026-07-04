import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontSize, radii } from '@/lib/theme';

/**
 * Password field with a show/hide eye toggle. autoCapitalize/autoCorrect are
 * forced off: Android's keyboard flickers between shifted and unshifted after
 * every keystroke when a secure field leaves auto-capitalization on.
 */
export function PasswordInput({ style, ...props }: TextInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textFaint}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
      <Pressable
        style={styles.eye}
        onPress={() => setVisible(!visible)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color={colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 46,
    fontSize: fontSize.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  eye: {
    position: 'absolute',
    right: 14,
  },
});
