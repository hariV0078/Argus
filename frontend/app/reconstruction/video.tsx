import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { formatBytes, formatDuration } from '@/src/lib/format';
import { loadSampleInput } from '@/src/lib/sampleDataset';
import { readVideoMeta, validateVideo } from '@/src/lib/videoMeta';
import { useJobStore } from '@/src/store/jobStore';
import { colors, fonts } from '@/src/theme';
import { VideoMeta } from '@/src/types/reconstruction';

export default function VideoSelectScreen() {
  const router = useRouter();
  const setDraft = useJobStore((s) => s.setDraft);
  const current = useJobStore((s) => s.draft.video);
  const [video, setVideo] = useState<VideoMeta | null>(current);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  const apply = async (partial: {
    uri: string;
    fileName?: string | null;
    durationMs?: number | null;
    width?: number | null;
    height?: number | null;
    fileSize?: number | null;
  }) => {
    setBusy(true);
    setWarn(null);
    try {
      const meta = await readVideoMeta(partial);
      const issue = validateVideo(meta);
      if (issue) {
        setWarn(issue);
        setBusy(false);
        return;
      }
      setVideo(meta);
      setDraft({
        video: meta,
        gpsAvailable: false,
        gpsPoints: [],
        gpsSource: 'none',
        altitudeAvailable: false,
        imuAvailable: false,
      });
    } catch (e) {
      setWarn(e instanceof Error ? e.message : 'Could not read video.');
    }
    setBusy(false);
  };

  const pickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to pick a drone video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await apply({
      uri: a.uri,
      fileName: a.fileName,
      durationMs: a.duration,
      width: a.width,
      height: a.height,
      fileSize: a.fileSize,
    });
  };

  const capture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera to capture a flight video.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 180,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await apply({
      uri: a.uri,
      fileName: a.fileName || 'captured_flight.mp4',
      durationMs: a.duration,
      width: a.width,
      height: a.height,
      fileSize: a.fileSize,
    });
  };

  const useSample = async () => {
    setBusy(true);
    setWarn(null);
    try {
      const sample = await loadSampleInput();
      setVideo(sample.video);
      setDraft(sample.draft);
    } catch (e) {
      setWarn(e instanceof Error ? e.message : 'Could not load sample dataset.');
    }
    setBusy(false);
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['video/mp4', 'video/quicktime', 'video/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await apply({
      uri: a.uri,
      fileName: a.name,
      fileSize: a.size,
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>Select video</Text>
      <Text style={styles.sub}>MP4 or MOV · 1080p / 4K</Text>

      <Card style={styles.drop}>
        <Ionicons name="videocam" size={36} color={colors.signal} />
        <Text style={styles.dropTitle}>{video ? video.fileName : 'No video selected'}</Text>
        {video ? (
          <View style={{ marginTop: 10, gap: 4 }}>
            <Text style={styles.meta}>
              {video.width} × {video.height} · {video.fps} FPS
            </Text>
            <Text style={styles.meta}>
              Duration {video.durationSeconds ? formatDuration(video.durationSeconds) : '—'}
            </Text>
            <Text style={styles.meta}>{video.sizeBytes ? formatBytes(video.sizeBytes) : 'Size unknown'}</Text>
          </View>
        ) : (
          <Text style={styles.hint}>Gallery, files, or camera</Text>
        )}
      </Card>

      {warn ? <Text style={styles.warn}>{warn}</Text> : null}

      <Button title="Use sample dataset" onPress={useSample} loading={busy} />
      <Button title="Gallery" variant="outline" onPress={pickGallery} loading={busy} style={{ marginTop: 10 }} />
      <Button title="Files" variant="outline" onPress={pickFile} loading={busy} style={{ marginTop: 10 }} />
      <Button title="Camera" variant="outline" onPress={capture} loading={busy} style={{ marginTop: 10 }} />
      <Button
        title="Continue"
        disabled={!video}
        style={{ marginTop: 18 }}
        onPress={() => router.push('/reconstruction/metadata')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  lead: { color: colors.text, fontSize: 22, fontFamily: fonts.bold },
  sub: { color: colors.muted, marginTop: 6, marginBottom: 16, fontFamily: fonts.regular },
  drop: { alignItems: 'center', marginBottom: 16, paddingVertical: 28, gap: 8 },
  dropTitle: { color: colors.text, fontFamily: fonts.semibold, textAlign: 'center' },
  hint: { color: colors.dim, marginTop: 8, textAlign: 'center', fontFamily: fonts.regular },
  meta: { color: colors.muted, textAlign: 'center', fontFamily: fonts.regular },
  warn: { color: colors.amber, marginBottom: 12, fontFamily: fonts.medium },
});
