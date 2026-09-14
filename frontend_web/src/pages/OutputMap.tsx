import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IoArrowBack } from 'react-icons/io5';
import { NGROK_HEADERS } from '../api/client';
import { MapViewer, type Bounds } from '../components/viewers/MapViewer';
import './pages.css';

// Sample/offline fallback only — used when no real boundsUrl is available
// (offline demo mode, or an older run from before dsm_bounds.json existed).
// Real runs report their own bounds via the backend's GeoTIFF sidecar
// (backend/src/export/exporter.py:ply_to_geotiff) instead of this.
const SAMPLE_BOUNDS: Bounds = {
  epsg: 32615,
  sw: { lat: 46.82, lon: -92.01 },
  ne: { lat: 46.86, lon: -91.97 },
  center: { lat: 46.84, lon: -91.99 },
};

export function OutputMap() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const url = params.get('url') || undefined;
  const boundsUrl = params.get('boundsUrl') || undefined;
  const live = Boolean(url && /^https?:/i.test(url));

  const [bounds, setBounds] = useState<Bounds>(SAMPLE_BOUNDS);
  const [loadedReal, setLoadedReal] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!boundsUrl) return;
    let cancelled = false;
    // Explicit header, not just the URL's own ?ngrok-skip-browser-warning
    // query param — see NGROK_HEADERS' doc comment in api/client.ts.
    fetch(boundsUrl, { headers: NGROK_HEADERS })
      .then((res) => {
        if (!res.ok) throw new Error(`bounds fetch failed (${res.status})`);
        return res.json();
      })
      .then((data: Bounds) => {
        if (cancelled) return;
        if (!data?.center || !data?.sw || !data?.ne) throw new Error('malformed bounds response');
        setBounds(data);
        setLoadedReal(true);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load DSM bounds');
      });
    return () => {
      cancelled = true;
    };
  }, [boundsUrl]);

  const title = loadedReal ? 'Server GeoTIFF bounds' : live ? 'Server GeoTIFF (bounds unavailable)' : 'Sample DSM bounds';
  const metaLine = `${bounds.sw.lat.toFixed(4)}N, ${Math.abs(bounds.sw.lon).toFixed(4)}W → ${bounds.ne.lat.toFixed(4)}N, ${Math.abs(bounds.ne.lon).toFixed(4)}W · EPSG:${bounds.epsg}`;

  return (
    <div className="viewer-page">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--signal)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: 0, fontWeight: 600 }}>
        <IoArrowBack size={16} /> DSM map
      </button>
      <div className="viewer-wrap">
        <MapViewer bounds={bounds} />
        <div className="map-hud">
          <div className="map-hud-title">{title}</div>
          <div className="map-hud-meta">{metaLine}</div>
          {err ? <div className="map-hud-hint">{err} — showing sample bounds instead</div> : null}
          {!err && !loadedReal && live ? (
            <div className="map-hud-hint">This run has no dsm_bounds.json — re-export or re-run to get real bounds.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
