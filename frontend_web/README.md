# Argus — Web

**Single-pass drone video → georeferenced 3D reconstruction, in the browser.**

The web counterpart to the [Argus mobile app](../frontend) — same backend, same
operator workflow (submit a flight, watch it process, inspect the model),
built with React + Vite + TypeScript instead of Expo/React Native. It talks
to the **same unmodified FastAPI backend** (`../backend`) over the same REST
+ WebSocket API; nothing on the server changed to support this client.

---

## Screens

| Screen | Route | Role |
| --- | --- | --- |
| Login | `/login` | Dummy operator sign-in (same demo credentials as mobile) |
| Home | `/home` | Backend URL + Connect, recent jobs, quick actions |
| New Scan | `/new` | Submit a job — sample inputs, file upload, or a server-side path |
| Jobs | `/jobs` | Processing / Completed / Failed job lists |
| Job detail | `/jobs/:jobId` | Live progress bar + streamed logs (WebSocket) |
| Outputs | `/outputs` | One card per run — 3D Mesh / Point Cloud / Map |
| Mesh viewer | `/outputs/model` | GLB textured mesh, three.js orbit viewer |
| Point cloud viewer | `/outputs/pointcloud` | Labelled PLY point cloud, three.js |
| Map | `/outputs/map` | DSM/GeoTIFF bounds over a Leaflet satellite map |
| Profile | `/profile` | Session + connection info, sign out |

Sidebar navigation on desktop, a bottom tab bar on narrow viewports.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | React 19, TypeScript, Vite |
| Routing | react-router-dom |
| State | Zustand (same store shape as the mobile app) |
| 3D | three.js (`WebGLRenderer`, `GLTFLoader`, `PLYLoader`, `OrbitControls`) |
| Map | Leaflet |
| Icons | react-icons (Ionicons set, matching the mobile app's icon language) |
| Networking | `fetch`, native `WebSocket` |

There is no build-time coupling to the backend beyond its URL — CORS on the
FastAPI app is already open (`allow_origins=["*"]`), so this client talks to
it directly from the browser.

---

## Getting started

```bash
cd frontend_web
npm install
npm run dev
```

Opens on `http://localhost:5173`. Sign in with the same demo credentials as
the mobile app:

```
Email:    ashwinram28102005@ntro.com
Password: Ashwin@28102005
```

On **Home**, set **Backend URL** to wherever the backend is reachable from
your browser (the ngrok tunnel, e.g. `https://sound-guiding-mammoth.ngrok-free.app`,
or `http://localhost:8765` if the backend runs on the same machine) and tap
**Connect**.

### Pre-filling the backend URL

Copy `.env.example` to `.env.local` (gitignored) to set a default so you
don't have to type it in every time:

```bash
cp .env.example .env.local
```

### Build

```bash
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serve the production build locally
```

---

## Notes

- **No local reconstruction.** Like the mobile app, this is a thin client —
  it submits jobs, polls/streams status, and renders whatever the backend
  produces. All COLMAP/YOLO/SAM2 work happens server-side.
- **Offline preview.** Without a reachable backend, Home/Outputs fall back to
  a small in-memory sample so the screens still render (see `serverStore.ts`,
  mirroring the mobile app's `mockDb`-based offline demo mode).
- **File upload** uses the browser's native `fetch` + `FormData` against
  `POST /api/pipeline/upload` — the same endpoint the mobile app's web build
  target already uses.
