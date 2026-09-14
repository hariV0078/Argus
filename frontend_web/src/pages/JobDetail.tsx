import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IoCubeOutline, IoTerminalOutline } from 'react-icons/io5';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useJobPoller } from '../hooks/useJobPoller';
import { useJobSocket } from '../hooks/useJobSocket';
import { useServerStore } from '../store/serverStore';
import './pages.css';

const EMPTY_LOGS: string[] = [];

function getLogClass(line: string) {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('failed') || lower.includes('exception')) return 'log-line error';
  if (lower.includes('completed') || lower.includes('success') || lower.includes('finished')) return 'log-line success';
  if (lower.includes('info') || lower.includes('starting') || lower.includes('processing')) return 'log-line info';
  return 'log-line';
}

export function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const connected = useServerStore((s) => s.connected);
  const local = useServerStore((s) => s.jobs.find((j) => j.id === jobId));
  const mockLogs = useServerStore((s) => (jobId ? s.mockLogs[jobId] : undefined)) ?? EMPTY_LOGS;
  const { job: liveJob } = useJobPoller(jobId);
  const { logs: liveLogs } = useJobSocket(jobId);

  const job = liveJob || local;
  const logs = connected ? liveLogs : mockLogs;

  useEffect(() => {
    if (job?.status === 'completed') {
      void useServerStore.getState().refreshOutputs();
    }
  }, [job?.status]);

  const progress = job?.progress ?? (job?.status === 'completed' ? 100 : 8);
  const title = useMemo(() => job?.video_path || jobId || 'Job', [job?.video_path, jobId]);

  return (
    <div>
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="job-detail-title">{title}</h1>
            <p className="job-detail-sub">
              ID: {jobId} · {job?.message || 'Processing dataset'}
            </p>
          </div>
          {job?.status ? <StatusBadge status={job.status} /> : null}
        </div>
      </div>

      <Card style={{ marginTop: 14 }} variant="accent">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Pipeline Progress</span>
          <span className="job-detail-pct" style={{ margin: 0 }}>{Math.round(progress)}%</span>
        </div>
        <ProgressBar value={progress} />
      </Card>

      <Card style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--signal)', fontWeight: 700, fontSize: 14 }}>
            <IoTerminalOutline size={18} /> Console Telemetry Logs
          </div>
          <span className="badge" style={{ background: 'var(--surface-alt)', color: 'var(--muted)' }}>
            {logs.length} Lines
          </span>
        </div>
        
        {logs.length === 0 ? (
          <p className="job-detail-sub" style={{ fontStyle: 'italic', padding: '12px 0' }}>
            Waiting for live log stream…
          </p>
        ) : null}

        <div style={{ maxHeight: 440, overflowY: 'auto', background: 'rgba(9, 13, 22, 0.7)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          {logs.slice(0, 100).map((line, i) => (
            <div className={getLogClass(line)} key={i}>
              <span style={{ color: 'var(--dim)', marginRight: 10, fontSize: 11, userSelect: 'none' }}>
                {(i + 1).toString().padStart(2, '0')}
              </span>
              {line}
            </div>
          ))}
        </div>
      </Card>

      {job?.status === 'completed' ? (
        <Button
          style={{ marginTop: 22 }}
          icon={<IoCubeOutline size={20} />}
          onClick={() => navigate('/outputs')}>
          View 3D Outputs & Models
        </Button>
      ) : (
        <Button variant="ghost" style={{ marginTop: 22 }} onClick={() => navigate('/jobs')}>
          Back to Jobs List
        </Button>
      )}
    </div>
  );
}
