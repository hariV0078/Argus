import { Ionicons } from '@expo/vector-icons';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/src/components/brand/AppHeader';
import { JobCard } from '@/src/components/jobs/JobCard';
import { Button } from '@/src/components/ui/Button';
import { Loader } from '@/src/components/ui/Loader';
import { Screen } from '@/src/components/ui/Screen';
import { T } from '@/src/components/ui/T';
import { Card } from '@/src/components/ui/Card';
import { ListRow } from '@/src/components/ui/ListRow';
import { useJobStore } from '@/src/store/jobStore';
import { useServerStore } from '@/src/store/serverStore';
import { colors, fonts, radius, shadows } from '@/src/theme';
import { ReconstructionJob } from '@/src/types/reconstruction';

type Tab = 'processing' | 'completed' | 'failed';

function matches(job: ReconstructionJob, tab: Tab) {
  if (tab === 'completed') return job.status === 'COMPLETED';
  if (tab === 'failed') return job.status === 'FAILED';
  return job.status !== 'COMPLETED' && job.status !== 'FAILED';
}

const TABS: { id: Tab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'processing', icon: 'pulse' },
  { id: 'completed', icon: 'checkmark-circle' },
  { id: 'failed', icon: 'alert-circle' },
];

export default function JobsScreen() {
  const router = useRouter();
  const jobs = useJobStore((s) => s.jobs);
  const loading = useJobStore((s) => s.loading);
  const refreshJobs = useJobStore((s) => s.refreshJobs);
  const pipelineJobs = useServerStore((s) => s.jobs);
  const [tab, setTab] = useState<Tab>('processing');

  useFocusEffect(
    useCallback(() => {
      void refreshJobs();
    }, [refreshJobs]),
  );

  const list = useMemo(() => jobs.filter((j) => matches(j, tab)), [jobs, tab]);

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <AppHeader title="Jobs" />
        <Button
          title="Submit new job"
          icon="add-circle"
          style={{ marginBottom: 14 }}
          onPress={() => router.push('/(tabs)/new')}
        />
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabOn]}>
              <Ionicons name={t.icon} size={14} color={tab === t.id ? colors.signal : colors.dim} />
              <Text style={[styles.tabTxt, tab === t.id && styles.tabTxtOn]}>
                {t.id[0].toUpperCase() + t.id.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {loading && jobs.length === 0 ? (
        <Loader label="Loading jobs" />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {pipelineJobs.length ? (
            <Card style={{ marginBottom: 12 }}>
              {pipelineJobs.map((job) => (
                <ListRow
                  key={job.id}
                  icon="pulse"
                  title={job.video_path || job.id}
                  subtitle={`${job.status} · ${Math.round(job.progress || 0)}%`}
                  onPress={() => router.push(`/pipeline/${job.id}` as Href)}
                />
              ))}
            </Card>
          ) : null}
          {list.length === 0 && pipelineJobs.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="layers-outline" size={26} color={colors.dim} />
              </View>
              <T variant="meta" style={{ marginTop: 12 }}>
                No jobs in this category yet
              </T>
            </View>
          ) : null}
          {list.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPress={() => {
                if (job.status === 'COMPLETED' || job.status === 'FAILED') router.push(`/model/${job.id}`);
                else router.push(`/reconstruction/processing?jobId=${job.id}`);
              }}
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 18, paddingTop: 8 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  tabOn: { backgroundColor: colors.signalSoft, borderWidth: 1, borderColor: colors.signalBorder, ...shadows.card },
  tabTxt: { color: colors.dim, fontFamily: fonts.semibold, fontSize: 11 },
  tabTxtOn: { color: colors.signal },
  list: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },
  empty: { alignItems: 'center', marginTop: 48 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
