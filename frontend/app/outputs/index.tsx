import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/ui/Card';
import { Loader } from '@/src/components/ui/Loader';
import { formatDate } from '@/src/lib/format';
import { OutputFile, RunOutputs } from '@/src/api/types';
import { useServerStore } from '@/src/store/serverStore';
import { colors, fonts, radius } from '@/src/theme';

// Prefer a specific filename within a category (e.g. the textured GLB over
// a plain OBJ, the semantically-labelled cloud over the raw one); fall back
// to whatever's first so a run still shows something if naming ever drifts.
function pick(files: OutputFile[], ...preferredNames: string[]): OutputFile | undefined {
  for (const name of preferredNames) {
    const hit = files.find((f) => f.filename === name);
    if (hit) return hit;
  }
  return files[0];
}

function RunCard({ run, index, onOpen }: { run: RunOutputs; index: number; onOpen: (href: string) => void }) {
  const mesh = pick(run.mesh, 'model.glb');
  const cloud = pick(run.pointcloud, 'dense_labelled.ply', 'dense.ply');
  const map = pick(run.geotiff, 'dsm.tif');
  // Exact match only — pick() falls back to files[0], which would wrongly
  // hand dsm.tif itself to a "fetch as JSON" call if the bounds sidecar is
  // missing (e.g. an older run predating this fix).
  const bounds = run.geotiff.find((f) => f.filename === 'dsm_bounds.json');

  const subtitleParts = [
    run.created_at ? formatDate(run.created_at) : `Run ${run.job_id.slice(0, 8)}`,
    run.status && run.status !== 'completed' ? run.status : null,
  ].filter(Boolean);

  return (
    <Card style={{ marginTop: index === 0 ? 0 : 12 }}>
      <Text style={styles.runTitle}>Run {index + 1}</Text>
      <Text style={styles.runSubtitle}>{subtitleParts.join(' · ')}</Text>

      <View style={{ marginTop: 10, gap: 8 }}>
        <Tile
          icon="cube"
          label="3D Mesh"
          detail={mesh ? mesh.filename : 'Not available'}
          disabled={!mesh}
          onPress={() => mesh && onOpen(`/outputs/model?url=${encodeURIComponent(mesh.download_url)}`)}
        />
        <Tile
          icon="git-network"
          label="Point Cloud"
          detail={cloud ? cloud.filename : 'Not available'}
          disabled={!cloud}
          onPress={() => cloud && onOpen(`/outputs/pointcloud?url=${encodeURIComponent(cloud.download_url)}`)}
        />
        <Tile
          icon="map"
          label="Map"
          detail={map ? map.filename : 'Not available'}
          disabled={!map}
          onPress={() => {
            if (!map) return;
            const params = [`url=${encodeURIComponent(map.preview_url)}`];
            if (bounds) params.push(`boundsUrl=${encodeURIComponent(bounds.download_url)}`);
            onOpen(`/outputs/map?${params.join('&')}`);
          }}
        />
      </View>
    </Card>
  );
}

function Tile({
  icon,
  label,
  detail,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, disabled && styles.tileDisabled, pressed && !disabled && { opacity: 0.7 }]}
    >
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={20} color={disabled ? colors.dim : colors.signal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tileLabel, disabled && styles.tileLabelDisabled]}>{label}</Text>
        <Text style={styles.tileDetail}>{detail}</Text>
      </View>
      {!disabled ? <Ionicons name="chevron-forward" size={16} color={colors.dim} /> : null}
    </Pressable>
  );
}

export default function OutputsScreen() {
  const router = useRouter();
  const runs = useServerStore((s) => s.runs);
  const refreshOutputs = useServerStore((s) => s.refreshOutputs);

  useEffect(() => {
    void refreshOutputs();
  }, [refreshOutputs]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 36, flexGrow: 1 }}>
      <Stack.Screen
        options={{ title: 'Outputs', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.signal }}
      />
      {!runs.length ? <Loader label="Loading outputs" /> : null}

      {runs.map((run, i) => (
        <RunCard key={run.job_id} run={run} index={i} onOpen={(href) => router.push(href as never)} />
      ))}

      {runs.length ? (
        <Text style={styles.hint}>
          Each run keeps its own mesh, point cloud, and map — newest first. Tap a tile to open its viewer.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  runTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  runSubtitle: { color: colors.dim, fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    padding: 12,
  },
  tileDisabled: { opacity: 0.45 },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  tileLabelDisabled: { color: colors.dim },
  tileDetail: { color: colors.muted, marginTop: 2, fontSize: 12, fontFamily: fonts.regular },
  hint: { color: colors.dim, marginTop: 14, fontFamily: fonts.regular, lineHeight: 20 },
});
