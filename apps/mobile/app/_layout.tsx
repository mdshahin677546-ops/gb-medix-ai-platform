import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

/** Root navigator. Auth + report screens are stack routes; tabs are a group. */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/verify-email" />
        <Stack.Screen name="auth/consent" />
        <Stack.Screen name="report/free" />
        <Stack.Screen name="report/premium" />
        <Stack.Screen name="report/history" />
      </Stack>
    </>
  );
}
