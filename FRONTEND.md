# Mobile Frontend — 3D Reconstruction Viewer

React Native app (Expo) that connects to the FastAPI backend, submits drone jobs, and visualizes the 3D outputs on-device.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **Expo (React Native)** | iOS + Android from one codebase |
| 3D viewer | **expo-gl + three.js** or **@google/model-viewer** (WebView) | GLB/OBJ rendering |
| Point cloud | **three.js `BufferGeometry`** | Render PLY as coloured point cloud |
| HTTP | `fetch` / `axios` | Job polling |
| WebSocket | `WebSocket` (native) | Live log stream |
| Maps | **react-native-maps** | GeoTIFF bounds overlay |

---

## Screens

```
App
├── HomeScreen        — server config + connect
├── JobsScreen        — list jobs, submit new job
│   └── JobDetailScreen  — logs (WebSocket), progress
├── OutputsScreen     — list output files
│   ├── ModelViewer      — GLB / OBJ 3D view  ← main feature
│   ├── PointCloudViewer — PLY coloured point cloud
│   └── MapScreen        — GeoTIFF DSM bounds on map
└── SettingsScreen    — backend URL, UTM EPSG
```

---

## API Integration

### Base URL (user-configurable)
```
http://<server-ip>:8765
```

### Submit Job
```js
const res = await fetch(`${BASE}/api/pipeline/run`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    video_path: 'data/raw/drone.MOV',
    fps: 3.0,
    blur_threshold: 80,
    utm_epsg: 32644,
  }),
});
const job = await res.json(); // { id, status, ... }
```

### Poll Job
```js
const job = await fetch(`${BASE}/api/pipeline/jobs/${jobId}`).then(r => r.json());
// job.status: "pending" | "running" | "completed" | "failed" | "cancelled"
```

### WebSocket Logs
```js
const ws = new WebSocket(`ws://${SERVER_HOST}:8765/ws/${jobId}`);
ws.onmessage = ({ data }) => {
  if (data === '__DONE__') { ws.close(); return; }
  if (data === '__PING__') return;
  appendLog(data);
};
```

### List Outputs
```js
const outputs = await fetch(`${BASE}/api/outputs`).then(r => r.json());
// [{ category, filename, size_bytes, download_url, preview_url }, ...]
```

### Download URL (pass to viewer)
```
GET /api/outputs/download/mesh/model.glb
GET /api/outputs/download/pointcloud/dense_labelled.ply
```

---

## 3D Model Viewer (GLB)

### Option A — WebView + `<model-viewer>` (easiest)
```jsx
import { WebView } from 'react-native-webview';

const html = `
<!DOCTYPE html><html><body style="margin:0;background:#111">
  <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
  <model-viewer src="${glbUrl}" auto-rotate camera-controls
    style="width:100vw;height:100vh" shadow-intensity="1">
  </model-viewer>
</body></html>`;

<WebView source={{ html }} style={{ flex: 1 }} />
```

### Option B — expo-gl + three.js (full control)
```bash
npx expo install expo-gl expo-three three
```
```jsx
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// In GLView's onContextCreate:
const renderer = new Renderer({ gl });
const loader = new GLTFLoader();
loader.load(glbUrl, (gltf) => {
  scene.add(gltf.scene);
});
```

**Recommended: Option A for hackathon speed; Option B for full interactivity.**

---

## Point Cloud Viewer (PLY)

Download `dense_labelled.ply`, parse binary PLY client-side, render with three.js `Points`.

```js
// Fetch PLY binary
const buf = await fetch(`${BASE}/api/outputs/download/pointcloud/dense_labelled.ply`)
  .then(r => r.arrayBuffer());

// Parse (use three.js PLYLoader)
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
const loader = new PLYLoader();
const geometry = loader.parse(buf); // BufferGeometry with position + color

const material = new THREE.PointsMaterial({ vertexColors: true, size: 0.05 });
const points = new THREE.Points(geometry, material);
scene.add(points);
```

Semantic colours (matches backend label IDs):
```js
const LABEL_COLORS = [
  '#000000', // 0 background
  '#ff8000', // 1 building
  '#808080', // 2 road
  '#00c800', // 3 vegetation
  '#ff0000', // 4 vehicle
  '#8b5a2b', // 5 terrain
];
```

---

## GeoTIFF Map Overlay

Show DSM bounding box on a satellite map. Fetch bounds from the API (or parse from headers):

```js
// Get bounds from system info or store them after job completion
// Expected for Wisconsin test dataset:
// E: 575793–577508  N: 5187335–5189050  EPSG:32615

import MapView, { Overlay } from 'react-native-maps';

<MapView initialRegion={{ latitude: 46.84, longitude: -91.99, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
  <Overlay image={{ uri: `${BASE}/api/outputs/preview/geotiff/dsm.tif` }}
    bounds={[[46.82, -92.01], [46.86, -91.97]]} />
</MapView>
```

---

## Job Submission Flow

```
User picks video path (or uses default)
      ↓
POST /api/pipeline/run  →  get job_id
      ↓
Navigate to JobDetailScreen
      ↓
Open WebSocket /ws/{job_id}  →  stream logs into ScrollView
      ↓
Poll GET /api/pipeline/jobs/{job_id}  every 10s
      ↓
status === "completed"  →  show "View Outputs" button
      ↓
Navigate to OutputsScreen  →  pick GLB / PLY / GeoTIFF
```

---

## Project Setup

```bash
npx create-expo-app DroneViewer --template blank-typescript
cd DroneViewer

npx expo install expo-gl three expo-three react-native-webview
npx expo install react-native-maps
npm install axios

npx expo start
```

Environment config (`.env`):
```
EXPO_PUBLIC_BACKEND_URL=http://192.168.x.x:8765
```

---

## File Structure

```
DroneViewer/
├── src/
│   ├── api/          client.ts (fetch wrappers for all endpoints)
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── JobsScreen.tsx
│   │   ├── JobDetailScreen.tsx   ← WebSocket logs
│   │   ├── OutputsScreen.tsx
│   │   ├── ModelViewer.tsx       ← GLB via WebView
│   │   ├── PointCloudViewer.tsx  ← PLY via expo-gl
│   │   └── MapScreen.tsx         ← GeoTIFF overlay
│   ├── hooks/
│   │   ├── useJobPoller.ts       ← poll job status
│   │   └── useJobSocket.ts       ← WebSocket log stream
│   └── constants/colors.ts       ← label palette
├── app.json
└── .env
```
