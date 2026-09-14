import { useEffect, useState } from 'react';
import { pipelineSocketUrl } from '../api/client';
import { useServerStore } from '../store/serverStore';

export function useJobSocket(jobId?: string) {
  const connected = useServerStore((s) => s.connected);
  const [logs, setLogs] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!jobId || !connected) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(pipelineSocketUrl(jobId));
    } catch {
      return;
    }

    ws.onmessage = ({ data }) => {
      if (data === '__DONE__') {
        setDone(true);
        ws?.close();
        return;
      }
      if (data === '__PING__') return;
      setLogs((prev) => [`${new Date().toLocaleTimeString()}  ${String(data)}`, ...prev].slice(0, 80));
    };

    return () => {
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [jobId, connected]);

  return { logs, done };
}
