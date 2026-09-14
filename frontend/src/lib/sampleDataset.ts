import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { DEMO_TELEMETRY, parseTelemetryText, summarizeGps } from '@/src/lib/gps';
import { DraftReconstruction, VideoMeta } from '@/src/types/reconstruction';

export const SAMPLE_OUTPUT_JOB_ID = 'job_campus';

const REMOTE_VIDEO = 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4';

async function resolveSampleVideoUri(): Promise<{ uri: string; sizeBytes: number }> {
  try {
    const asset = Asset.fromModule(require('../../assets/sample-flight.mp4'));
    await asset.downloadAsync();
    if (asset.localUri) {
      return { uri: asset.localUri, sizeBytes: 575000 };
    }
  } catch {
    /* Expo Go may not bundle the mp4 */
  }

  const dest = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}sample_single_pass.mp4`;
  try {
    const existing = await FileSystem.getInfoAsync(dest);
    if (existing.exists) {
      const size = 'size' in existing && typeof existing.size === 'number' ? existing.size : 575000;
      return { uri: dest, sizeBytes: size };
    }
    const res = await FileSystem.downloadAsync(REMOTE_VIDEO, dest);
    return { uri: res.uri, sizeBytes: res.headers['Content-Length'] ? Number(res.headers['Content-Length']) : 575000 };
  } catch {
    return { uri: dest, sizeBytes: 575000 };
  }
}

export async function loadSampleInput(): Promise<{
  video: VideoMeta;
  draft: Partial<DraftReconstruction>;
}> {
  const { uri, sizeBytes } = await resolveSampleVideoUri();
  const points = parseTelemetryText(DEMO_TELEMETRY);
  const info = summarizeGps(points);

  const video: VideoMeta = {
    uri,
    fileName: 'sample_single_pass.mp4',
    durationSeconds: 42,
    fps: 30,
    width: 1920,
    height: 1080,
    sizeBytes: sizeBytes || 575000,
  };

  return {
    video,
    draft: {
      name: 'Sample coastal survey',
      video,
      gpsPoints: points,
      gpsAvailable: info.gpsAvailable,
      altitudeAvailable: info.altitudeAvailable,
      gpsSource: 'sidecar',
      imuAvailable: false,
      cameraParametersAvailable: false,
      rtkPpkAvailable: false,
    },
  };
}
