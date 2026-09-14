import { Ionicons } from '@expo/vector-icons';
import { Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Loader } from '@/src/components/ui/Loader';
import { ModelViewer, ViewerHandle, sceneForJob } from '@/src/components/viewer/ModelViewer';
import { ViewerLayers } from '@/src/lib/viewerHtml';
import { formatClock, formatDate } from '@/src/lib/format';
import { getOutputs, getReconstruction } from '@/src/services/api';
import { useJobStore } from '@/src/store/jobStore';
import { colors, radius } from '@/src/theme';
import { JobOutputs, ReconstructionJob } from '@/src/types/reconstruction';

type Mode = 'textured' | 'solid' | 'wireframe' | 'points';
type Measure = 'distance' | 'area' | 'height' | 'coord';

export default function ModelScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const retry = useJobStore((s) => s.retry);
  const viewer = useRef<ViewerHandle>(null);
  const [job, setJob] = useState<ReconstructionJob | null>(null);
  const [outputs, setOutputs] = useState<JobOutputs>({});
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'layers' | 'measure' | 'info'>('layers');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const [format, setFormat] = useState('GLB');
  const [include, setInclude] = useState({ textures: true, gps: true, layers: true });
  const [mode, setMode] = useState<Mode>('textured');
  const [nav, setNav] = useState<'orbit' | 'pan'>('orbit');
  const [measure, setMeasure] = useState<Measure>('distance');
  const [readout, setReadout] = useState('Tap the model to measure');
  const [layers, setLayers] = useState<ViewerLayers>({
    buildings: true,
    roads: true,
    terrain: true,
    vegetation: true,
    dynamic: false,
  });

  useEffect(() => {
    if (!jobId) return;
    Promise.all([getReconstruction(jobId), getOutputs(jobId)])
      .then(([j, o]) => {
        setJob(j);
        setOutputs(o);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load model'));
  }, [jobId]);

  const applyLayers = (next: ViewerLayers) => {
    setLayers(next);
    viewer.current?.setLayers(next);
  };

  if (err) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.err}>{err}</Text>
      </View>
    );
  }
  if (!job) {
    return (
      <View style={styles.wrap}>
        <Loader label="Loading model" />
      </View>
    );
  }

  if (job.status === 'FAILED') {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 32 }}>
        <Stack.Screen options={{ title: job.name, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.signal }} />
        <Text style={styles.title}>Reconstruction failed</Text>
        <Card style={{ marginTop: 12 }}>
          <Text style={styles.k}>Stage</Text>
          <Text style={styles.v}>{job.currentStage}</Text>
          <Text style={[styles.k, { marginTop: 10 }]}>Cause</Text>
          <Text style={styles.fail}>{job.message}</Text>
        </Card>
        <Button
          title="Retry Stage"
          style={{ marginTop: 16 }}
          onPress={async () => {
            await retry(job.id);
            router.replace(`/reconstruction/processing?jobId=${job.id}`);
          }}
        />
        <Button title="Change Settings" variant="outline" style={{ marginTop: 10 }} onPress={() => router.push('/settings/defaults')} />
        <Button title="Contact Support" variant="ghost" style={{ marginTop: 10 }} onPress={() => router.push('/support')} />
      </ScrollView>
    );
  }

  const lowQuality = !job.metadata.gpsAvailable;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: job.name, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.signal }} />
      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8 }}>
        <ModelViewer
          ref={viewer}
          title={job.name}
          scene={sceneForJob(job.name, job.id)}
          layers={layers}
          onEvent={(data) => {
            if (data.type === 'distance') setReadout(`Distance  ${data.meters} m`);
            if (data.type === 'height') setReadout(`Height  ${data.meters} m`);
            if (data.type === 'area') setReadout(`Area  ${data.meters} m²`);
            if (data.type === 'coord') setReadout(`Coord  ${data.x}, ${data.y}, ${data.z}`);
          }}
        />
      </View>

      <View style={styles.camRow}>
        {[
          ['reset', 'refresh'],
          ['top', 'arrow-up'],
          ['side', 'swap-horizontal'],
        ].map(([v, icon]) => (
          <Pressable key={v} style={styles.camBtn} onPress={() => viewer.current?.setView(v)}>
            <Ionicons name={icon as any} size={16} color={colors.text} />
            <Text style={styles.camTxt}>{v}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.camBtn, nav === 'orbit' && styles.camOn]}
          onPress={() => {
            setNav('orbit');
            viewer.current?.setNav('orbit');
          }}>
          <Text style={styles.camTxt}>Orbit</Text>
        </Pressable>
        <Pressable
          style={[styles.camBtn, nav === 'pan' && styles.camOn]}
          onPress={() => {
            setNav('pan');
            viewer.current?.setNav('pan');
          }}>
          <Text style={styles.camTxt}>Pan</Text>
        </Pressable>
      </View>

      <View style={styles.modes}>
        {(['textured', 'solid', 'wireframe', 'points'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => {
              setMode(m);
              viewer.current?.setMode(m);
            }}
            style={[styles.mode, mode === m && styles.modeOn]}>
            <Text style={[styles.modeTxt, mode === m && styles.modeTxtOn]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabs}>
        {(['layers', 'measure', 'info'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtOn]}>{t[0].toUpperCase() + t.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.panel}>
        {tab === 'layers' ? (
          <View>
            {(['buildings', 'roads', 'terrain', 'vegetation', 'dynamic'] as const).map((k) => (
              <View key={k} style={styles.row}>
                <Text style={styles.v}>{k === 'dynamic' ? 'Dynamic Objects' : k[0].toUpperCase() + k.slice(1)}</Text>
                <Switch
                  value={layers[k]}
                  onValueChange={(v) => applyLayers({ ...layers, [k]: v })}
                  trackColor={{ true: colors.blue, false: colors.border }}
                />
              </View>
            ))}
          </View>
        ) : null}
        {tab === 'measure' ? (
          <View>
            <View style={styles.chipRow}>
              {(['distance', 'area', 'height', 'coord'] as Measure[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMeasure(m);
                    viewer.current?.setMeasure(m);
                    setReadout(
                      m === 'area' ? 'Tap 3 points' : m === 'coord' ? 'Tap one point' : 'Tap 2 points',
                    );
                  }}
                  style={[styles.chip, measure === m && styles.chipOn]}>
                  <Text style={[styles.chipTxt, measure === m && styles.modeTxtOn]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.readout}>{readout}</Text>
          </View>
        ) : null}
        {tab === 'info' ? (
          <ScrollView>
            <Text style={styles.k}>Model Type</Text>
            <Text style={styles.v}>Textured mesh</Text>
            <Text style={styles.k}>Processing Time</Text>
            <Text style={styles.v}>{job.metrics ? formatClock(job.metrics.processingTimeSeconds) : '—'}</Text>
            <Text style={styles.k}>Coverage</Text>
            <Text style={styles.v}>Entire visible scene</Text>
            <Text style={styles.k}>Spatial Accuracy</Text>
            <Text style={styles.v}>{job.metrics?.accuracy ? `< ${job.metrics.accuracy.toFixed(2)} m` : '—'}</Text>
            <Text style={styles.k}>GPS Alignment</Text>
            <Text style={styles.v}>{job.metadata.gpsAvailable ? 'Available' : 'Missing'}</Text>
            <Text style={styles.k}>Output Files</Text>
            <Text style={styles.v}>GLB · OBJ · PLY · GLTF · FBX</Text>
            <Text style={styles.k}>Created</Text>
            <Text style={styles.v}>{formatDate(job.createdAt)}</Text>
          </ScrollView>
        ) : null}
      </View>

      {lowQuality ? (
        <Pressable style={styles.warn} onPress={() => router.push(`/quality/${job.id}` as Href)}>
          <Text style={styles.warnTxt}>Limited GPS. View quality report</Text>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Button title="Share" variant="outline" style={{ flex: 1 }} onPress={() => Share.share({ message: `${job.name} 3D reconstruction` })} />
        <Button title="Export" style={{ flex: 1 }} onPress={() => { setExportOpen(true); setExportReady(false); }} />
      </View>

      <Modal visible={exportOpen} transparent animationType="slide" onRequestClose={() => setExportOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setExportOpen(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.title}>Export</Text>
            {['GLB', 'GLTF', 'OBJ', 'PLY', 'FBX'].map((f) => (
              <Pressable key={f} onPress={() => setFormat(f)} style={styles.row}>
                <Text style={{ color: format === f ? colors.blue : colors.text, fontWeight: '700' }}>
                  {format === f ? '☑' : '○'} {f}
                </Text>
              </Pressable>
            ))}
            <Text style={[styles.k, { marginTop: 10 }]}>Include</Text>
            {(['textures', 'gps', 'layers'] as const).map((k) => (
              <View key={k} style={styles.row}>
                <Text style={styles.v}>{k === 'gps' ? 'GPS Metadata' : k[0].toUpperCase() + k.slice(1)}</Text>
                <Switch
                  value={include[k]}
                  onValueChange={(v) => setInclude({ ...include, [k]: v })}
                  trackColor={{ true: colors.blue, false: colors.border }}
                />
              </View>
            ))}
            <Button title="Generate Export" style={{ marginTop: 12 }} onPress={() => setExportReady(true)} />
            {exportReady ? (
              <Card style={{ marginTop: 12 }}>
                <Text style={styles.v}>Export Ready</Text>
                <Text style={styles.sub}>
                  {job.name.replace(/\s+/g, '_')}.{format.toLowerCase()} · 248 MB
                </Text>
                <Text style={styles.sub}>
                  Includes {[include.textures && 'textures', include.gps && 'GPS', include.layers && 'layers'].filter(Boolean).join(', ')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Button title="Preview" variant="outline" style={{ flex: 1 }} onPress={() => setExportOpen(false)} />
                  <Button title="Share" style={{ flex: 1 }} onPress={() => Share.share({ message: `${job.name} export ${format}` })} />
                </View>
                <Button
                  title="Save"
                  variant="ghost"
                  style={{ marginTop: 8 }}
                  onPress={() => Alert.alert('Saved', `Saved ${job.name.replace(/\s+/g, '_')}.${format.toLowerCase()} to device files.`)}
                />
              </Card>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sub: { color: colors.muted, marginTop: 6 },
  err: { color: colors.red },
  fail: { color: colors.red, marginTop: 6 },
  k: { color: colors.dim, fontSize: 12, fontWeight: '700', marginTop: 8 },
  v: { color: colors.text, marginTop: 2 },
  camRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginTop: 8 },
  camBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  camOn: { borderColor: colors.blue, backgroundColor: colors.elevated },
  camTxt: { color: colors.text, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  modes: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginTop: 8 },
  mode: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  modeOn: { borderColor: colors.blue, backgroundColor: colors.elevated },
  modeTxt: { color: colors.dim, fontSize: 10, fontWeight: '700' },
  modeTxtOn: { color: colors.blue },
  tabs: { flexDirection: 'row', margin: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabOn: { backgroundColor: colors.elevated },
  tabTxt: { color: colors.dim, fontWeight: '700', fontSize: 12 },
  tabTxtOn: { color: colors.text },
  panel: { paddingHorizontal: 16, maxHeight: 168 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { borderColor: colors.blue },
  chipTxt: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  readout: { color: colors.green, marginTop: 8, fontWeight: '700' },
  warn: { marginHorizontal: 16, marginTop: 8, backgroundColor: '#3A2F14', borderRadius: 10, padding: 10 },
  warnTxt: { color: colors.amber, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, padding: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    padding: 20,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '86%',
  },
});
