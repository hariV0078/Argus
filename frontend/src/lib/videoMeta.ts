import * as FileSystem from 'expo-file-system/legacy';
import { VideoMeta } from '@/src/types/reconstruction';

function fileNameFromUri(uri: string, fallback = 'drone_flight.mp4') {
  try {
    const clean = decodeURIComponent(uri.split('?')[0]);
    const part = clean.split('/').pop();
    return part && part.includes('.') ? part : fallback;
  } catch {
    return fallback;
  }
}

function toSeconds(duration?: number | null) {
  if (!duration || duration < 0) return 0;
  return duration > 1000 ? duration / 1000 : duration;
}

export async function readVideoMeta(params: {
  uri: string;
  fileName?: string | null;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
}): Promise<VideoMeta> {
  let durationSeconds = toSeconds(params.durationMs);
  const width = params.width || 1920;
  const height = params.height || 1080;
  let sizeBytes = params.fileSize || 0;

  if (!sizeBytes) {
    try {
      const info = await FileSystem.getInfoAsync(params.uri);
      if (info.exists && 'size' in info && typeof info.size === 'number') {
        sizeBytes = info.size;
      }
    } catch {
      /* gallery URIs may not expose size */
    }
  }

  return {
    uri: params.uri,
    fileName: params.fileName || fileNameFromUri(params.uri),
    durationSeconds,
    fps: 30,
    width,
    height,
    sizeBytes,
  };
}

export function validateVideo(meta: VideoMeta): string | null {
  if (!meta.uri) return 'Video file is unreadable.';
  if (meta.durationSeconds > 0 && meta.durationSeconds < 3) {
    return 'Video is too short. Need more frames for reconstruction.';
  }
  if (meta.width && meta.width < 640) {
    return 'Resolution is too low. Use 1080p or 4K drone video.';
  }
  return null;
}
