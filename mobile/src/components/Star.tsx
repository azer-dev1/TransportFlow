import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import { colors } from '@/lib/theme';

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
      <Ionicons
        name={active ? 'star' : 'star-outline'}
        size={size}
        color={active ? colors.star : colors.textFaint}
      />
    </Pressable>
  );
}
