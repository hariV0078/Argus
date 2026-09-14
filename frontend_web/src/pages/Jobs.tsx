import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoAddCircle, IoAlertCircle, IoCheckmarkCircle, IoLayersOutline, IoPulse } from 'react-icons/io5';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { PipelineJobCard, isActiveJob } from '../components/jobs/PipelineJobCard';
import { useServerStore } from '../store/serverStore';
import type { PipelineJob } from '../api/types';
import './pages.css';

type Tab = 'processing' | 'completed' | 'failed';

function matches(job: PipelineJob, tab: Tab) {
  if (tab === 'completed') return job.status === 'completed';
  if (tab === 'failed') return job.status === 'failed' || job.status === 'cancelled';
  return isActiveJob(job);
}

const TABS: { id: Tab; icon: typeof IoPulse; label: string }[] = [
  { id: 'processing', icon: IoPulse, label: 'Processing' },
  { id: 'completed', icon: IoCheckmarkCircle, label: 'Completed' },
  { id: 'failed', icon: IoAlertCircle, label: 'Failed' },
];

export function Jobs() {
  const navigate = useNavigate();
  const jobs = useServerStore((s) => s.jobs);
  const connecting = useServerStore((s) => s.connecting);
  const [tab, setTab] = useState<Tab>('processing');

  useEffect(() => {
    void useServerStore.getState().refreshOutputs();
  }, []);

  const list = useMemo(() => jobs.filter((j) => matches(j, tab)), [jobs, tab]);

  return (
    <div>
      <div className="page-head">
        <h1 className="h-title">Jobs</h1>
      </div>
      <Button icon={<IoAddCircle size={18} />} style={{ marginBottom: 14 }} onClick={() => navigate('/new')}>
        Submit new job
      </Button>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {connecting && jobs.length === 0 ? (
        <Loader label="Loading jobs" />
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <IoLayersOutline size={26} color="var(--dim)" />
          </div>
          <span className="p-meta">No jobs in this category yet</span>
        </div>
      ) : (
        <div>
          {list.map((job) => (
            <PipelineJobCard key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
