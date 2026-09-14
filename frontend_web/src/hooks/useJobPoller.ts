import { useEffect, useRef, useState } from 'react';
import { getPipelineJob, normalizeStatus } from '../api/client';
import type { PipelineJob } from '../api/types';
import { useServerStore } from '../store/serverStore';

export function useJobPoller(jobId?: string, intervalMs = 10000) {
  const connected = useServerStore((s) => s.connected);
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId || !connected) return;

    const tick = async () => {
      try {
        const next = await getPipelineJob(jobId);
        setJob({ ...next, status: normalizeStatus(next.status) });
        setError(null);
        if (next.status === 'completed' || next.status === 'failed' || next.status === 'cancelled') {
          if (timer.current) clearInterval(timer.current);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Poll failed');
      }
    };

    void tick();
    timer.current = setInterval(tick, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [jobId, connected, intervalMs]);

  return { job, error };
}
