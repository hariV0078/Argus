import { GpsPoint } from '@/src/types/reconstruction';

function toNum(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pushPoint(out: GpsPoint[], lat: number, lon: number, alt?: number, t?: number) {
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
  out.push({ lat, lon, alt, t });
}

export function parseTelemetryText(text: string): GpsPoint[] {
  const points: GpsPoint[] = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const dji = line.match(
      /latitude[:\s]+(-?\d+(?:\.\d+)?).+longitude[:\s]+(-?\d+(?:\.\d+)?)(?:.+?(?:abs_alt|altitude|alt)[:\s]+(-?\d+(?:\.\d+)?))?/i,
    );
    if (dji) {
      const lat = toNum(dji[1]);
      const lon = toNum(dji[2]);
      const alt = dji[3] ? toNum(dji[3]) : undefined;
      if (lat !== null && lon !== null) pushPoint(points, lat, lon, alt ?? undefined);
      continue;
    }

    const gpsFn = line.match(/GPS\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*(-?\d+(?:\.\d+)?))?/i);
    if (gpsFn) {
      const lat = toNum(gpsFn[1]);
      const lon = toNum(gpsFn[2]);
      const alt = gpsFn[3] ? toNum(gpsFn[3]) : undefined;
      if (lat !== null && lon !== null) pushPoint(points, lat, lon, alt ?? undefined);
      continue;
    }

    const csv = line.split(/[,;\t]/).map((p) => p.trim());
    if (csv.length >= 2 && !/lat/i.test(csv[0])) {
      const lat = toNum(csv[0]);
      const lon = toNum(csv[1]);
      const alt = csv[2] ? toNum(csv[2]) : undefined;
      if (lat !== null && lon !== null) pushPoint(points, lat, lon, alt ?? undefined);
    }
  }

  return points;
}

export const DEMO_TELEMETRY = `1
00:00:00,000 --> 00:00:01,000
GPS(13.08270,80.27070,86.2)
2
00:00:01,000 --> 00:00:02,000
GPS(13.08290,80.27110,87.0)
3
00:00:02,000 --> 00:00:03,000
GPS(13.08320,80.27155,88.4)
4
00:00:03,000 --> 00:00:04,000
latitude: 13.08355 longitude: 80.27200 abs_alt: 90.1
5
00:00:04,000 --> 00:00:05,000
13.08390,80.27240,91.5
`;

export function summarizeGps(points: GpsPoint[]) {
  if (!points.length) {
    return { gpsAvailable: false, altitudeAvailable: false, first: undefined as GpsPoint | undefined };
  }
  return {
    gpsAvailable: true,
    altitudeAvailable: points.some((p) => typeof p.alt === 'number'),
    first: points[0],
  };
}
