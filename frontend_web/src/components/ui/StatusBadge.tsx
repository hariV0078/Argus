import { IoAlertCircle, IoCheckmarkCircle, IoCloudUpload, IoSync } from 'react-icons/io5';
import type { PipelineStatus } from '../../api/types';

function tone(status: PipelineStatus) {
  if (status === 'completed') return { bg: '#16382c', fg: 'var(--signal)', label: 'Completed', Icon: IoCheckmarkCircle };
  if (status === 'failed') return { bg: '#3a1a1a', fg: 'var(--red)', label: 'Failed', Icon: IoAlertCircle };
  if (status === 'cancelled') return { bg: '#3a1a1a', fg: 'var(--red)', label: 'Cancelled', Icon: IoAlertCircle };
  if (status === 'pending') return { bg: '#3a2f14', fg: 'var(--amber)', label: 'Pending', Icon: IoCloudUpload };
  return { bg: '#14332c', fg: 'var(--signal)', label: 'Running', Icon: IoSync };
}

export function StatusBadge({ status }: { status: PipelineStatus }) {
  const t = tone(status);
  return (
    <span className="badge" style={{ background: t.bg, color: t.fg }}>
      <t.Icon size={12} />
      {t.label}
    </span>
  );
}
