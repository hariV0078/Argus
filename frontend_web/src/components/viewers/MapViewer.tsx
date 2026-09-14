import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './viewers.css';

// Vite doesn't resolve Leaflet's default marker image paths automatically —
// point them at the CDN copies instead of shipping broken marker icons.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export type Bounds = {
  epsg: number;
  sw: { lat: number; lon: number };
  ne: { lat: number; lon: number };
  center: { lat: number; lon: number };
};

export function MapViewer({ bounds }: { bounds: Bounds }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const map = L.map(mount, { zoomControl: true }).setView([bounds.center.lat, bounds.center.lon], 16);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const rect: L.LatLngBoundsExpression = [
      [bounds.sw.lat, bounds.sw.lon],
      [bounds.ne.lat, bounds.ne.lon],
    ];
    L.rectangle(rect, { color: '#2AD4A1', weight: 2, fillColor: '#2AD4A1', fillOpacity: 0.22 }).addTo(map);
    L.marker([bounds.center.lat, bounds.center.lon]).addTo(map).bindPopup('DSM bounds').openPopup();
    map.fitBounds(rect, { padding: [28, 28] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [bounds]);

  return <div className="viewer-canvas" ref={mountRef} style={{ borderRadius: 'inherit' }} />;
}
