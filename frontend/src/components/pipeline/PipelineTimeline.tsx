import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/src/theme';
import { JobStatus } from '@/src/types/reconstruction';

export const PIPELINE_STEPS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  statuses: JobStatus[];
}[] = [
  { key: 'upload', label: 'Upload Complete', icon: 'cloud-upload', statuses: ['CREATED', 'UPLOADING', 'UPLOADED'] },
  { key: 'video', label: 'Video Analysis', icon: 'videocam', statuses: ['VALIDATING', 'VIDEO_PROCESSING'] },
  { key: 'frames', label: 'Frames Extracted', icon: 'images', statuses: ['FRAME_EXTRACTION'] },
  { key: 'pose', label: 'GPS & Flight Pose', icon: 'navigate', statuses: ['TELEMETRY_EXTRACTION', 'POSE_EXTRACTION'] },
  { key: 'dynamic', label: 'Dynamic Objects Removed', icon: 'car', statuses: ['DYNAMIC_OBJECT_DETECTION', 'MASK_GENERATION'] },
  { key: 'semantic', label: 'Semantic Layers', icon: 'map', statuses: ['SEMANTIC_SEGMENTATION'] },
  { key: 'recon', label: '3D Reconstruction', icon: 'cube', statuses: ['RECONSTRUCTION_INITIALIZING', 'ODM_PROCESSING', 'COLMAP_PROCESSING'] },
  { key: 'dense', label: 'Dense Point Cloud', icon: 'git-network', statuses: ['OPENMVS_PROCESSING', 'DENSE_RECONSTRUCTION'] },
  { key: 'mesh', label: 'Mesh Generation', icon: 'triangle', statuses: ['MESH_GENERATION'] },
  { key: 'tex', label: 'Texture Generation', icon: 'color-palette', statuses: ['TEXTURE_GENERATION'] },
  { key: 'export', label: 'Export', icon: 'download', statuses: ['MODEL_CONVERSION', 'EXPORT_GENERATION', 'COMPLETED'] },
];

function stepState(status: JobStatus, index: number) {
  const current = PIPELINE_STEPS.findIndex((s) => s.statuses.includes(status));
  const resolved = current === -1 ? (status === 'COMPLETED' ? PIPELINE_STEPS.length - 1 : 0) : current;
  if (status === 'COMPLETED') return 'done';
  if (index < resolved) return 'done';
  if (index === resolved) return status === 'FAILED' ? 'fail' : 'run';
  return 'todo';
}

export function PipelineTimeline({
  status,
  progress,
  onPressStage,
}: {
  status: JobStatus;
  progress: number;
  onPressStage?: (label: string, key: string) => void;
}) {
  return (
    <View>
      {PIPELINE_STEPS.map((step, i) => {
        const state = stepState(status, i);
        const color =
          state === 'done' ? colors.signal : state === 'run' ? colors.brass : state === 'fail' ? colors.red : colors.dim;
        return (
          <Pressable key={step.key} onPress={() => onPressStage?.(step.label, step.key)} style={styles.row}>
            <View style={styles.rail}>
              <Ionicons name={step.icon} size={16} color={color} />
              {i < PIPELINE_STEPS.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.body}>
              <Text style={[styles.label, { color: state === 'todo' ? colors.dim : colors.text }]}>{step.label}</Text>
              {state === 'run' ? <Text style={styles.pct}>{Math.round(progress)}%</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', minHeight: 42 },
  rail: { width: 28, alignItems: 'center' },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  body: { flex: 1, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 15, fontFamily: fonts.semibold },
  pct: { color: colors.signal, fontFamily: fonts.bold },
});
