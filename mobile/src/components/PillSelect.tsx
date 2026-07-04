import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';

/** Single-choice pill row, e.g. trip status or alert severity pickers. */
export function PillSelect<V extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <View style={styles.pills}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.text, active && styles.textActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontWeight: '600',
    color: colors.textBody,
  },
  textActive: {
    color: colors.onPrimary,
  },
});
