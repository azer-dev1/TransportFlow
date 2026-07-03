import { Pressable, StyleSheet, Text } from 'react-native';

export function Star({
  active,
  onPress,
  size = 22,
}: {
  active: boolean;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Text style={[styles.star, { fontSize: size }, active ? styles.active : styles.inactive]}>
        {active ? '★' : '☆'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  star: {
    lineHeight: 28,
  },
  active: {
    color: '#eaaa08',
  },
  inactive: {
    color: '#98a2b3',
  },
});
