import { Stack } from 'expo-router';

/**
 * React component AuthLayout: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
  <Stack.Screen name="setup" />
    </Stack>
  );
}
