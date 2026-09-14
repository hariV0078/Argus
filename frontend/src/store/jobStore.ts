import { create } from 'zustand';
import {
  DraftReconstruction,
  JobEvent,
  ReconstructionJob,
  SemanticLayer,
} from '@/src/types/reconstruction';
import {
  createReconstruction,
  getReconstruction,
  listReconstructions,
  markUploaded,
  markUploading,
  retryJob,
  subscribeToJob,
} from '@/src/services/api';

const emptyDraft = (): DraftReconstruction => ({
  name: '',
  video: null,
  gpsAvailable: false,
  imuAvailable: false,
  altitudeAvailable: false,
  cameraParametersAvailable: false,
  rtkPpkAvailable: false,
  gpsPoints: [],
  gpsSource: 'none',
  reconstructionMode: 'balanced',
  removeCars: true,
  removePeople: true,
  removeOther: true,
  semanticLayers: ['building', 'road', 'vegetation', 'terrain'],
});

type JobState = {
  jobs: ReconstructionJob[];
  activeJob: ReconstructionJob | null;
  draft: DraftReconstruction;
  loading: boolean;
  error: string | null;
  setDraft: (partial: Partial<DraftReconstruction>) => void;
  resetDraft: () => void;
  refreshJobs: () => Promise<void>;
  loadJob: (id: string) => Promise<ReconstructionJob>;
  applyEvent: (event: JobEvent) => void;
  startJob: () => Promise<string>;
  finishUpload: (jobId: string) => Promise<void>;
  beginUpload: (jobId: string) => Promise<void>;
  retry: (jobId: string) => Promise<void>;
};

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  activeJob: null,
  draft: emptyDraft(),
  loading: false,
  error: null,
  setDraft: (partial) => set({ draft: { ...get().draft, ...partial } }),
  resetDraft: () => set({ draft: emptyDraft() }),
  refreshJobs: async () => {
    set({ loading: true, error: null });
    try {
      const list = await listReconstructions();
      const current = get().activeJob;
      const latest = current ? list.find((j) => j.id === current.id) || current : list[0] || null;
      set({ jobs: list, activeJob: latest, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load jobs' });
    }
  },
  loadJob: async (id) => {
    const job = await getReconstruction(id);
    set({
      activeJob: job,
      jobs: get().jobs.some((j) => j.id === job.id)
        ? get().jobs.map((j) => (j.id === job.id ? job : j))
        : [job, ...get().jobs],
    });
    return job;
  },
  applyEvent: (event) => {
    const patch = {
      status: event.status,
      progress: event.progress,
      currentStage: event.currentStage,
      message: event.message,
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      activeJob:
        state.activeJob?.id === event.jobId ? { ...state.activeJob, ...patch } : state.activeJob,
      jobs: state.jobs.map((j) => (j.id === event.jobId ? { ...j, ...patch } : j)),
    }));
  },
  startJob: async () => {
    const draft = get().draft;
    if (!draft.video) throw new Error('No video selected');
    const name =
      draft.name.trim() ||
      draft.video.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
    const res = await createReconstruction(
      {
        name,
        reconstructionMode: draft.reconstructionMode,
        removeDynamicObjects: draft.removeCars || draft.removePeople || draft.removeOther,
        semanticLayers: draft.semanticLayers as SemanticLayer[],
      },
      {
        video: {
          fileName: draft.video.fileName,
          durationSeconds: draft.video.durationSeconds,
          fps: draft.video.fps,
          resolution: `${draft.video.width} × ${draft.video.height}`,
          sizeBytes: draft.video.sizeBytes,
          uri: draft.video.uri,
        },
        metadata: {
          gpsAvailable: draft.gpsAvailable,
          imuAvailable: draft.imuAvailable,
          altitudeAvailable: draft.altitudeAvailable,
          cameraParametersAvailable: draft.cameraParametersAvailable,
          rtkPpkAvailable: draft.rtkPpkAvailable,
          gpsPointCount: draft.gpsPoints.length || undefined,
          firstCoordinate: draft.gpsPoints[0]
            ? { lat: draft.gpsPoints[0].lat, lon: draft.gpsPoints[0].lon, alt: draft.gpsPoints[0].alt }
            : undefined,
        },
      },
    );
    const job = await getReconstruction(res.jobId);
    set({
      activeJob: job,
      jobs: [job, ...get().jobs.filter((j) => j.id !== job.id)],
    });
    return res.jobId;
  },
  beginUpload: async (jobId) => {
    await markUploading(jobId);
    const job = await getReconstruction(jobId);
    set({ activeJob: job });
  },
  finishUpload: async (jobId) => {
    await markUploaded(jobId);
    const job = await getReconstruction(jobId);
    set({ activeJob: job });
  },
  retry: async (jobId) => {
    const job = await retryJob(jobId);
    set({
      activeJob: job,
      jobs: get().jobs.map((j) => (j.id === job.id ? job : j)),
    });
  },
}));

export { emptyDraft };
