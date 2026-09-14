import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/src/theme';
import { JobStatus } from '@/src/types/reconstruction';

export function statusTone(status: JobStatus) {
  if (status === 'COMPLETED')
    return { bg: '#16382C', fg: colors.signal, label: 'Completed', icon: 'checkmark-circle' as const };
  if (status === 'FAILED')
    return { bg: '#3A1A1A', fg: colors.red, label: 'Failed', icon: 'alert-circle' as const };
  if (status === 'CREATED' || status === 'UPLOADING' || status === 'UPLOADED') {
    return { bg: '#3A2F14', fg: colors.amber, label: 'Uploading', icon: 'cloud-upload' as const };
  }
  return { bg: '#14332C', fg: colors.signal, label: 'Processing', icon: 'sync' as const };
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const t = statusTone(status);
  return (
    <View style={[styles.wrap, { backgroundColor: t.bg }]}>
      <Ionicons name={t.icon} size={11} color={t.fg} />
      <Text style={[styles.txt, { color: t.fg }]}>{t.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  txt: { fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 0.3 },
});
