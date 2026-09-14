# Argus — Single-Pass Drone Video → Georeferenced 3D Model

SIH 2026 PS #17 (National Technical Research Organisation). Monorepo: a Python reconstruction backend, an Expo/React Native mobile client, and a React web client, kept as sibling folders so every half of the submission lives in one place.

```
SIH_26_Internal/
├── backend/       FastAPI + COLMAP + AI segmentation pipeline (Python)
├── frontend/      Argus mobile app — job submission, live logs, 3D viewer (Expo/React Native)
└── frontend_web/  Argus web app — the same client, in the browser (React + Vite + TypeScript)
```

- Backend details: [`backend/README.md`](backend/README.md) · [`backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md) · [`backend/TESTING.md`](backend/TESTING.md)
- Mobile frontend details: [`frontend/README.md`](frontend/README.md) · [`frontend/TESTING.md`](frontend/TESTING.md)
- Web frontend details: [`frontend_web/README.md`](frontend_web/README.md)
- Presenting to the jury: **[`DEMO.md`](DEMO.md)** — pre-demo checklist, live script, fallback plan

## Repository setup

Clone the repository and install each component independently:

```bash
git clone https://github.com/hariV0078/Argus.git
cd SIH_26_Internal

# Backend environment and dependencies
cd backend
conda env create -f environment.yml
conda activate recon
./setup.sh

# Mobile app
cd ../frontend
npm install

# Browser app
cd ../frontend_web
npm install
```

The backend, mobile app, and web app are intentionally separate projects. The
backend owns reconstruction and the API; both frontends consume that API. See
the component README files linked above for platform-specific requirements and
test commands.

### What is tracked

Application source, configuration, documentation, lockfiles, sample assets,
and `.env.example` files are intended to be committed. Local `.env` files,
`node_modules`, Python environments, downloaded model weights, and generated
reconstruction data under `backend/data/` are ignored by the root `.gitignore`.
Keep large source datasets and generated point clouds in external storage rather
than committing them to the application repository.

---

## How the two connect

```
Argus (phone, Expo Go)  ──HTTP/WS──►  FastAPI backend :8765  ──►  COLMAP + YOLO/SAM2
  New Scan / Jobs / Viewer                 src/viewer/server.py       src/{ingestion,reconstruction,segmentation}/
```

The app is a thin client — it submits jobs, polls/streams status, and renders whatever mesh/point-cloud/GeoTIFF the backend produces. It never runs reconstruction locally (it does ship an **offline demo mode** with a sample mesh, so the flow can be shown without a live backend).

Backend URL is not hardcoded — it's entered on the app's Home/Settings screen at runtime, or pre-filled at build time via `frontend/.env` (see `frontend/.env.example`).

`frontend_web/` is the same idea in a browser tab: same screens (Home, New Scan, Jobs, Outputs, mesh/point-cloud/map viewers), same REST + WebSocket API, same backend — **no backend changes were needed**, since CORS on the FastAPI app is already wide open. Run it with `cd frontend_web && npm install && npm run dev`, then set Backend URL on Home the same way. See [`frontend_web/README.md`](frontend_web/README.md).

## Run both

**1. Backend** (from `backend/`) — via the reserved ngrok tunnel (recommended, see below):
```bash
cp .env.example .env   # fill in NGROK_AUTHTOKEN, once
conda run -n recon python3 scripts/start_ngrok.py
```
This starts uvicorn **and** exposes it at the fixed public URL `https://sound-guiding-mammoth.ngrok-free.app` in one go. Plain local run (no tunnel):
```bash
conda run -n recon python3 -m uvicorn src.viewer.server:app --host 0.0.0.0 --port 8765
```
Full setup: [`backend/README.md`](backend/README.md#setup).

**2. Frontend** (from `frontend/`):
```bash
npm install
npx expo start
```
Scan the QR with Expo Go — with the ngrok tunnel running, the phone can be on **any** network, not just the backend host's Wi-Fi.

**3. Point the app at the backend.** On Home, set Backend URL to `https://sound-guiding-mammoth.ngrok-free.app` and tap Connect (this is also `frontend/.env.example`'s default). Skip this step entirely if `frontend/.env` already has it.

### ngrok tunnel

- Fixed public URL: **`https://sound-guiding-mammoth.ngrok-free.app`** → forwards to `localhost:8765`.
- Auth token lives in `backend/.env` (`NGROK_AUTHTOKEN`, gitignored) — never commit it. Get one at https://dashboard.ngrok.com/get-started/your-authtoken.
- `backend/scripts/start_ngrok.py` reads `backend/.env` and opens the tunnel via `pyngrok`; pass `--no-server` if uvicorn is already running separately.
- Free-tier ngrok shows an HTML warning page to browser-like requests; the app sends `ngrok-skip-browser-warning` on every call (`frontend/src/api/client.ts`) so this is transparent.

### LAN alternative (no tunnel)

Same-Wi-Fi only, and only if you'd rather not run ngrok:

**3′.** On Home, set Backend URL to `http://<workstation-lan-ip>:8765` and tap Connect.

> **WSL2 note:** this backend is developed under WSL2. The IP from `hostname -I` inside WSL2 is usually *not* reachable from a phone on the LAN (WSL2 NAT). Use the **Windows host's** LAN IP (`ipconfig`), ensure port 8765 is allowed through Windows Firewall / forwarded into WSL2, or enable WSL2 mirrored networking (Windows 11 23H2+) so the WSL2 and Windows IPs match. This is exactly what the ngrok tunnel above avoids.

### Logging

The backend logs to both the console (INFO+) and a rotating file at
`backend/data/logs/backend.log` (DEBUG+, includes every pipeline log line —
durable even if no one was watching the WebSocket at the time). One line per
HTTP request (method, path, status, timing) plus job lifecycle events
(created / phase start-finish / completed / failed / cancelled). See
`backend/src/viewer/logging_config.py`.

## API surface

See [`backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md#api-surface) for the full list; the frontend uses:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/pipeline/run` | Submit a job |
| `GET` | `/api/pipeline/jobs/{id}` | Job status |
| `WS` | `/ws/{id}` | Live log stream |
| `GET` | `/api/outputs` | List every run's outputs, grouped by job (mesh / point cloud / GeoTIFF) |
| `GET` | `/api/outputs/download/{job_id}/{cat}/{file}` | Download a file from one run |

## Status

- Backend: ingestion, reconstruction, and segmentation phases complete (see `backend`'s memory notes / phase log); viewer/API phase in progress.
- Mobile frontend: cloned from [Ashwinram005/Argus](https://github.com/Ashwinram005/Argus) — implements the mobile client spec that used to live at `backend/FRONTEND.md` (now superseded by this real app).
- Web frontend (`frontend_web/`): React + Vite port of the mobile client's screens, talking to the same backend API. No backend changes required.