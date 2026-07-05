import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';

import { colors } from '@/lib/theme';

/** App-standard loading wheel — brand blue instead of the platform default. */
export function Spinner(props: ActivityIndicatorProps) {
  return <ActivityIndicator color={colors.primary} {...props} />;
}
