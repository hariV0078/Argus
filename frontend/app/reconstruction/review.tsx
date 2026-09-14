import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { formatDuration } from '@/src/lib/format';
import { useJobStore } from '@/src/store/jobStore';
import { colors } from '@/src/theme';

export default function ReviewScreen() {
  const router = useRouter();
  const draft = useJobStore((s) => s.draft);
  const startJob = useJobStore((s) => s.startJob);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const name = draft.name.trim() || draft.video?.fileName.replace(/\.[^/.]+$/, '') || 'Untitled Flight';

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      const jobId = await startJob();
      router.replace(`/reconstruction/upload?jobId=${jobId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create job');
    }
    setBusy(false);
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.lead}>Review</Text>
      <Card style={{ marginTop: 12 }}>
        <Row k="Project Name" v={name} />
        <Row k="Video" v={draft.video?.fileName || '—'} />
        <Row k="Duration" v={draft.video ? formatDuration(draft.video.durationSeconds) : '—'} />
        <Row k="Resolution" v={draft.video ? `${draft.video.width} × ${draft.video.height}` : '—'} />
        <Row k="GPS" v={draft.gpsAvailable ? `Available (${draft.gpsPoints.length} pts)` : 'Missing'} />
        <Row k="Reconstruction" v={draft.reconstructionMode} />
        <Row
          k="Dynamic Object Removal"
          v={draft.removeCars || draft.removePeople || draft.removeOther ? 'Enabled' : 'Off'}
        />
        <Row k="Semantic Layers" v={draft.semanticLayers.join(', ') || 'None'} />
      </Card>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Button title="Start reconstruction" loading={busy} onPress={start} style={{ marginTop: 18 }} />
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  lead: { color: colors.text, fontSize: 22, fontWeight: '800' },
  row: { marginTop: 12 },
  k: { color: colors.dim, fontSize: 12, fontWeight: '700' },
  v: { color: colors.text, fontSize: 16, marginTop: 2 },
  err: { color: colors.red, marginTop: 12 },
});
