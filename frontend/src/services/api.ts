import {
  CreateJobRequest,
  CreateJobResponse,
  JobEvent,
  JobOutputs,
  JobStatus,
  ReconstructionJob,
} from '@/src/types/reconstruction';
import { findJob, jobs, upsertJob } from '@/src/services/mockDb';
import { useNotificationStore } from '@/src/store/notificationStore';

export const USE_MOCK = true;
export const TEAM_API_URL = 'https://api.example.com';

const STAGE_FLOW: { status: JobStatus; currentStage: string; message: string; progress: number }[] = [
  { status: 'VALIDATING', currentStage: 'Video Analysis', message: 'Validating container and metadata', progress: 8 },
  { status: 'VIDEO_PROCESSING', currentStage: 'Video Analysis', message: 'Reading stream headers', progress: 14 },
  { status: 'FRAME_EXTRACTION', currentStage: 'Frames Extracted', message: 'FFmpeg frame extraction', progress: 22 },
  { status: 'TELEMETRY_EXTRACTION', currentStage: 'GPS & Flight Pose Extracted', message: 'Parsing EXIF / SRT telemetry', progress: 30 },
  { status: 'POSE_EXTRACTION', currentStage: 'GPS & Flight Pose Extracted', message: 'Writing GPS / altitude / pose CSV', progress: 36 },
  { status: 'DYNAMIC_OBJECT_DETECTION', currentStage: 'Dynamic Objects Removed', message: 'YOLOv8-seg inference', progress: 44 },
  { status: 'MASK_GENERATION', currentStage: 'Dynamic Objects Removed', message: 'Generating inverted masks', progress: 50 },
  { status: 'SEMANTIC_SEGMENTATION', currentStage: 'Semantic Layers', message: 'Grounded-SAM buildings / roads / trees', progress: 56 },
  { status: 'RECONSTRUCTION_INITIALIZING', currentStage: '3D Reconstruction', message: 'Choosing OpenDroneMap path', progress: 60 },
  { status: 'ODM_PROCESSING', currentStage: '3D Reconstruction', message: 'Feature Matching', progress: 68 },
  { status: 'OPENMVS_PROCESSING', currentStage: 'Dense Point Cloud', message: 'OpenMVS densify', progress: 76 },
  { status: 'DENSE_RECONSTRUCTION', currentStage: 'Dense Point Cloud', message: 'Fusing stereo depth', progress: 82 },
  { status: 'MESH_GENERATION', currentStage: 'Mesh Generation', message: 'Building textured surface', progress: 88 },
  { status: 'TEXTURE_GENERATION', currentStage: 'Texture Generation', message: 'Baking photo textures', progress: 93 },
  { status: 'MODEL_CONVERSION', currentStage: 'Export', message: 'Blender headless GLB / FBX', progress: 97 },
  { status: 'EXPORT_GENERATION', currentStage: 'Export', message: 'Packaging outputs', progress: 99 },
  { status: 'COMPLETED', currentStage: 'Export', message: 'Textured mesh ready', progress: 100 },
];

const listeners = new Map<string, Set<(event: JobEvent) => void>>();
const timers = new Map<string, ReturnType<typeof setInterval>>();

function delay(ms = 80) {
  return new Promise((r) => setTimeout(r, ms));
}

async function live<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TEAM_API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API ${res.status}`);
  }
  return res.json();
}

function emit(job: ReconstructionJob) {
  const event: JobEvent = {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    currentStage: job.currentStage,
    message: job.message || '',
  };
  listeners.get(job.id)?.forEach((cb) => cb(event));
}

export function startMockPipeline(jobId: string) {
  if (timers.has(jobId)) return;
  const existing = findJob(jobId);
  let step = 0;
  if (existing) {
    const idx = STAGE_FLOW.findIndex((s) => s.status === existing.status);
    if (idx >= 0) step = idx;
  }
  const started = Date.now();
  const timer = setInterval(() => {
    const job = findJob(jobId);
    if (!job || job.status === 'FAILED' || job.status === 'COMPLETED') {
      clearInterval(timer);
      timers.delete(jobId);
      return;
    }
    const next = STAGE_FLOW[step];
    if (!next) {
      clearInterval(timer);
      timers.delete(jobId);
      return;
    }
    const updated: ReconstructionJob = {
      ...job,
      status: next.status,
      progress: next.progress,
      currentStage: next.currentStage,
      message: next.message,
      updatedAt: new Date().toISOString(),
      metrics: {
        processingTimeSeconds: Math.round((Date.now() - started) / 1000),
        targetProcessingTimeSeconds: 900,
        reconstructedArea: job.metrics?.reconstructedArea,
        accuracy: next.status === 'COMPLETED' ? 0.88 : job.metrics?.accuracy,
      },
      outputs:
        next.status === 'COMPLETED'
          ? {
              glbUrl: 'bundled://new',
              objUrl: `mock://${job.name.replace(/\s+/g, '_')}.obj`,
              plyUrl: `mock://${job.name.replace(/\s+/g, '_')}.ply`,
              gltfUrl: `mock://${job.name.replace(/\s+/g, '_')}.gltf`,
              fbxUrl: `mock://${job.name.replace(/\s+/g, '_')}.fbx`,
            }
          : job.outputs,
    };
    upsertJob(updated);
    emit(updated);
    step += 1;
    if (next.status === 'COMPLETED') {
      useNotificationStore.getState().push({
        title: `${job.name} ready`,
        body: '3D model is ready.',
        jobId,
      });
      clearInterval(timer);
      timers.delete(jobId);
    }
  }, 900);
  timers.set(jobId, timer);
}

export async function createReconstruction(body: CreateJobRequest, extras?: Partial<ReconstructionJob>): Promise<CreateJobResponse> {
  if (!USE_MOCK) {
    return live('/api/v1/reconstructions', { method: 'POST', body: JSON.stringify(body) });
  }
  await delay();
  const id = `job_${Date.now()}`;
  const job: ReconstructionJob = {
    id,
    name: body.name,
    status: 'CREATED',
    progress: 0,
    currentStage: 'Created',
    message: 'Job created. Waiting for upload.',
    video: extras?.video || {
      fileName: 'drone_flight.mp4',
      durationSeconds: 0,
      fps: 30,
      resolution: '—',
    },
    metadata: extras?.metadata || { gpsAvailable: false },
    reconstructionMode: body.reconstructionMode,
    removeDynamicObjects: body.removeDynamicObjects,
    semanticLayers: body.semanticLayers,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  upsertJob(job);
  return { jobId: id, uploadUrl: `mock://upload/${id}`, status: 'CREATED' };
}

export async function getReconstruction(jobId: string): Promise<ReconstructionJob> {
  if (!USE_MOCK) {
    return live(`/api/v1/reconstructions/${jobId}`);
  }
  await delay();
  const job = findJob(jobId);
  if (!job) throw new Error('Job not found');
  return { ...job };
}

export async function listReconstructions(): Promise<ReconstructionJob[]> {
  if (!USE_MOCK) {
    return live('/api/v1/reconstructions');
  }
  await delay();
  return jobs.map((j) => ({ ...j }));
}

export async function getOutputs(jobId: string): Promise<JobOutputs> {
  if (!USE_MOCK) {
    return live(`/api/v1/reconstructions/${jobId}/outputs`);
  }
  await delay();
  const job = findJob(jobId);
  if (!job) throw new Error('Job not found');
  return job.outputs || {};
}

export async function markUploading(jobId: string) {
  const job = findJob(jobId);
  if (!job) return;
  const updated = { ...job, status: 'UPLOADING' as const, progress: 4, currentStage: 'Upload', message: 'Uploading drone video', updatedAt: new Date().toISOString() };
  upsertJob(updated);
  emit(updated);
}

export async function markUploaded(jobId: string) {
  const job = findJob(jobId);
  if (!job) return;
  const updated = { ...job, status: 'UPLOADED' as const, progress: 6, currentStage: 'Upload Complete', message: 'Upload complete', updatedAt: new Date().toISOString() };
  upsertJob(updated);
  emit(updated);
  startMockPipeline(jobId);
}

export function subscribeToJob(jobId: string, cb: (event: JobEvent) => void) {
  if (!USE_MOCK) {
    const ws = new WebSocket(`${TEAM_API_URL.replace('https', 'wss').replace('http', 'ws')}/reconstructions/${jobId}/events`);
    ws.onmessage = (e) => {
      try {
        cb(JSON.parse(e.data));
      } catch {
        /* ignore malformed */
      }
    };
    return () => ws.close();
  }
  if (!listeners.has(jobId)) listeners.set(jobId, new Set());
  listeners.get(jobId)!.add(cb);
  const job = findJob(jobId);
  if (job) {
    cb({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      message: job.message || '',
    });
  }
  return () => {
    listeners.get(jobId)?.delete(cb);
  };
}

export async function retryJob(jobId: string): Promise<ReconstructionJob> {
  const job = findJob(jobId);
  if (!job) throw new Error('Job not found');
  const reset: ReconstructionJob = {
    ...job,
    status: 'UPLOADED',
    progress: 6,
    currentStage: 'Upload Complete',
    message: 'Retrying reconstruction',
    updatedAt: new Date().toISOString(),
  };
  upsertJob(reset);
  startMockPipeline(jobId);
  return reset;
}
