import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PipelineTimeline } from '@/src/components/pipeline/PipelineTimeline';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Loader } from '@/src/components/ui/Loader';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { formatClock } from '@/src/lib/format';
import { getReconstruction, startMockPipeline, subscribeToJob } from '@/src/services/api';
import { useJobStore } from '@/src/store/jobStore';
import { colors, radius } from '@/src/theme';
import { ReconstructionJob } from '@/src/types/reconstruction';

export default function ProcessingScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const applyEvent = useJobStore((s) => s.applyEvent);
  const [job, setJob] = useState<ReconstructionJob | null>(null);
  const retry = useJobStore((s) => s.retry);
  const [sheet, setSheet] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!jobId) return;
    let unsub = () => {};
    getReconstruction(jobId)
      .then((j) => {
        setJob(j);
        if (j.status !== 'COMPLETED' && j.status !== 'FAILED') {
          startMockPipeline(jobId);
        }
        unsub = subscribeToJob(jobId, (event) => {
          applyEvent(event);
          setLogs((prev) => [`${new Date().toLocaleTimeString()}  ${event.status}  ${event.message}`, ...prev].slice(0, 40));
          setJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: event.status,
                  progress: event.progress,
                  currentStage: event.currentStage,
                  message: event.message,
                }
              : prev,
          );
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Job not found'));
    return () => unsub();
  }, [jobId, applyEvent]);

  if (err) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.err}>{err}</Text>
      </View>
    );
  }

  if (!job) {
    return <Loader label="Loading job" />;
  }

  const done = job.status === 'COMPLETED';
  const failed = job.status === 'FAILED';

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 36 }}>
      <Text style={styles.lead}>{job.name}</Text>
      <Text style={styles.sub}>
        {job.currentStage} · {job.message}
      </Text>
      <Card style={{ marginTop: 12 }}>
        <ProgressBar value={job.progress} />
        <Text style={styles.pct}>{Math.round(job.progress)}%</Text>
        <Text style={styles.meta}>Status: {job.status}</Text>
        {job.metrics ? (
          <Text style={styles.meta}>
            Runtime {formatClock(job.metrics.processingTimeSeconds)} / target{' '}
            {formatClock(job.metrics.targetProcessingTimeSeconds)}
          </Text>
        ) : null}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <PipelineTimeline
          status={job.status}
          progress={job.progress}
          onPressStage={(label) => setSheet(label)}
        />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.failTitle}>Processing logs</Text>
        {logs.length === 0 ? <Text style={styles.meta}>Waiting for events…</Text> : null}
        {logs.slice(0, 8).map((line, i) => (
          <Text key={`${i}-${line}`} style={styles.log}>
            {line}
          </Text>
        ))}
      </Card>

      {failed ? (
        <Card style={{ marginTop: 14 }}>
          <Text style={styles.failTitle}>Reconstruction failed</Text>
          <Text style={styles.sub}>Stage: {job.currentStage}</Text>
          <Text style={styles.fail}>{job.message}</Text>
          <Button
            title="Retry Stage"
            style={{ marginTop: 12 }}
            onPress={async () => {
              await retry(job.id);
              router.replace(`/reconstruction/processing?jobId=${job.id}`);
            }}
          />
          <Button title="Change Settings" variant="outline" style={{ marginTop: 8 }} onPress={() => router.push('/settings/defaults')} />
          <Button title="Contact Support" variant="ghost" style={{ marginTop: 8 }} onPress={() => router.push('/support')} />
        </Card>
      ) : null}

      {done ? (
        <Button title="Open 3D Model" style={{ marginTop: 18 }} onPress={() => router.replace(`/model/${job.id}`)} />
      ) : (
        <Button title="Back to Home" variant="ghost" style={{ marginTop: 18 }} onPress={() => router.replace('/(tabs)/home')} />
      )}

      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.lead}>{sheet}</Text>
            <Text style={styles.meta}>{job.currentStage}</Text>
            <Text style={styles.meta}>{job.status}</Text>
            <Text style={styles.meta}>Progress: {Math.round(job.progress)}%</Text>
            <Text style={styles.meta}>{job.message}</Text>
            <Button title="Close" variant="outline" style={{ marginTop: 16 }} onPress={() => setSheet(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  lead: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sub: { color: colors.muted, marginTop: 6 },
  pct: { color: colors.blue, fontWeight: '800', marginTop: 10, fontSize: 18 },
  meta: { color: colors.dim, marginTop: 6 },
  err: { color: colors.red },
  failTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  fail: { color: colors.red, marginTop: 8 },
  log: { color: colors.dim, marginTop: 6, fontSize: 11, fontFamily: 'monospace' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    padding: 20,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
