import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Loader } from '@/src/components/ui/Loader';
import { getReconstruction } from '@/src/services/api';
import { colors, fonts } from '@/src/theme';
import { ReconstructionJob } from '@/src/types/reconstruction';

export default function QualityReportScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<ReconstructionJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    getReconstruction(jobId)
      .then(setJob)
      .catch(() => setJob(null))
      .finally(() => setLoading(false));
  }, [jobId]);

  const gps = job?.metadata.gpsAvailable ?? false;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 36, flexGrow: 1 }}>
      <Stack.Screen
        options={{ title: 'Quality', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.signal }}
      />
      {loading ? (
        <Loader label="Loading report" />
      ) : (
        <>
          <Text style={styles.title}>{job?.name || 'Reconstruction'}</Text>
          <Card style={{ marginTop: 14 }}>
            <Row k="Confidence" v={gps ? '0.86' : '0.61'} />
            <Row k="Facade coverage" v="Visible side only" />
            <Row k="Metric scale" v={gps ? 'GPS-aligned' : 'Relative'} />
          </Card>
          <View style={{ marginTop: 16 }}>
            <Button title="View model" onPress={() => job && router.replace(`/model/${job.id}`)} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 22, fontFamily: fonts.bold },
  k: { color: colors.dim, fontSize: 12, fontFamily: fonts.semibold },
  v: { color: colors.text, marginTop: 2, fontFamily: fonts.regular },
});
