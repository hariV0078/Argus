import { Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { useJobPoller } from '@/src/hooks/useJobPoller';
import { useJobSocket } from '@/src/hooks/useJobSocket';
import { useServerStore } from '@/src/store/serverStore';
import { colors, fonts } from '@/src/theme';

// Stable reference for the "no logs yet" case — returning a fresh `[]` from
// a zustand selector makes every render see a "changed" snapshot (React's
// getSnapshot-must-be-cached rule), which loops forever. Fall back to this
// constant outside the selector instead.
const EMPTY_LOGS: string[] = [];

export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const connected = useServerStore((s) => s.connected);
  const local = useServerStore((s) => s.jobs.find((j) => j.id === jobId));
  const mockLogs = useServerStore((s) => (jobId ? s.mockLogs[jobId] : undefined)) ?? EMPTY_LOGS;
  const { job: liveJob } = useJobPoller(jobId);
  const { logs: liveLogs } = useJobSocket(jobId);

  const job = liveJob || local;
  const logs = connected ? liveLogs : mockLogs;

  useEffect(() => {
    if (job?.status === 'completed') {
      void useServerStore.getState().refreshOutputs();
    }
  }, [job?.status]);

  const progress = job?.progress ?? (job?.status === 'completed' ? 100 : 8);
  const title = useMemo(() => job?.video_path || jobId || 'Job', [job?.video_path, jobId]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 18, paddingBottom: 36 }}>
      <Stack.Screen
        options={{ title: 'Job', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.signal }}
      />
      <Text style={styles.lead}>{title}</Text>
      <Text style={styles.sub}>{job?.status || 'pending'} · {job?.message || 'Waiting'}</Text>
      <Card style={{ marginTop: 14 }}>
        <ProgressBar value={progress} />
        <Text style={styles.pct}>{Math.round(progress)}%</Text>
      </Card>
      <Card style={{ marginTop: 14 }}>
        <Text style={styles.h}>Logs</Text>
        {logs.length === 0 ? <Text style={styles.sub}>Waiting for stream…</Text> : null}
        {logs.slice(0, 24).map((line) => (
          <Text key={line} style={styles.log}>
            {line}
          </Text>
        ))}
      </Card>
      {job?.status === 'completed' ? (
        <Button title="View outputs" style={{ marginTop: 18 }} onPress={() => router.push('/outputs' as Href)} />
      ) : (
        <Button title="Back to jobs" variant="ghost" style={{ marginTop: 18 }} onPress={() => router.replace('/(tabs)/jobs')} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  lead: { color: colors.text, fontSize: 20, fontFamily: fonts.bold },
  sub: { color: colors.muted, marginTop: 6, fontFamily: fonts.regular },
  pct: { color: colors.signal, marginTop: 10, fontFamily: fonts.bold, fontSize: 18 },
  h: { color: colors.text, fontFamily: fonts.semibold, marginBottom: 8 },
  log: { color: colors.dim, marginTop: 6, fontSize: 12, fontFamily: 'monospace' },
});
