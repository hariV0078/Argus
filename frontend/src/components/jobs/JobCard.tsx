import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/src/components/ui/Card';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { formatClock, formatDate } from '@/src/lib/format';
import { colors, fonts } from '@/src/theme';
import { ReconstructionJob } from '@/src/types/reconstruction';

function isActive(job: ReconstructionJob) {
  return job.status !== 'COMPLETED' && job.status !== 'FAILED';
}

export function JobCard({ job, onPress }: { job: ReconstructionJob; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      <Card style={styles.card} variant={isActive(job) ? 'accent' : 'default'}>
        <View style={styles.top}>
          <View style={styles.nameRow}>
            <View style={styles.icon}>
              <Ionicons name="videocam" size={15} color={colors.signal} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {job.name}
            </Text>
          </View>
          <StatusBadge status={job.status} />
        </View>
        <Text style={styles.file} numberOfLines={1}>
          {job.video.fileName}
        </Text>
        {isActive(job) ? (
          <View style={styles.prog}>
            <ProgressBar value={job.progress} />
            <Text style={styles.meta}>
              {job.currentStage} · {Math.round(job.progress)}%
            </Text>
          </View>
        ) : null}
        {job.status === 'FAILED' ? <Text style={styles.fail}>{job.message}</Text> : null}
        <View style={styles.foot}>
          {job.metrics?.accuracy ? (
            <Text style={styles.meta}>Accuracy: &lt; {job.metrics.accuracy.toFixed(2)} m</Text>
          ) : (
            <Text style={styles.meta}>GPS: {job.metadata.gpsAvailable ? 'Available' : 'Missing'}</Text>
          )}
          {job.metrics?.processingTimeSeconds ? (
            <Text style={styles.meta}>{formatClock(job.metrics.processingTimeSeconds)}</Text>
          ) : (
            <Text style={styles.meta}>{formatDate(job.createdAt)}</Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  icon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.signalSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.text, fontSize: 16, fontFamily: fonts.semibold, flexShrink: 1 },
  file: { color: colors.muted, marginTop: 8, fontSize: 13, marginLeft: 34 },
  prog: { marginTop: 12, gap: 8 },
  fail: { color: colors.red, marginTop: 10, fontSize: 13 },
  foot: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: colors.dim, fontSize: 12 },
});
