import { Stack } from 'expo-router';
import { StackBrandTitle } from '@/src/components/brand/BrandMark';
import { colors, fonts } from '@/src/theme';

export default function PipelineLayout() {
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
      <Stack.Screen name="[jobId]" options={{ title: 'Job' }} />
    </Stack>
  );
}
