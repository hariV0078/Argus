export type JobStatus =
  | 'CREATED'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'VALIDATING'
  | 'VIDEO_PROCESSING'
  | 'FRAME_EXTRACTION'
  | 'TELEMETRY_EXTRACTION'
  | 'POSE_EXTRACTION'
  | 'DYNAMIC_OBJECT_DETECTION'
  | 'MASK_GENERATION'
  | 'SEMANTIC_SEGMENTATION'
  | 'RECONSTRUCTION_INITIALIZING'
  | 'ODM_PROCESSING'
  | 'COLMAP_PROCESSING'
  | 'OPENMVS_PROCESSING'
  | 'DENSE_RECONSTRUCTION'
  | 'MESH_GENERATION'
  | 'TEXTURE_GENERATION'
  | 'MODEL_CONVERSION'
  | 'EXPORT_GENERATION'
  | 'COMPLETED'
  | 'FAILED';

export type ReconstructionMode = 'fast' | 'balanced' | 'maximum';

export type SemanticLayer = 'building' | 'road' | 'vegetation' | 'terrain';

export interface ReconstructionJob {
  id: string;
  name: string;
  status: JobStatus;
  progress: number;
  currentStage: string;
  message?: string;
  video: {
    fileName: string;
    durationSeconds: number;
    fps: number;
    resolution: string;
    sizeBytes?: number;
    uri?: string;
  };
  metadata: {
    gpsAvailable: boolean;
    imuAvailable?: boolean;
    altitudeAvailable?: boolean;
    cameraParametersAvailable?: boolean;
    rtkPpkAvailable?: boolean;
    gpsPointCount?: number;
    firstCoordinate?: { lat: number; lon: number; alt?: number };
  };
  metrics?: {
    processingTimeSeconds: number;
    targetProcessingTimeSeconds: number;
    reconstructedArea?: number;
    accuracy?: number;
  };
  outputs?: {
    previewImage?: string;
    thumbnailUrl?: string;
    glbUrl?: string;
    objUrl?: string;
    plyUrl?: string;
    gltfUrl?: string;
    fbxUrl?: string;
  };
  reconstructionMode?: ReconstructionMode;
  removeDynamicObjects?: boolean;
  semanticLayers?: SemanticLayer[];
  createdAt: string;
  updatedAt: string;
}

export interface GpsPoint {
  lat: number;
  lon: number;
  alt?: number;
  t?: number;
}

export interface VideoMeta {
  uri: string;
  fileName: string;
  durationSeconds: number;
  fps: number;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface DraftReconstruction {
  name: string;
  video: VideoMeta | null;
  gpsAvailable: boolean;
  imuAvailable: boolean;
  altitudeAvailable: boolean;
  cameraParametersAvailable: boolean;
  rtkPpkAvailable: boolean;
  gpsPoints: GpsPoint[];
  gpsSource: 'none' | 'embedded' | 'sidecar' | 'skipped';
  reconstructionMode: ReconstructionMode;
  removeCars: boolean;
  removePeople: boolean;
  removeOther: boolean;
  semanticLayers: SemanticLayer[];
}

export interface CreateJobRequest {
  name: string;
  reconstructionMode: ReconstructionMode;
  removeDynamicObjects: boolean;
  semanticLayers: SemanticLayer[];
}

export interface CreateJobResponse {
  jobId: string;
  uploadUrl: string;
  status: JobStatus;
}

export interface JobOutputs {
  glbUrl?: string;
  objUrl?: string;
  plyUrl?: string;
  gltfUrl?: string;
  fbxUrl?: string;
  thumbnailUrl?: string;
}

export interface JobEvent {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentStage: string;
  message: string;
}
