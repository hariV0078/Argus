import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { formatDuration } from '@/src/lib/format';
import { DEMO_TELEMETRY, parseTelemetryText, summarizeGps } from '@/src/lib/gps';
import { useJobStore } from '@/src/store/jobStore';
import { colors, fonts } from '@/src/theme';

function Tick({ ok, label, extra }: { ok: boolean; label: string; extra?: string }) {
  return (
    <View style={styles.tickRow}>
      <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={18} color={ok ? colors.signal : colors.red} />
      <View style={{ flex: 1 }}>
        <Text style={styles.tickLabel}>{label}</Text>
        {extra ? <Text style={styles.extra}>{extra}</Text> : null}
      </View>
      <Text style={{ color: ok ? colors.signal : colors.amber, fontFamily: fonts.semibold }}>{ok ? 'Available' : 'Missing'}</Text>
    </View>
  );
}

export default function MetadataScreen() {
  const router = useRouter();
  const draft = useJobStore((s) => s.draft);
  const setDraft = useJobStore((s) => s.setDraft);
  const [busy, setBusy] = useState(false);

  const video = draft.video;
  const summary = useMemo(() => summarizeGps(draft.gpsPoints), [draft.gpsPoints]);

  const attachSidecar = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'text/csv', 'application/csv', '*/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const file = res.assets[0];
    if (!/\.(srt|csv|txt|log)$/i.test(file.name) && file.mimeType && !file.mimeType.includes('text') && !file.mimeType.includes('csv')) {
      Alert.alert('Unsupported file', 'Use a .srt, .csv, or .txt telemetry file.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(file.uri);
      const text = await response.text();
      const points = parseTelemetryText(text);
      const info = summarizeGps(points);
      if (!points.length) {
        Alert.alert('No GPS found', 'That file had no readable lat/lon points.');
        setBusy(false);
        return;
      }
      setDraft({
        gpsPoints: points,
        gpsAvailable: true,
        altitudeAvailable: info.altitudeAvailable,
        gpsSource: 'sidecar',
        imuAvailable: /pitch|roll|yaw|imu/i.test(text),
      });
    } catch {
      Alert.alert('Read failed', 'Could not parse telemetry file.');
    }
    setBusy(false);
  };

  const continueWithout = () => {
    Alert.alert(
      'GPS Metadata Not Found',
      'The selected video does not contain usable GPS coordinates. Model will not be georeferenced.',
      [
        { text: 'Upload Flight Metadata', onPress: attachSidecar },
        {
          text: 'Continue Without GPS',
          style: 'destructive',
          onPress: () => {
            setDraft({ gpsSource: 'skipped', gpsAvailable: false });
            router.push('/reconstruction/configuration');
          },
        },
        { text: 'Select Another Video', onPress: () => router.back() },
      ],
    );
  };

  const onContinue = () => {
    if (!draft.gpsAvailable) {
      continueWithout();
      return;
    }
    router.push('/reconstruction/configuration');
  };

  if (!video) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.warn}>No video selected.</Text>
        <Button title="Back to video" onPress={() => router.replace('/reconstruction/video')} />
      </View>
    );
  }

  const first = summary.first;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.lead}>Flight metadata</Text>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.h}>Video Information</Text>
        <Text style={styles.kv}>Resolution     {video.width} × {video.height}</Text>
        <Text style={styles.kv}>FPS            {video.fps}</Text>
        <Text style={styles.kv}>Duration       {video.durationSeconds ? formatDuration(video.durationSeconds) : '—'}</Text>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.h}>GPS Coverage</Text>
        <Tick
          ok={draft.gpsAvailable}
          label="Latitude / Longitude"
          extra={
            first
              ? `${first.lat.toFixed(5)}, ${first.lon.toFixed(5)}`
              : 'Embedded GPS not found in this file'
          }
        />
        <Tick ok={draft.altitudeAvailable} label="Altitude" extra={first?.alt != null ? `${first.alt} m` : undefined} />
        <Tick ok={draft.gpsPoints.length > 1} label="Track points" extra={`${draft.gpsPoints.length} points · source ${draft.gpsSource}`} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.h}>Flight Sensors</Text>
        <Tick ok={draft.imuAvailable} label="IMU" />
        <Tick ok={draft.cameraParametersAvailable} label="Camera Params" />
        <Tick ok={draft.rtkPpkAvailable} label="RTK / PPK" />
      </Card>

      <Button
        title="Load sample telemetry"
        variant="outline"
        style={{ marginTop: 16 }}
        onPress={() => {
          const points = parseTelemetryText(DEMO_TELEMETRY);
          const info = summarizeGps(points);
          setDraft({
            gpsPoints: points,
            gpsAvailable: true,
            altitudeAvailable: info.altitudeAvailable,
            gpsSource: 'sidecar',
            imuAvailable: false,
          });
        }}
      />
      <Button title="Upload SRT / CSV" variant="outline" loading={busy} onPress={attachSidecar} style={{ marginTop: 10 }} />
      <Button title="Continue" onPress={onContinue} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  lead: { color: colors.text, fontSize: 22, fontFamily: fonts.bold },
  sub: { color: colors.muted, marginTop: 6, fontFamily: fonts.regular },
  h: { color: colors.text, fontFamily: fonts.semibold, marginBottom: 8 },
  kv: { color: colors.muted, marginTop: 4, fontFamily: fonts.regular, fontVariant: ['tabular-nums'] },
  tickRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 10 },
  tickLabel: { color: colors.text, fontFamily: fonts.semibold },
  extra: { color: colors.dim, marginTop: 2, fontSize: 12, fontFamily: fonts.regular },
  warn: { color: colors.amber, marginBottom: 12 },
});
