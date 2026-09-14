import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoAdd, IoChevronForward, IoCubeOutline, IoEyeOutline, IoSync } from 'react-icons/io5';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { ProgressBar } from '../components/ui/ProgressBar';
import { PipelineJobCard, isActiveJob } from '../components/jobs/PipelineJobCard';
import { greeting } from '../lib/format';
import { useAuthStore } from '../store/authStore';
import { useServerStore } from '../store/serverStore';
import './pages.css';

export function Home() {
  const navigate = useNavigate();
  const name = useAuthStore((s) => s.name);
  const jobs = useServerStore((s) => s.jobs);
  const backendUrl = useServerStore((s) => s.backendUrl);
  const connected = useServerStore((s) => s.connected);
  const connecting = useServerStore((s) => s.connecting);
  const serverError = useServerStore((s) => s.error);
  const setBackendUrl = useServerStore((s) => s.setBackendUrl);
  const connect = useServerStore((s) => s.connect);
  const refreshOutputs = useServerStore((s) => s.refreshOutputs);

  useEffect(() => {
    void refreshOutputs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = jobs.find(isActiveJob);
  const recent = jobs.filter((j) => !isActiveJob(j)).slice(0, 4);

  return (
    <div className="home-grid">
      <div className="page-head">
        <h1 className="h-title">
          {greeting()}, {name || 'Operator'}
        </h1>
        <p className="p-body" style={{ marginTop: 4 }}>
          Drone photogrammetry & 3D mesh reconstruction platform
        </p>
      </div>

      <Card>
        <div className="section-row">
          <span className="section-label">Server Telemetry</span>
          <span className="status-pill">
            <span
              className="status-dot"
              style={{
                background: connected ? 'var(--green)' : 'var(--red)',
                color: connected ? 'var(--green)' : 'var(--red)',
              }}
            />
            {connected ? 'Pipeline Online' : 'Local Sandbox Mode'}
          </span>
        </div>
        <Field
          label="Backend Server Endpoint"
          autoCapitalize="none"
          autoCorrect="off"
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
          placeholder="http://localhost:8765"
        />
        {serverError ? <p style={{ color: 'var(--red)', marginTop: 8, fontSize: 13 }}>{serverError}</p> : null}
        <Button loading={connecting} style={{ marginTop: 16 }} onClick={() => void connect()}>
          {connected ? 'Reconnect Endpoint' : 'Connect Pipeline Endpoint'}
        </Button>
      </Card>

      <button className="cta-card" onClick={() => navigate('/new')}>
        <div className="cta-row">
          <span className="cta-icon">
            <IoAdd size={24} />
          </span>
          <div style={{ flex: 1 }}>
            <div className="cta-title">New 3D Reconstruction</div>
            <div className="cta-sub">Upload aerial drone video to generate 3D meshes & maps</div>
          </div>
          <IoChevronForward size={22} color="#ffffff" />
        </div>
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Button variant="outline" icon={<IoCubeOutline size={18} />} onClick={() => navigate('/outputs')}>
          Browse Outputs
        </Button>
        <Button variant="ghost" icon={<IoEyeOutline size={18} />} onClick={() => navigate('/outputs/model')}>
          Interactive 3D Viewer
        </Button>
      </div>

      {active ? (
        <div>
          <div className="section-row">
            <span className="section-label">Pipeline Building In Progress</span>
            <IoSync size={14} color="var(--signal)" style={{ animation: 'spin 2s linear infinite' }} />
          </div>
          <Card variant="accent">
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{active.video_path || active.id}</div>
            <div style={{ marginTop: 14 }}>
              <ProgressBar value={active.progress ?? 8} />
            </div>
            <p className="p-body" style={{ marginTop: 12 }}>
              {active.message || active.status} · {Math.round(active.progress ?? 0)}%
            </p>
            <button
              onClick={() => navigate(`/jobs/${active.id}`)}
              style={{
                marginTop: 14,
                background: 'none',
                border: 'none',
                color: 'var(--signal)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                fontSize: 14,
              }}>
              Inspect Console Logs <IoChevronForward size={14} />
            </button>
          </Card>
        </div>
      ) : null}

      {recent.length ? (
        <div>
          <div className="section-row">
            <span className="section-label">Recent Reconstruction Builds</span>
          </div>
          <div className="mini-row">
            {recent.map((job) => (
              <div
                key={job.id}
                className="mini-card"
                onClick={() => (job.status === 'completed' ? navigate('/outputs') : navigate('/jobs'))}>
                <div
                  className="mini-dot"
                  style={{
                    background: job.status === 'completed' ? 'var(--signal)' : 'var(--amber)',
                    color: job.status === 'completed' ? 'var(--signal)' : 'var(--amber)',
                  }}
                />
                <div className="mini-name">{job.video_path || job.id}</div>
                <div className="mini-meta">{job.status === 'completed' ? 'Completed' : job.status}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {jobs.length ? (
        <div>
          <div className="section-row" style={{ marginTop: 10 }}>
            <span className="section-label">Job History</span>
          </div>
          {jobs.slice(0, 3).map((job) => (
            <PipelineJobCard key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
