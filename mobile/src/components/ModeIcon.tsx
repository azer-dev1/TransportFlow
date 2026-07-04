import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from '@/lib/theme';

const MODE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  bus: 'bus-outline',
  train: 'train-outline',
};

/** Transport-mode glyph for line rows; falls back to a stop pin. */
export function ModeIcon({ mode, size = 22 }: { mode?: string; size?: number }) {
  return (
    <Ionicons
      name={mode ? (MODE_ICONS[mode] ?? 'location-outline') : 'location-outline'}
      size={size}
      color={colors.primary}
    />
  );
}
