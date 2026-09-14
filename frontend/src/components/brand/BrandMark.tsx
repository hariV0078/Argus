import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, shadows } from '@/src/theme';

export function StackBrandTitle({ children }: { children: string }) {
  return (
    <View style={styles.titleRow}>
      <BrandMark size={28} />
      <Text style={styles.stackTitle} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

export function BrandMark({ size = 88 }: { size?: number }) {
  return (
    <View style={[styles.glowWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image source={require('../../../assets/brand/logo.png')} style={{ width: size, height: size }} />
      </View>
    </View>
  );
}

export function BrandLockup({ compact }: { compact?: boolean }) {
  return (
    <View style={styles.lock}>
      <BrandMark size={compact ? 58 : 96} />
      <Text style={[styles.name, compact && { fontSize: 20, marginTop: 8 }]}>Argus</Text>
    </View>
  );
}

export function BrandRow({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.row}>
      <BrandMark size={40} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glowWrap: { ...shadows.glow },
  ring: {
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.signal,
  },
  lock: { alignItems: 'center' },
  name: {
    marginTop: 14,
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.text,
    letterSpacing: 0.4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  rowSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 260 },
  stackTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text, flexShrink: 1 },
});
