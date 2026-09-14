import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/src/theme';

export function Loader({ label, inline }: { label?: string; inline?: boolean }) {
  return (
    <View style={[styles.wrap, inline && styles.inline]}>
      <ActivityIndicator size="large" color={colors.signal} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.bg },
  inline: { flex: 0, backgroundColor: 'transparent', padding: 0 },
  label: { marginTop: 14, color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
});
