import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { listSamples, uploadVideo } from '@/src/api/client';
import { SampleDataset } from '@/src/api/types';
import { AppHeader } from '@/src/components/brand/AppHeader';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Field } from '@/src/components/ui/Field';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { useServerStore } from '@/src/store/serverStore';
import { colors, fonts } from '@/src/theme';

export default function NewScanTab() {
  const router = useRouter();
  const utmEpsg = useServerStore((s) => s.utmEpsg);
  const connected = useServerStore((s) => s.connected);
  const submit = useServerStore((s) => s.submit);
  const [videoPath, setVideoPath] = useState('data/raw/drone.MOV');
  const [fps, setFps] = useState('3.0');
  const [blur, setBlur] = useState('80');
  const [epsg, setEpsg] = useState(String(utmEpsg));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [samples, setSamples] = useState<SampleDataset[]>([]);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Sample inputs already on the server (e.g. the pre-extracted frame set) —
  // lets a demo submit a real job with nothing to upload.
  useEffect(() => {
    if (!connected) {
      setSamples([]);
      return;
    }
    listSamples()
      .then(setSamples)
      .catch(() => setSamples([]));
  }, [connected]);

  const onSubmit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const job = await submit({
        video_path: videoPath.trim() || 'data/raw/drone.MOV',
        fps: Number(fps) || 3,
        blur_threshold: Number(blur) || 80,
        utm_epsg: Number(epsg) || utmEpsg,
      });
      router.push(`/pipeline/${job.id}` as Href);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start job');
    }
    setBusy(false);
  };

  const runSample = async (sample: SampleDataset) => {
    setBusy(true);
    setErr(null);
    try {
      const job = await submit(sample.run_request);
      router.push(`/pipeline/${job.id}` as Href);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start job from sample');
    }
    setBusy(false);
  };

  // Real upload: picks a video on the phone and sends the bytes to the
  // backend (POST /api/pipeline/upload), then fills Video path with the
  // server-side path it hands back — ready to Submit job.
  const uploadPicked = async (uri: string, name: string) => {
    setUploading(true);
    setErr(null);
    try {
      const res = await uploadVideo({ uri, name });
      setVideoPath(res.video_path);
      setUploadedName(res.filename);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    }
    setUploading(false);
  };

  const pickAndUploadFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['video/mp4', 'video/quicktime', 'video/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await uploadPicked(a.uri, a.name);
  };

  const pickAndUploadGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to pick a drone video.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await uploadPicked(a.uri, a.fileName || 'upload.mp4');
  };

  return (
    <Screen scroll>
      <AppHeader title="New job" subtitle={connected ? 'Live server' : 'Local preview'} />

      {connected && samples.length ? (
        <Card>
          <Text style={styles.h}>Sample inputs on server</Text>
          {samples.map((s) => (
            <ListRow
              key={s.id}
              icon={s.kind === 'frames' ? 'images' : 'videocam'}
              title={s.name}
              subtitle={s.description}
              onPress={() => runSample(s)}
            />
          ))}
        </Card>
      ) : null}

      <Card style={{ marginTop: connected && samples.length ? 12 : 0 }}>
        <Field label="Video path" autoCapitalize="none" value={videoPath} onChangeText={setVideoPath} />
        {uploadedName ? <Text style={styles.uploaded}>Uploaded: {uploadedName}</Text> : null}
        <Field label="FPS" keyboardType="decimal-pad" value={fps} onChangeText={setFps} />
        <Field label="Blur threshold" keyboardType="number-pad" value={blur} onChangeText={setBlur} />
        <Field label="UTM EPSG" keyboardType="number-pad" value={epsg} onChangeText={setEpsg} />
      </Card>
      {err ? (
        <View style={styles.errRow}>
          <Ionicons name="alert-circle" size={16} color={colors.red} />
          <Text style={styles.err}>{err}</Text>
        </View>
      ) : null}
      <View style={{ marginTop: 18 }}>
        <Button title="Submit job" icon="rocket-outline" loading={busy} onPress={onSubmit} />
        {connected ? (
          <>
            <Button
              title="Upload video from files"
              icon="document-attach-outline"
              variant="outline"
              loading={uploading}
              style={{ marginTop: 10 }}
              onPress={pickAndUploadFile}
            />
            <Button
              title="Upload video from gallery"
              icon="images-outline"
              variant="outline"
              loading={uploading}
              style={{ marginTop: 10 }}
              onPress={pickAndUploadGallery}
            />
          </>
        ) : null}
        <Button
          title="Pick device video (offline preview)"
          icon="film-outline"
          variant="outline"
          style={{ marginTop: 10 }}
          onPress={() => router.push('/reconstruction/video')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { color: colors.text, fontFamily: fonts.semibold, marginBottom: 4 },
  uploaded: { color: colors.dim, fontSize: 12, fontFamily: fonts.regular, marginTop: -4, marginBottom: 8 },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  err: { color: colors.red, fontFamily: fonts.semibold, flexShrink: 1 },
});
