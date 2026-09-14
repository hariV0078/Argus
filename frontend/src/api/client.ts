import { Platform } from 'react-native';
import { File, UploadType } from 'expo-file-system';
import { OutputFile, PipelineJob, PipelineStatus, RunOutputs, RunPipelineRequest, SampleDataset, UploadResponse } from '@/src/api/types';
import { getBackendUrl } from '@/src/api/baseUrl';

function base() {
  return getBackendUrl().replace(/\/$/, '');
}

function wsBase() {
  return base().replace(/^http/, 'ws');
}

// Free ngrok domains show an HTML interstitial to requests that look like a
// browser navigation. This header (any value) makes ngrok skip it so JSON
// API calls go straight through. Harmless against a non-ngrok backend.
const NGROK_HEADERS = { 'ngrok-skip-browser-warning': 'true' };

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
  if (/NoRouteToHost|ENETUNREACH|EHOSTUNREACH|failed to connect/i.test(raw)) {
    return new Error('Phone cannot reach that IP. Use the team laptop Wi‑Fi address, or skip Connect and use local preview.');
  }
  if (/Failed to fetch|Network request failed|ECONNREFUSED|timed out|Timeout/i.test(raw)) {
    return new Error('Server is not running or blocked. Start the FastAPI app on the laptop, or skip Connect.');
  }
  return e instanceof Error ? e : new Error(raw);
}

export async function connectBackend(): Promise<boolean> {
  const url = base();
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error('Enter the team server URL first, e.g. http://192.168.0.10:8765');
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
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

// Uploads a video picked on the phone to the backend (multipart/form-data),
// which stashes it under data/raw/ and hands back the server-side path to
// pass into runPipeline()'s video_path.
//
// Native (iOS/Android): goes through expo-file-system's native upload task
// instead of fetch+FormData. RN's JS FormData implementation for file parts
// (the `{uri, name, type}` object form) is fragile on the current Expo/RN
// stack — on iOS in particular it can throw "Unsupported FormData
// implementation" (see https://github.com/expo/expo/issues/33134). The
// native upload task does real multipart upload via URLSession/OkHttp and
// never touches JS FormData at all, sidestepping that class of bug entirely.
//
// Web: no native module for this, so it falls back to fetch+FormData, which
// is the browser's own spec-compliant implementation and doesn't hit the bug.
export async function uploadVideo(file: { uri: string; name: string; type?: string }): Promise<UploadResponse> {
  const url = `${base()}/api/pipeline/upload`;

  if (Platform.OS === 'web') {
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type || 'video/mp4' } as unknown as Blob);
    const res = await fetch(url, { method: 'POST', headers: NGROK_HEADERS, body: form });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Upload failed (${res.status})`);
    }
    return res.json();
  }

  const source = new File(file.uri);
  const task = source.createUploadTask(url, {
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: file.type || 'video/mp4',
    httpMethod: 'POST',
    headers: NGROK_HEADERS,
  });
  const result = await task.uploadAsync();
  if (!result) {
    throw new Error('Upload failed — no response from server');
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(result.body || `Upload failed (${result.status})`);
  }
  return JSON.parse(result.body);
}

// These URLs are handed to WebViews / three.js loaders that fetch the
// resource themselves, so a header can't be attached — use ngrok's query
// param form instead (same skip-interstitial effect).
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
