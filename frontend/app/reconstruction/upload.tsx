import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { formatBytes } from '@/src/lib/format';
import { useJobStore } from '@/src/store/jobStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { colors } from '@/src/theme';

export default function UploadScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const draft = useJobStore((s) => s.draft);
  const beginUpload = useJobStore((s) => s.beginUpload);
  const finishUpload = useJobStore((s) => s.finishUpload);
  const wifiOnly = useSettingsStore((s) => s.wifiOnlyUploads);
  const [pct, setPct] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ackWifi, setAckWifi] = useState(false);
  const live = useRef(true);

  const size = draft.video?.sizeBytes || 420_000_000;
  const large = size > 200_000_000;
  const needWifiAck = wifiOnly && large && !ackWifi;

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    if (!jobId || needWifiAck || paused || failed) return;
    beginUpload(jobId);
    const t = setInterval(() => {
      setPct((p) => {
        if (!live.current) return p;
        const next = Math.min(100, p + 12);
        if (next >= 100) {
          clearInterval(t);
          finishUpload(jobId).then(() => {
            if (live.current) router.replace(`/reconstruction/processing?jobId=${jobId}`);
          });
        }
        return next;
      });
    }, 140);
    return () => clearInterval(t);
  }, [jobId, needWifiAck, paused, failed, beginUpload, finishUpload, router]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>Uploading</Text>
      {needWifiAck ? (
        <Card style={{ marginTop: 16 }}>
          <Text style={styles.warn}>Large file on mobile data</Text>
          <Text style={styles.meta}>
            {formatBytes(size)}. Use Wi-Fi for drone video when possible. Continue only if you accept data use.
          </Text>
          <Button title="Continue upload" style={{ marginTop: 14 }} onPress={() => setAckWifi(true)} />
          <Button title="Cancel" variant="outline" style={{ marginTop: 8 }} onPress={() => router.replace('/(tabs)/home')} />
        </Card>
      ) : (
        <Card style={{ marginTop: 16 }}>
          <Text style={styles.file}>{draft.video?.fileName || 'drone_flight.mp4'}</Text>
          <Text style={styles.size}>
            {formatBytes((size * pct) / 100)} / {formatBytes(size)}
          </Text>
          <View style={{ marginTop: 16 }}>
            <ProgressBar value={pct} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            {!paused && !failed && pct < 100 ? <ActivityIndicator color={colors.signal} /> : null}
            <Text style={styles.pct}>{Math.round(pct)}%</Text>
          </View>
          <Text style={styles.meta}>{failed ? 'Upload interrupted' : paused ? 'Paused' : 'Uploading…'}</Text>
        </Card>
      )}

      {!needWifiAck ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          {failed ? (
            <Button
              title="Retry upload"
              onPress={() => {
                setFailed(false);
                setPaused(false);
              }}
            />
          ) : (
            <Button title={paused ? 'Resume upload' : 'Pause'} variant="outline" onPress={() => setPaused((v) => !v)} />
          )}
          <Button title="Cancel Upload" variant="outline" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  lead: { color: colors.text, fontSize: 22, fontWeight: '800' },
  file: { color: colors.text, fontWeight: '700', fontSize: 16 },
  size: { color: colors.muted, marginTop: 8 },
  pct: { color: colors.blue, fontWeight: '800', fontSize: 20 },
  meta: { color: colors.dim, marginTop: 8, lineHeight: 20 },
  warn: { color: colors.amber, fontWeight: '800', fontSize: 16 },
});
