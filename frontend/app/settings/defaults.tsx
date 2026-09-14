import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { useSettingsStore } from '@/src/store/settingsStore';
import { colors, radius } from '@/src/theme';
import { ReconstructionMode, SemanticLayer } from '@/src/types/reconstruction';

const MODES: ReconstructionMode[] = ['fast', 'balanced', 'maximum'];

export default function DefaultsSettings() {
  const s = useSettingsStore();
  return (
    <Screen scroll>
      <View style={styles.seg}>
        {MODES.map((m) => (
          <Pressable key={m} onPress={() => s.setMode(m)} style={[styles.segBtn, s.reconstructionMode === m && styles.segOn]}>
            <Text style={[styles.segTxt, s.reconstructionMode === m && { color: colors.white }]}>
              {m === 'maximum' ? 'Max' : m[0].toUpperCase() + m.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Card style={{ marginTop: 16 }}>
        <Text style={styles.h}>Dynamic object removal</Text>
        <Row label="Cars" value={s.removeCars} on={(v) => s.setFlag('removeCars', v)} />
        <Row label="People" value={s.removePeople} on={(v) => s.setFlag('removePeople', v)} />
        <Row label="Other" value={s.removeOther} on={(v) => s.setFlag('removeOther', v)} />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Text style={styles.h}>Semantic layers</Text>
        {(['building', 'road', 'vegetation', 'terrain'] as SemanticLayer[]).map((l) => (
          <Row key={l} label={l[0].toUpperCase() + l.slice(1)} value={s.semanticLayers.includes(l)} on={() => s.toggleLayer(l)} />
        ))}
      </Card>
    </Screen>
  );
}

function Row({ label, value, on }: { label: string; value: boolean; on: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.v}>{label}</Text>
      <Switch value={value} onValueChange={on} trackColor={{ true: colors.blue, false: colors.border }} />
    </View>
  );
}

const styles = StyleSheet.create({
  h: { color: colors.text, fontWeight: '700' },
  v: { color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  segOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  segTxt: { color: colors.muted, fontWeight: '700' },
});
