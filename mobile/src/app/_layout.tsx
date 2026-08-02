import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { usePushNotifications } from '@/lib/notifications';
import { colors } from '@/lib/theme';

function RootNavigator() {
  const { session, isLoading } = useAuth();
  usePushNotifications(session?.user.id);

  if (isLoading) {
    // Hold rendering until the persisted session is restored so signed-in
    // users don't flash through the sign-in screen on cold start. Brand blue
    // to read as a continuation of the splash screen.
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        }}
      >
        <ActivityIndicator size="large" color={colors.onPrimary} />
      </View>
    );
  }

  return (
    // Instant screen changes, deliberately — not an oversight. The platform
    // default transition was never chosen and read as noise on a utility app
    // people open for a few seconds at a time.
    <Stack screenOptions={{ animation: 'none' }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="nearby" options={{ title: 'Nearby stops' }} />
        <Stack.Screen name="lines/[id]" options={{ title: 'Line' }} />
        <Stack.Screen name="trips/[id]" options={{ title: 'Trip' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* Outside both guards: reached signed-out via the recovery deep link,
          and must stay mounted when the code exchange signs the user in. */}
      <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* "dark" = dark icons, not a dark bar. Must not be "auto": that follows
          the *system* scheme, so on a phone in dark mode it painted the clock
          and status icons white on our permanently light background, making
          them invisible. The app is light-only, so pin it. */}
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
