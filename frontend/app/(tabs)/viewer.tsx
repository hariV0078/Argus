import { Href, useIsFocused, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppHeader } from '@/src/components/brand/AppHeader';
import { GlbViewer } from '@/src/components/gl/GlbViewer';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { useServerStore } from '@/src/store/serverStore';

export default function ViewerTab() {
  const router = useRouter();
  const focused = useIsFocused();
  const runs = useServerStore((s) => s.runs);
  // Most recent run's mesh (runs are newest-first) — prefer GLB, it's what this viewer renders.
  const latestRun = runs[0];
  const mesh = latestRun?.mesh.find((f) => f.filename.endsWith('.glb')) || latestRun?.mesh[0];
  const url = mesh?.download_url || undefined;

  return (
    <Screen padded={false} style={{ flex: 1 }}>
      <View style={styles.head}>
        <AppHeader title="3D viewer" subtitle={url ? 'Server GLB' : 'Sample 3D output · no server'} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12 }}>{focused ? <GlbViewer url={url} /> : null}</View>
      <View style={{ padding: 18, gap: 10 }}>
        <Button title="Outputs" onPress={() => router.push('/outputs' as Href)} />
        <Button title="Point cloud" variant="outline" onPress={() => router.push('/outputs/pointcloud' as Href)} />
        <Button title="Map" variant="ghost" onPress={() => router.push('/outputs/map' as Href)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8 },
});
