import { create } from 'zustand';
import { getDefaultBackendUrl, setBackendUrlValue } from '../api/baseUrl';
import { connectBackend, getPipelineJob, listOutputRuns, normalizeStatus, runPipeline } from '../api/client';
import type { PipelineJob, RunOutputs, RunPipelineRequest } from '../api/types';
import { loadJSON, saveJSON } from '../lib/persist';

const DEFAULT_EPSG = 32644;
const CONFIG_KEY = 'argus.server';

type ServerConfig = { url: string; epsg: number };

type ServerState = {
  backendUrl: string;
  utmEpsg: number;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  jobs: PipelineJob[];
  runs: RunOutputs[];
  mockLogs: Record<string, string[]>;
  setBackendUrl: (backendUrl: string) => void;
  setUtmEpsg: (utmEpsg: number) => void;
  hydrate: () => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  submit: (body: RunPipelineRequest) => Promise<PipelineJob>;
  refreshJob: (jobId: string) => Promise<PipelineJob | null>;
  refreshOutputs: () => Promise<RunOutputs[]>;
  appendMockLog: (jobId: string, line: string) => void;
  upsertJob: (job: PipelineJob) => void;
};

const MOCK_LOGS = [
  'Queued reconstruction job',
  'Extracting frames at 3 fps',
  'Blur filter threshold 80',
  'Reading GPS / pose from telemetry',
  'Removing dynamic objects',
  'Dense reconstruction',
  'Writing textured mesh model.glb',
  'Writing dense_labelled.ply',
  'Job completed',
];

export const useServerStore = create<ServerState>((set, get) => ({
  backendUrl: getDefaultBackendUrl(),
  utmEpsg: DEFAULT_EPSG,
  connected: false,
  connecting: false,
  error: null,
  jobs: [],
  runs: [],
  mockLogs: {},
  setBackendUrl: (backendUrl) => {
    const url = setBackendUrlValue(backendUrl);
    set({ backendUrl: url, connected: false });
    saveJSON(CONFIG_KEY, { url, epsg: get().utmEpsg });
  },
  setUtmEpsg: (utmEpsg) => {
    set({ utmEpsg });
    saveJSON(CONFIG_KEY, { url: get().backendUrl, epsg: utmEpsg });
  },
  hydrate: () => {
    const saved = loadJSON<ServerConfig>(CONFIG_KEY);
    if (saved?.url) {
      setBackendUrlValue(saved.url);
      set({ backendUrl: saved.url, utmEpsg: saved.epsg || DEFAULT_EPSG });
    }
    if (!get().connected && get().runs.length === 0) {
      set({ runs: mockRuns() });
    }
    // Placeholder sample data above renders instantly; try a real connection
    // in the background so a reachable backend replaces it without the user
    // having to visit Home and tap Connect first.
    void get().connect();
  },
  connect: async () => {
    set({ connecting: true, error: null });
    try {
      const ok = await connectBackend();
      set({ connected: ok, connecting: false, error: ok ? null : 'Server did not accept /api/outputs' });
      if (ok) {
        try {
          const runs = await listOutputRuns();
          set({ runs });
        } catch {
          /* outputs optional at connect */
        }
      }
      return ok;
    } catch (e) {
      set({
        connected: false,
        connecting: false,
        error: e instanceof Error ? e.message : 'Could not reach server',
      });
      return false;
    }
  },
  disconnect: () => set({ connected: false }),
  submit: async (body) => {
    if (get().connected) {
      const job = await runPipeline(body);
      const normalized = { ...job, ...body, status: normalizeStatus(job.status) };
      get().upsertJob(normalized);
      return normalized;
    }

    const job: PipelineJob = {
      id: `pipe_${Date.now()}`,
      status: 'running',
      progress: 6,
      message: 'Running local preview pipeline',
      ...body,
    };
    get().upsertJob(job);
    simulateMock(job.id);
    return job;
  },
  refreshJob: async (jobId) => {
    if (!get().connected) {
      return get().jobs.find((j) => j.id === jobId) || null;
    }
    const job = await getPipelineJob(jobId);
    const normalized = { ...job, status: normalizeStatus(job.status) };
    get().upsertJob(normalized);
    return normalized;
  },
  refreshOutputs: async () => {
    // Always attempt a real fetch first, regardless of `connected` — opening
    // Outputs directly (a fresh page load) would otherwise silently render
    // fixed placeholder sample data with no indication it isn't live. Self-
    // heal `connected` on success so the rest of the UI reflects reality.
    try {
      const runs = await listOutputRuns();
      set({ runs, connected: true });
      return runs;
    } catch (e) {
      if (!get().connected) {
        const runs = mockRuns();
        set({ runs });
        return runs;
      }
      throw e;
    }
  },
  appendMockLog: (jobId, line) =>
    set((s) => ({
      mockLogs: { ...s.mockLogs, [jobId]: [line, ...(s.mockLogs[jobId] || [])].slice(0, 80) },
    })),
  upsertJob: (job) =>
    set((s) => ({
      jobs: s.jobs.some((j) => j.id === job.id)
        ? s.jobs.map((j) => (j.id === job.id ? { ...j, ...job } : j))
        : [job, ...s.jobs],
    })),
}));

function mockRuns(): RunOutputs[] {
  return [
    {
      job_id: 'sample',
      created_at: null,
      status: 'completed',
      mesh: [{ category: 'mesh', filename: 'model.glb', size_bytes: 2_400_000, download_url: '', preview_url: '' }],
      pointcloud: [
        { category: 'pointcloud', filename: 'dense_labelled.ply', size_bytes: 8_100_000, download_url: '', preview_url: '' },
      ],
      geotiff: [{ category: 'geotiff', filename: 'dsm.tif', size_bytes: 1_200_000, download_url: '', preview_url: '' }],
    },
  ];
}

function simulateMock(jobId: string) {
  let i = 0;
  const timer = setInterval(() => {
    const line = MOCK_LOGS[i];
    if (!line) {
      clearInterval(timer);
      return;
    }
    useServerStore.getState().appendMockLog(jobId, `${new Date().toLocaleTimeString()}  ${line}`);
    const progress = Math.min(100, Math.round(((i + 1) / MOCK_LOGS.length) * 100));
    const done = i === MOCK_LOGS.length - 1;
    useServerStore.getState().upsertJob({
      id: jobId,
      status: done ? 'completed' : 'running',
      progress,
      message: line,
    });
    i += 1;
  }, 900);
}
