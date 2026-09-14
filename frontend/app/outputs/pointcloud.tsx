import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PlyViewer } from '@/src/components/gl/PlyViewer';
import { LABEL_NAMES } from '@/src/constants/labelColors';
import { colors, fonts } from '@/src/theme';

export default function PointCloudScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  return (
    <View style={styles.wrap}>
      <Stack.Screen
        options={{ title: 'Point cloud', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.signal }}
      />
      <PlyViewer url={url} />
      <Text style={styles.hint}>{LABEL_NAMES.slice(1).join(' · ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  hint: { color: colors.dim, textAlign: 'center', padding: 12, fontFamily: fonts.regular },
});
