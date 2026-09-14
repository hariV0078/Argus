import { StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { useSettingsStore } from '@/src/store/settingsStore';
import { colors } from '@/src/theme';

export default function StorageSettings() {
  const wifiOnlyUploads = useSettingsStore((s) => s.wifiOnlyUploads);
  const cacheLabel = useSettingsStore((s) => s.cacheLabel);
  const setWifiOnly = useSettingsStore((s) => s.setWifiOnly);
  const clearCache = useSettingsStore((s) => s.clearCache);

  return (
    <Screen scroll>
      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h}>Wi-Fi only</Text>
            <Text style={styles.sub}>Warn on mobile data for large files</Text>
          </View>
          <Switch value={wifiOnlyUploads} onValueChange={setWifiOnly} trackColor={{ true: colors.blue, false: colors.border }} />
        </View>
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Text style={styles.h}>Preview cache</Text>
        <Text style={styles.sub}>{cacheLabel}</Text>
        <Button title="Clear cache" variant="outline" style={{ marginTop: 14 }} onPress={clearCache} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h: { color: colors.text, fontWeight: '700' },
  sub: { color: colors.muted, marginTop: 4 },
});
