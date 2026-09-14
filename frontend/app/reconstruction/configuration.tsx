import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { estimateProcessingMinutes, formatDuration } from '@/src/lib/format';
import { useJobStore } from '@/src/store/jobStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { colors, radius } from '@/src/theme';
import { ReconstructionMode, SemanticLayer } from '@/src/types/reconstruction';

const MODES: ReconstructionMode[] = ['fast', 'balanced', 'maximum'];

export default function ConfigurationScreen() {
  const router = useRouter();
  const draft = useJobStore((s) => s.draft);
  const setDraft = useJobStore((s) => s.setDraft);
  const defaults = useSettingsStore();

  useEffect(() => {
    setDraft({
      reconstructionMode: defaults.reconstructionMode,
      removeCars: defaults.removeCars,
      removePeople: defaults.removePeople,
      removeOther: defaults.removeOther,
      semanticLayers: defaults.semanticLayers,
    });
    // seed once from Settings defaults
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const minutes = estimateProcessingMinutes(draft.video?.durationSeconds || 600, draft.reconstructionMode);

  const toggleLayer = (layer: SemanticLayer) => {
    const has = draft.semanticLayers.includes(layer);
    setDraft({
      semanticLayers: has ? draft.semanticLayers.filter((l) => l !== layer) : [...draft.semanticLayers, layer],
    });
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.lead}>Settings</Text>

      <Text style={styles.label}>Project name</Text>
      <TextInput
        style={styles.input}
        placeholder="Campus Survey — September"
        placeholderTextColor={colors.dim}
        value={draft.name}
        onChangeText={(name) => setDraft({ name })}
      />

      <Text style={styles.label}>Reconstruction mode</Text>
      <View style={styles.seg}>
        {MODES.map((m) => (
          <Pressable
            key={m}
            onPress={() => setDraft({ reconstructionMode: m })}
            style={[styles.segBtn, draft.reconstructionMode === m && styles.segOn]}>
            <Text style={[styles.segTxt, draft.reconstructionMode === m && styles.segTxtOn]}>
              {m === 'maximum' ? 'Maximum Accuracy' : m[0].toUpperCase() + m.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.h}>Remove moving objects</Text>
        <Row label="Cars" value={draft.removeCars} on={ (v) => setDraft({ removeCars: v }) } />
        <Row label="People" value={draft.removePeople} on={ (v) => setDraft({ removePeople: v }) } />
        <Row label="Other" value={draft.removeOther} on={ (v) => setDraft({ removeOther: v }) } />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.h}>Generate semantic layers</Text>
        {(['building', 'road', 'vegetation', 'terrain'] as SemanticLayer[]).map((l) => (
          <Row
            key={l}
            label={l[0].toUpperCase() + l.slice(1)}
            value={draft.semanticLayers.includes(l)}
            on={() => toggleLayer(l)}
          />
        ))}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.h}>Estimate</Text>
        <Text style={styles.kv}>{draft.video ? formatDuration(draft.video.durationSeconds) : '—'} video</Text>
        <Text style={styles.big}>~{minutes} min</Text>
      </Card>

      <Button title="Review and start" style={{ marginTop: 18 }} onPress={() => router.push('/reconstruction/review')} />
    </ScrollView>
  );
}

function Row({ label, value, on }: { label: string; value: boolean; on: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={on} trackColor={{ true: colors.blue, false: colors.border }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  lead: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  label: { color: colors.muted, marginTop: 14, marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  seg: { flexDirection: 'row', gap: 6 },
  segBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  segOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  segTxt: { color: colors.muted, fontWeight: '700', fontSize: 11, textAlign: 'center' },
  segTxtOn: { color: colors.white },
  h: { color: colors.text, fontWeight: '700', marginTop: 6 },
  ok: { color: colors.green, marginTop: 4 },
  kv: { color: colors.muted, marginTop: 6 },
  big: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  rowLabel: { color: colors.text },
});
