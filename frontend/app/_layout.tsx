import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { DarkTheme, ThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { BrandLockup, StackBrandTitle } from '@/src/components/brand/BrandMark';
import { Loader } from '@/src/components/ui/Loader';
import { useAuthStore } from '@/src/store/authStore';
import { useServerStore } from '@/src/store/serverStore';
import { colors, fonts } from '@/src/theme';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    primary: colors.signal,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrateServer = useServerStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [loaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

  useEffect(() => {
    hydrate();
    void hydrateServer();
  }, [hydrate, hydrateServer]);

  if (!loaded || !hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <BrandLockup />
        <View style={{ height: 28 }} />
        <Loader inline />
      </View>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.signal,
          headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
          headerTitle: ({ children }) => <StackBrandTitle>{String(children)}</StackBrandTitle>,
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reconstruction" />
        <Stack.Screen name="pipeline" />
        <Stack.Screen name="outputs" />
        <Stack.Screen name="model/[jobId]" options={{ headerShown: true, title: '3D Model' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
        <Stack.Screen name="quality/[jobId]" options={{ headerShown: true, title: 'Quality' }} />
        <Stack.Screen name="support" options={{ headerShown: true, title: 'Support' }} />
      </Stack>
    </ThemeProvider>
  );
}
