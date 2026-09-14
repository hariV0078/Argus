import { getBackendUrl } from './baseUrl';
import type {
  OutputFile,
  PipelineJob,
  PipelineStatus,
  RunOutputs,
  RunPipelineRequest,
  SampleDataset,
  UploadResponse,
} from './types';

function base() {
  return getBackendUrl().replace(/\/$/, '');
}

function wsBase() {
  return base().replace(/^http/, 'ws');
}

// Free ngrok domains show an HTML interstitial to requests that look like a
// browser navigation. This header (any value) makes ngrok skip it so JSON
// API calls go straight through. Harmless against a non-ngrok backend.
// Exported so anything that fetches a backend URL directly (the three.js
// mesh/point-cloud viewers, the DSM-bounds fetch) can attach the same header
// — the `?ngrok-skip-browser-warning=true` query param on those URLs exists
// only for consumers that fetch the resource themselves with no header
// control (e.g. an <img>/tile loader); a JS `fetch()` we write ourselves
// should always send the real header instead of relying on the query param,
// which free-tier ngrok does not reliably honor for XHR/fetch — without it,
// ngrok serves its HTML warning interstitial in place of the real response,
// and since that page has no CORS headers, the browser reports it as a CORS
// failure rather than a 200-with-wrong-content-type.
export const NGROK_HEADERS = { 'ngrok-skip-browser-warning': 'true' };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...NGROK_HEADERS, ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API ${res.status}`);
  }
  return res.json();
}

function friendlyNetworkError(e: unknown): Error {
  const raw = e instanceof Error ? e.message : String(e);
  if (/Failed to fetch|NetworkError|ECONNREFUSED|timed out|Timeout|abort/i.test(raw)) {
    return new Error('Server is not running or unreachable. Start the backend, or check the URL.');
  }
  return e instanceof Error ? e : new Error(raw);
}

export async function connectBackend(): Promise<boolean> {
  const url = base();
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error('Enter the backend server URL first, e.g. http://localhost:8765');
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${url}/api/outputs`, { method: 'GET', headers: NGROK_HEADERS, signal: ctrl.signal });
    return res.ok;
  } catch (e) {
    throw friendlyNetworkError(e);
  } finally {
    clearTimeout(t);
  }
}

export async function runPipeline(body: RunPipelineRequest): Promise<PipelineJob> {
  return json<PipelineJob>('/api/pipeline/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getPipelineJob(jobId: string): Promise<PipelineJob> {
  return json<PipelineJob>(`/api/pipeline/jobs/${jobId}`);
}

// Backend shape: { total, runs: [{ job_id, created_at, status, mesh: [{name,
// category, size_bytes, ...}], pointcloud: [...], geotiff: [...] }] } — one
// entry per pipeline run, each with its own output directory (data/output/{job_id}/).
// download_url/preview_url in the raw response are server-relative with no
// ngrok header/param, so they're rebuilt here via outputDownloadUrl/outputPreviewUrl.
type RawOutputFile = { name: string; category: string; size_bytes: number };
type RawRun = {
  job_id: string;
  created_at?: string | null;
  status?: string | null;
  mesh: RawOutputFile[];
  pointcloud: RawOutputFile[];
  geotiff: RawOutputFile[];
};

function mapFile(jobId: string, category: string, f: RawOutputFile): OutputFile {
  return {
    category,
    filename: f.name,
    size_bytes: f.size_bytes,
    download_url: outputDownloadUrl(jobId, category, f.name),
    preview_url: outputPreviewUrl(jobId, category, f.name),
  };
}

export async function listOutputRuns(): Promise<RunOutputs[]> {
  const data = await json<{ total: number; runs: RawRun[] }>('/api/outputs');
  return (data.runs || []).map((r) => ({
    job_id: r.job_id,
    created_at: r.created_at,
    status: r.status,
    mesh: (r.mesh || []).map((f) => mapFile(r.job_id, 'mesh', f)),
    pointcloud: (r.pointcloud || []).map((f) => mapFile(r.job_id, 'pointcloud', f)),
    geotiff: (r.geotiff || []).map((f) => mapFile(r.job_id, 'geotiff', f)),
  }));
}

export async function listSamples(): Promise<SampleDataset[]> {
  const data = await json<{ total: number; samples: SampleDataset[] }>('/api/pipeline/samples');
  return data.samples || [];
}

// Uploads a video picked in the browser to the backend (multipart/form-data),
// which stashes it under data/raw/ and hands back the server-side path to
// pass into runPipeline()'s video_path.
export async function uploadVideo(file: File): Promise<UploadResponse> {
  const url = `${base()}/api/pipeline/upload`;
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch(url, { method: 'POST', headers: NGROK_HEADERS, body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed (${res.status})`);
  }
  return res.json();
}

// These URLs are handed to <img>/three.js loaders that fetch the resource
// themselves, so a header can't be attached — use ngrok's query param form
// instead (same skip-interstitial effect).
export function outputDownloadUrl(jobId: string, category: string, filename: string) {
  return `${base()}/api/outputs/download/${jobId}/${category}/${filename}?ngrok-skip-browser-warning=true`;
}

export function outputPreviewUrl(jobId: string, category: string, filename: string) {
  return `${base()}/api/outputs/preview/${jobId}/${category}/${filename}?ngrok-skip-browser-warning=true`;
}

export function pipelineSocketUrl(jobId: string) {
  return `${wsBase()}/ws/${jobId}`;
}

export function normalizeStatus(status?: string): PipelineStatus {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'failed') return 'failed';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'pending') return 'pending';
  return 'running';
}
