import { Stack, useLocalSearchParams } from 'expo-router';
import { ComponentType, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
import { colors, fonts } from '@/src/theme';

const WebView = RNWebView as unknown as ComponentType<any>;

// Sample/offline fallback only — used when no real boundsUrl is available
// (offline demo mode, or an older run from before dsm_bounds.json existed).
// Real runs report their own bounds via the backend's GeoTIFF sidecar
// (backend/src/export/exporter.py:ply_to_geotiff) instead of this.
const SAMPLE_BOUNDS = {
  epsg: 32615,
  sw: { lat: 46.82, lon: -92.01 },
  ne: { lat: 46.86, lon: -91.97 },
  center: { lat: 46.84, lon: -91.99 },
};

type Bounds = typeof SAMPLE_BOUNDS;

function mapHtml(bounds: Bounds) {
  const { sw, ne, center } = bounds;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    html,body,#map{margin:0;height:100%;background:#081210}
    .leaflet-container{background:#0c1c18}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${center.lat}, ${center.lon}], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    const bounds = [[${sw.lat}, ${sw.lon}], [${ne.lat}, ${ne.lon}]];
    L.rectangle(bounds, { color: '#2AD4A1', weight: 2, fillColor: '#2AD4A1', fillOpacity: 0.22 }).addTo(map);
    L.marker([${center.lat}, ${center.lon}]).addTo(map).bindPopup('DSM bounds').openPopup();
    map.fitBounds(bounds, { padding: [28, 28] });
  </script>
</body>
</html>`;
}

export default function MapScreen() {
  const { url, boundsUrl } = useLocalSearchParams<{ url?: string; boundsUrl?: string }>();
  const live = Boolean(url && /^https?:/i.test(String(url)));

  const [bounds, setBounds] = useState<Bounds>(SAMPLE_BOUNDS);
  const [loadedReal, setLoadedReal] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!boundsUrl) return;
    let cancelled = false;
    fetch(String(boundsUrl))
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
    <View style={styles.wrap}>
      <Stack.Screen
        options={{ title: 'DSM map', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.signal }}
      />
      <WebView
        key={loadedReal ? 'real' : 'sample'}
        style={styles.map}
        originWhitelist={['*']}
        source={{ html: mapHtml(bounds) }}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
      />
      <View style={styles.hud}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{metaLine}</Text>
        {err ? <Text style={styles.hint}>{err} — showing sample bounds instead</Text> : null}
        {!err && !loadedReal && live ? (
          <Text style={styles.hint}>This run has no dsm_bounds.json — re-export or re-run to get real bounds.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  map: { flex: 1, backgroundColor: colors.bg },
  hud: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: 'rgba(8,18,16,0.88)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  meta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 4 },
  hint: { color: colors.dim, fontFamily: fonts.regular, fontSize: 12, marginTop: 4 },
});
