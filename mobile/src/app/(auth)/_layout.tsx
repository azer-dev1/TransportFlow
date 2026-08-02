import { Stack } from 'expo-router';

// Auth screens carry their own titles ("Welcome back", …); the stack
// headers only repeated them, so they're off.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
