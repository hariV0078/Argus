import { IoVideocam } from 'react-icons/io5';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusBadge } from '../ui/StatusBadge';
import type { PipelineJob } from '../../api/types';

export function isActiveJob(job: PipelineJob) {
  return job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled';
}

export function PipelineJobCard({ job, onClick }: { job: PipelineJob; onClick?: () => void }) {
  const active = isActiveJob(job);
  return (
    <Card variant={active ? 'accent' : 'default'} className="job-card" onClick={onClick}>
      <div className="job-card-top">
        <div className="job-card-name-row">
          <span className="job-card-icon">
            <IoVideocam size={14} color="var(--signal)" />
          </span>
          <span className="job-card-name">{job.video_path || job.id}</span>
        </div>
        <StatusBadge status={job.status} />
      </div>
      {active ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ProgressBar value={job.progress ?? 8} />
          <span className="p-meta">{job.message || 'Working'} · {Math.round(job.progress ?? 0)}%</span>
        </div>
      ) : null}
      {job.status === 'failed' ? <p style={{ color: 'var(--red)', marginTop: 10, fontSize: 13 }}>{job.message}</p> : null}
      <div className="job-card-foot">
        <span>UTM EPSG {job.utm_epsg ?? '—'}</span>
        <span>{job.fps ? `${job.fps} fps` : job.id.slice(0, 10)}</span>
      </div>
    </Card>
  );
}
