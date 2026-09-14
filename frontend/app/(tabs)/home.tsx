import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/src/components/brand/AppHeader';
import { JobCard } from '@/src/components/jobs/JobCard';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Field } from '@/src/components/ui/Field';
import { Loader } from '@/src/components/ui/Loader';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { Screen } from '@/src/components/ui/Screen';
import { formatClock, greeting } from '@/src/lib/format';
import { useAuthStore } from '@/src/store/authStore';
import { useJobStore } from '@/src/store/jobStore';
import { useServerStore } from '@/src/store/serverStore';
import { colors, fonts, radius, shadows } from '@/src/theme';
import { ReconstructionJob } from '@/src/types/reconstruction';

function isActive(job: ReconstructionJob) {
  return job.status !== 'COMPLETED' && job.status !== 'FAILED';
}

export default function HomeScreen() {
  const router = useRouter();
  const name = useAuthStore((s) => s.name);
  const jobs = useJobStore((s) => s.jobs);
  const loading = useJobStore((s) => s.loading);
  const refreshJobs = useJobStore((s) => s.refreshJobs);
  const backendUrl = useServerStore((s) => s.backendUrl);
  const connected = useServerStore((s) => s.connected);
  const connecting = useServerStore((s) => s.connecting);
  const serverError = useServerStore((s) => s.error);
  const setBackendUrl = useServerStore((s) => s.setBackendUrl);
  const connect = useServerStore((s) => s.connect);

  useFocusEffect(
    useCallback(() => {
      if (jobs.length === 0) void refreshJobs();
    }, [jobs.length, refreshJobs]),
  );

  const active = jobs.find(isActive);
  const recent = jobs.filter((j) => !isActive(j)).slice(0, 4);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
        <AppHeader title={`${greeting()}, ${name || 'Operator'}`} notify />

        <Card>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>SERVER</Text>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: connected ? colors.signal : colors.dim }]} />
              <Text style={styles.statusPillTxt}>{connected ? 'Connected' : 'Offline'}</Text>
            </View>
          </View>
          <Field
            label="Backend URL"
            autoCapitalize="none"
            autoCorrect={false}
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="http://192.168.0.10:8765"
          />
          {serverError ? <Text style={styles.warn}>{serverError}</Text> : null}
          <Button title="Connect" loading={connecting} style={{ marginTop: 14 }} onPress={() => void connect()} />
        </Card>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
          onPress={() => router.push('/(tabs)/new')}>
          <View style={styles.ctaRow}>
            <View style={styles.ctaIcon}>
              <Ionicons name="add" size={22} color={colors.signal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaPlus}>New reconstruction</Text>
              <Text style={styles.ctaSub}>Upload footage and start a build</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.navy} />
          </View>
        </Pressable>
        <Button
          title="Open sample 3D output"
          icon="cube-outline"
          variant="outline"
          style={{ marginTop: 10 }}
          onPress={() => router.push('/(tabs)/viewer')}
        />

        {loading && jobs.length === 0 ? (
          <View style={{ height: 220 }}>
            <Loader label="Loading jobs" />
          </View>
        ) : null}

        {active ? (
          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>IN PROGRESS</Text>
              <Ionicons name="sync" size={12} color={colors.signal} />
            </View>
            <Card variant="accent">
              <Text style={styles.jobName}>{active.name}</Text>
              <Text style={styles.file}>{active.video.fileName}</Text>
              <View style={{ marginTop: 14 }}>
                <ProgressBar value={active.progress} />
              </View>
              <Text style={styles.stage}>
                {active.currentStage} · {Math.round(active.progress)}%
              </Text>
              {active.metrics ? (
                <Text style={styles.eta}>{formatClock(active.metrics.processingTimeSeconds)}</Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(`/reconstruction/processing?jobId=${active.id}`)}>
                <Text style={styles.link}>View progress</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.signal} />
              </Pressable>
            </Card>
          </View>
        ) : null}

        {recent.length ? (
          <View style={[styles.sectionRow, { marginTop: 24 }]}>
            <Text style={styles.section}>RECENT</Text>
          </View>
        ) : null}
        {recent.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {recent.map((job) => (
              <Pressable
                key={job.id}
                style={({ pressed }) => [styles.mini, pressed && { opacity: 0.85 }]}
                onPress={() =>
                  job.status === 'COMPLETED' ? router.push(`/model/${job.id}`) : router.push('/(tabs)/jobs')
                }>
                <View
                  style={[
                    styles.miniDot,
                    { backgroundColor: job.status === 'COMPLETED' ? colors.signal : colors.amber },
                  ]}
                />
                <Text style={styles.miniName} numberOfLines={1}>
                  {job.name}
                </Text>
                <Text style={styles.miniMeta}>{job.status === 'COMPLETED' ? 'Completed' : job.status}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={{ marginTop: 18 }}>
          {jobs.slice(0, 2).map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPress={() =>
                job.status === 'COMPLETED'
                  ? router.push(`/model/${job.id}`)
                  : router.push(`/reconstruction/processing?jobId=${job.id}`)
              }
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.elevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillTxt: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 11 },
  cta: {
    backgroundColor: colors.signal,
    borderRadius: radius.lg,
    padding: 18,
    marginTop: 16,
    ...shadows.glow,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(11,28,24,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPlus: { color: colors.navy, fontFamily: fonts.bold, fontSize: 17 },
  ctaSub: { color: colors.navy, opacity: 0.7, fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  section: { color: colors.dim, fontFamily: fonts.semibold, letterSpacing: 0.8, fontSize: 12 },
  jobName: { color: colors.text, fontSize: 18, fontFamily: fonts.semibold },
  file: { color: colors.muted, marginTop: 4, fontFamily: fonts.regular },
  stage: { color: colors.muted, marginTop: 10, fontFamily: fonts.regular },
  eta: { color: colors.dim, marginTop: 4, fontSize: 12, fontFamily: fonts.regular },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start' },
  link: { color: colors.signal, fontFamily: fonts.semibold },
  warn: { color: colors.red, marginTop: 8, fontFamily: fonts.regular },
  mini: {
    width: 156,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    ...shadows.card,
  },
  miniDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  miniName: { color: colors.text, fontFamily: fonts.semibold },
  miniMeta: { color: colors.muted, marginTop: 6, fontSize: 12, fontFamily: fonts.regular },
});
