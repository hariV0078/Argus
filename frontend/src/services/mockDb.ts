import { ReconstructionJob } from '@/src/types/reconstruction';

const now = new Date();
const iso = (daysAgo: number, hours = 10) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, 12, 0, 0);
  return d.toISOString();
};

export const MOCK_USER = {
  name: 'Ashwin',
  email: 'ashwinram28102005@ntro.com',
  org: 'National Technical Research Organisation',
  role: 'Field Operator',
};

export const jobs: ReconstructionJob[] = [
  {
    id: 'job_disaster',
    name: 'Disaster Area Survey',
    status: 'ODM_PROCESSING',
    progress: 72,
    currentStage: 'Feature Matching',
    message: 'Processing frame features',
    video: {
      fileName: 'disaster_zone_pass01.mp4',
      durationSeconds: 412,
      fps: 30,
      resolution: '3840 × 2160',
      sizeBytes: 3_200_000_000,
    },
    metadata: {
      gpsAvailable: true,
      imuAvailable: true,
      altitudeAvailable: true,
      cameraParametersAvailable: false,
      rtkPpkAvailable: false,
      gpsPointCount: 1842,
      firstCoordinate: { lat: 28.6139, lon: 77.209, alt: 142 },
    },
    metrics: {
      processingTimeSeconds: 498,
      targetProcessingTimeSeconds: 900,
      reconstructedArea: 18.4,
    },
    reconstructionMode: 'balanced',
    removeDynamicObjects: true,
    semanticLayers: ['building', 'road', 'vegetation', 'terrain'],
    createdAt: iso(0, 16),
    updatedAt: iso(0, 16),
  },
  {
    id: 'job_campus',
    name: 'Campus Survey',
    status: 'COMPLETED',
    progress: 100,
    currentStage: 'Export',
    message: 'Textured mesh ready',
    video: {
      fileName: 'campus_survey_sept.mp4',
      durationSeconds: 592,
      fps: 30,
      resolution: '3840 × 2160',
      sizeBytes: 4_100_000_000,
    },
    metadata: {
      gpsAvailable: true,
      imuAvailable: true,
      altitudeAvailable: true,
      cameraParametersAvailable: true,
      rtkPpkAvailable: false,
      gpsPointCount: 2700,
      firstCoordinate: { lat: 13.0827, lon: 80.2707, alt: 86 },
    },
    metrics: {
      processingTimeSeconds: 754,
      targetProcessingTimeSeconds: 900,
      reconstructedArea: 24.1,
      accuracy: 0.82,
    },
    outputs: {
      glbUrl: 'bundled://campus',
      objUrl: 'mock://Campus_Survey.obj',
      plyUrl: 'mock://Campus_Survey.ply',
      gltfUrl: 'mock://Campus_Survey.gltf',
      fbxUrl: 'mock://Campus_Survey.fbx',
      thumbnailUrl: '',
    },
    reconstructionMode: 'balanced',
    removeDynamicObjects: true,
    semanticLayers: ['building', 'road', 'vegetation', 'terrain'],
    createdAt: iso(1, 11),
    updatedAt: iso(1, 11),
  },
  {
    id: 'job_highway',
    name: 'Highway Segment',
    status: 'COMPLETED',
    progress: 100,
    currentStage: 'Export',
    message: 'Textured mesh ready',
    video: {
      fileName: 'nh48_segment.mp4',
      durationSeconds: 338,
      fps: 30,
      resolution: '1920 × 1080',
      sizeBytes: 1_400_000_000,
    },
    metadata: {
      gpsAvailable: true,
      imuAvailable: false,
      altitudeAvailable: true,
      gpsPointCount: 980,
      firstCoordinate: { lat: 12.9716, lon: 77.5946, alt: 920 },
    },
    metrics: {
      processingTimeSeconds: 612,
      targetProcessingTimeSeconds: 900,
      reconstructedArea: 11.6,
      accuracy: 0.94,
    },
    outputs: {
      glbUrl: 'bundled://highway',
      objUrl: 'mock://Highway_Segment.obj',
      plyUrl: 'mock://Highway_Segment.ply',
    },
    reconstructionMode: 'fast',
    removeDynamicObjects: true,
    semanticLayers: ['road', 'terrain', 'vegetation'],
    createdAt: iso(3, 9),
    updatedAt: iso(3, 9),
  },
  {
    id: 'job_night',
    name: 'Night Recon',
    status: 'FAILED',
    progress: 41,
    currentStage: 'Dense Reconstruction',
    message: 'Insufficient image overlap or unavailable compute.',
    video: {
      fileName: 'night_recon_01.mp4',
      durationSeconds: 188,
      fps: 24,
      resolution: '1920 × 1080',
      sizeBytes: 860_000_000,
    },
    metadata: {
      gpsAvailable: false,
      imuAvailable: false,
      altitudeAvailable: false,
    },
    reconstructionMode: 'maximum',
    removeDynamicObjects: true,
    semanticLayers: ['building', 'terrain'],
    createdAt: iso(4, 21),
    updatedAt: iso(4, 21),
  },
];

export function findJob(id: string) {
  return jobs.find((j) => j.id === id);
}

export function upsertJob(job: ReconstructionJob) {
  const i = jobs.findIndex((j) => j.id === job.id);
  if (i >= 0) jobs[i] = job;
  else jobs.unshift(job);
  return job;
}
