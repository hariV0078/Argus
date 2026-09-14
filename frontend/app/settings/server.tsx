import { StyleSheet, Text } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Field } from '@/src/components/ui/Field';
import { Screen } from '@/src/components/ui/Screen';
import { useServerStore } from '@/src/store/serverStore';
import { colors, fonts } from '@/src/theme';

export default function ServerSettings() {
  const backendUrl = useServerStore((s) => s.backendUrl);
  const utmEpsg = useServerStore((s) => s.utmEpsg);
  const connected = useServerStore((s) => s.connected);
  const connecting = useServerStore((s) => s.connecting);
  const error = useServerStore((s) => s.error);
  const setBackendUrl = useServerStore((s) => s.setBackendUrl);
  const setUtmEpsg = useServerStore((s) => s.setUtmEpsg);
  const connect = useServerStore((s) => s.connect);

  return (
    <Screen scroll>
      <Card>
        <Field label="Backend URL" autoCapitalize="none" autoCorrect={false} value={backendUrl} onChangeText={setBackendUrl} />
        <Field
          label="UTM EPSG"
          keyboardType="number-pad"
          value={String(utmEpsg)}
          onChangeText={(t) => setUtmEpsg(Number(t) || 32644)}
        />
        <Text style={styles.meta}>{connected ? 'Connected' : 'Not connected'}</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <Button title="Connect" loading={connecting} style={{ marginTop: 16 }} onPress={() => void connect()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, marginTop: 12, fontFamily: fonts.regular },
  err: { color: colors.red, marginTop: 8, fontFamily: fonts.regular },
});
