import { StyleSheet, Text } from 'react-native';
import { BrandLockup } from '@/src/components/brand/BrandMark';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { colors, fonts } from '@/src/theme';

export default function AboutSettings() {
  return (
    <Screen scroll>
      <BrandLockup />
      <Card style={{ marginTop: 20 }}>
        <Text style={styles.k}>Product</Text>
        <Text style={styles.v}>Argus</Text>
        <Text style={styles.k}>Version</Text>
        <Text style={styles.v}>1.0.0</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  k: { color: colors.dim, fontSize: 12, fontFamily: fonts.semibold, marginTop: 12 },
  v: { color: colors.text, marginTop: 4, fontFamily: fonts.regular },
});
