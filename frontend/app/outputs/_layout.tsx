import { Stack } from 'expo-router';
import { StackBrandTitle } from '@/src/components/brand/BrandMark';
import { colors, fonts } from '@/src/theme';

export default function OutputsLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Outputs' }} />
      <Stack.Screen name="model" options={{ title: '3D mesh' }} />
      <Stack.Screen name="pointcloud" options={{ title: 'Point cloud' }} />
      <Stack.Screen name="map" options={{ title: 'DSM map' }} />
    </Stack>
  );
}
