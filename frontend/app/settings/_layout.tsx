import { Redirect, Stack } from 'expo-router';
import { StackBrandTitle } from '@/src/components/brand/BrandMark';
import { useAuthStore } from '@/src/store/authStore';
import { colors, fonts } from '@/src/theme';

export default function SettingsLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const loggedIn = useAuthStore((s) => s.loggedIn);
  if (hydrated && !loggedIn) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.signal,
        headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
        headerTitle: ({ children }) => <StackBrandTitle>{String(children)}</StackBrandTitle>,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="server" options={{ title: 'Server' }} />
      <Stack.Screen name="account" options={{ title: 'Account' }} />
      <Stack.Screen name="defaults" options={{ title: 'Processing Defaults' }} />
      <Stack.Screen name="storage" options={{ title: 'Storage' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
