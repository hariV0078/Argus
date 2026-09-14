export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type RunPipelineRequest = {
  video_path: string;
  fps?: number;
  blur_threshold?: number;
  utm_epsg: number;
  skip_ingestion?: boolean;
  auto_clean?: boolean;
};

export type PipelineJob = {
  id: string;
  status: PipelineStatus;
  video_path?: string;
  fps?: number;
  blur_threshold?: number;
  utm_epsg?: number;
  progress?: number;
  message?: string;
};

export type OutputFile = {
  category: string;
  filename: string;
  size_bytes: number;
  download_url: string;
  preview_url: string;
};

// One pipeline run's outputs, grouped by category — the unit the Outputs
// screen renders as one "Run" card (3D Mesh / Point Cloud / Map).
export type RunOutputs = {
  job_id: string;
  created_at?: string | null;
  status?: string | null;
  mesh: OutputFile[];
  pointcloud: OutputFile[];
  geotiff: OutputFile[];
};

export type SampleDataset = {
  id: string;
  name: string;
  description: string;
  kind: 'frames' | 'video';
  frame_count?: number | null;
  video_path?: string | null;
  utm_epsg: number;
  run_request: RunPipelineRequest;
};

export type UploadResponse = {
  video_path: string;
  filename: string;
  size_bytes: number;
};
