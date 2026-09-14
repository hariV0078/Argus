import { Redirect, Stack } from 'expo-router';
import { StackBrandTitle } from '@/src/components/brand/BrandMark';
import { useAuthStore } from '@/src/store/authStore';
import { colors, fonts } from '@/src/theme';

export default function ReconstructionLayout() {
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
      <Stack.Screen name="video" options={{ title: 'Video' }} />
      <Stack.Screen name="metadata" options={{ title: 'Metadata' }} />
      <Stack.Screen name="configuration" options={{ title: 'Settings' }} />
      <Stack.Screen name="review" options={{ title: 'Review' }} />
      <Stack.Screen name="upload" options={{ title: 'Upload', headerBackVisible: false }} />
      <Stack.Screen name="processing" options={{ title: 'Processing' }} />
    </Stack>
  );
}
