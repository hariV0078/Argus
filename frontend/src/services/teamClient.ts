import { JobOutputs, JobStatus, ReconstructionJob } from '@/src/types/reconstruction';

export type TeamJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TeamJob = {
  id: string;
  status: TeamJobStatus;
  progress?: number;
  message?: string;
};

export type TeamOutput = {
  category?: string;
  filename: string;
  size_bytes?: number;
  download_url?: string;
  preview_url?: string;
};

export type RunPipelineBody = {
  video_path: string;
  fps: number;
  blur_threshold: number;
  utm_epsg: number;
};

export function normalizeBase(url: string) {
  return url.trim().replace(/\/+$/, '');
}

export function wsBase(httpUrl: string) {
  return normalizeBase(httpUrl).replace(/^https/i, 'wss').replace(/^http/i, 'ws');
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Server ${res.status}`);
  }
  return res.json();
}

export async function teamConnect(base: string): Promise<boolean> {
  const root = normalizeBase(base);
  const ctrl = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(5000) : undefined;
  try {
    const res = await fetch(`${root}/api/outputs`, { signal: ctrl });
    return res.ok;
  } catch {
    try {
      const res = await fetch(root, { signal: ctrl });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export async function teamRunPipeline(base: string, body: RunPipelineBody): Promise<TeamJob> {
  const res = await fetch(`${normalizeBase(base)}/api/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readJson<TeamJob>(res);
}

export async function teamGetJob(base: string, jobId: string): Promise<TeamJob> {
  const res = await fetch(`${normalizeBase(base)}/api/pipeline/jobs/${jobId}`);
  return readJson<TeamJob>(res);
}

export async function teamListOutputs(base: string): Promise<TeamOutput[]> {
  const res = await fetch(`${normalizeBase(base)}/api/outputs`);
  const data = await readJson<TeamOutput[] | { items?: TeamOutput[] }>(res);
  return Array.isArray(data) ? data : data.items || [];
}

export function teamDownloadUrl(base: string, category: string, filename: string) {
  return `${normalizeBase(base)}/api/outputs/download/${category}/${filename}`;
}

export function teamPreviewUrl(base: string, category: string, filename: string) {
  return `${normalizeBase(base)}/api/outputs/preview/${category}/${filename}`;
}

export function mapTeamStatus(status: TeamJobStatus): JobStatus {
  if (status === 'completed') return 'COMPLETED';
  if (status === 'failed' || status === 'cancelled') return 'FAILED';
  if (status === 'pending') return 'CREATED';
  return 'ODM_PROCESSING';
}

export function mapTeamProgress(job: TeamJob) {
  if (typeof job.progress === 'number') return job.progress;
  if (job.status === 'completed') return 100;
  if (job.status === 'failed' || job.status === 'cancelled') return 0;
  if (job.status === 'pending') return 4;
  return 55;
}

export function mergeTeamJob(local: ReconstructionJob | undefined, team: TeamJob): ReconstructionJob {
  const status = mapTeamStatus(team.status);
  const base: ReconstructionJob = local || {
    id: team.id,
    name: 'Pipeline job',
    status,
    progress: mapTeamProgress(team),
    currentStage: team.status,
    message: team.message || team.status,
    video: { fileName: 'drone.MOV', durationSeconds: 0, fps: 3, resolution: '—' },
    metadata: { gpsAvailable: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return {
    ...base,
    id: team.id,
    status,
    progress: mapTeamProgress(team),
    currentStage: team.status === 'running' ? '3D Reconstruction' : team.status,
    message: team.message || team.status,
    updatedAt: new Date().toISOString(),
  };
}

export function outputsFromTeam(base: string, files: TeamOutput[]): JobOutputs & { mapPreview?: string; items?: TeamOutput[] } {
  const abs = (item: TeamOutput, fallbackCat: string) => {
    if (item.download_url) {
      return item.download_url.startsWith('http') ? item.download_url : `${normalizeBase(base)}${item.download_url}`;
    }
    return teamDownloadUrl(base, item.category || fallbackCat, item.filename);
  };
  const glb = files.find((f) => /\.glb$/i.test(f.filename) || f.category === 'mesh');
  const ply = files.find((f) => /\.ply$/i.test(f.filename) || f.category === 'pointcloud');
  const tif = files.find((f) => /\.tif$/i.test(f.filename) || f.category === 'geotiff');
  return {
    glbUrl: glb ? abs(glb, 'mesh') : teamDownloadUrl(base, 'mesh', 'model.glb'),
    plyUrl: ply ? abs(ply, 'pointcloud') : teamDownloadUrl(base, 'pointcloud', 'dense_labelled.ply'),
    objUrl: files.find((f) => /\.obj$/i.test(f.filename))?.download_url,
    mapPreview: tif
      ? tif.preview_url || teamPreviewUrl(base, tif.category || 'geotiff', tif.filename)
      : teamPreviewUrl(base, 'geotiff', 'dsm.tif'),
    items: files,
  };
}

export function subscribeTeamLogs(base: string, jobId: string, onLine: (line: string) => void) {
  let ws: WebSocket | null = null;
  try {
    ws = new WebSocket(`${wsBase(base)}/ws/${jobId}`);
    ws.onmessage = ({ data }) => {
      if (data === '__DONE__') {
        ws?.close();
        return;
      }
      if (data === '__PING__') return;
      onLine(String(data));
    };
  } catch {
    /* WS optional if poll works */
  }
  return () => {
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
  };
}
