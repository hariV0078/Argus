import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { GlbViewer } from '@/src/components/gl/GlbViewer';
import { colors, fonts } from '@/src/theme';

export default function OutputModelScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  return (
    <View style={styles.wrap}>
      <Stack.Screen
        options={{ title: '3D mesh', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.signal }}
      />
      <GlbViewer url={url} />
      <Text style={styles.hint}>Sample 3D output · drag to orbit · expo-gl + three.js</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  hint: { color: colors.dim, textAlign: 'center', padding: 12, fontFamily: fonts.regular },
});
