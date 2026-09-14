## ARGUS — Backend

Single-pass drone video to georeferenced 3D model pipeline. Submits to a FastAPI server, processes via COLMAP + AI segmentation, and serves outputs for mobile/web visualization.

**Built for:** National Technical Research Organisation · SIH 2026

This is the reconstruction backend. The mobile client lives in [`../frontend`](../frontend) — see the [repo-root README](../README.md) for how the two run together.

---

## What it produces

| Output | Format | Description |
|--------|--------|-------------|
| `mesh/model.glb` | GLB | 3D mesh — mobile/web viewer ready |
| `mesh/model.obj` | OBJ | 3D mesh — Blender/MeshLab |
| `mesh/model.fbx` | FBX | 3D mesh — Unity/Unreal |
| `pointcloud/dense.ply` | PLY | ~550K-point cloud (ECEF) |
| `pointcloud/dense_labelled.ply` | PLY | Semantic colour-coded point cloud |
| `geotiff/dsm.tif` | GeoTIFF | Digital surface model (UTM, ~500 MB) |

---

## Hardware

- GPU: **RTX 5070 Laptop / 8 GB VRAM** (CUDA 12.8)
- OS: Ubuntu 22.04 / WSL2
- RAM: 32 GB recommended
- Disk: 50 GB free per run (SfM workspace is large)

EC2 equivalent: `g5.2xlarge` (A10G 24 GB, $0.37/hr spot)

---

## Setup

```bash
# 1. Create conda environment
conda create -n recon python=3.10 -y
conda activate recon

# 2. Install dependencies
pip install -r requirements.txt

# 3. Download weights
bash scripts/download_weights.sh

# 4. Verify setup
bash verify_setup.sh
# Expected: 27 passed, 0 failed
```

---

## Run

### Start the server
```bash
conda run -n recon python3 -m uvicorn src.viewer.server:app --host 0.0.0.0 --port 8765
```

### Start the server + public tunnel (for the mobile app)

Exposes the server at a fixed public URL, `https://sound-guiding-mammoth.ngrok-free.app`, so the phone doesn't need to be on the same Wi-Fi and WSL2's NAT is a non-issue:

```bash
cp .env.example .env            # once — fill in NGROK_AUTHTOKEN
conda run -n recon python3 scripts/start_ngrok.py
```

`NGROK_AUTHTOKEN` comes from https://dashboard.ngrok.com/get-started/your-authtoken and lives only in `.env` (gitignored) — it's never committed or hardcoded. `--no-server` runs just the tunnel if uvicorn is already running elsewhere.

### Upload a video from mobile, then submit
The app doesn't have filesystem access to the server, so it uploads bytes instead of typing a path:
```bash
curl -X POST http://localhost:8765/api/pipeline/upload -F "file=@drone_clip.mp4;type=video/mp4"
# -> {"video_path": "data/raw/drone_clip_ab12cd34.mp4", ...} — feed straight into /api/pipeline/run below
```

### Sample input already on the server (no upload needed)
```bash
curl http://localhost:8765/api/pipeline/samples
# -> includes the pre-extracted data/frames/ set with a ready-to-POST run_request
```

### Submit a job (video)
```bash
curl -X POST http://localhost:8765/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"video_path": "data/raw/drone.MOV", "fps": 3.0, "utm_epsg": 32644, "auto_clean": true}'
```

### Submit a job (pre-extracted frames)
```bash
curl -X POST http://localhost:8765/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"video_path": "data/raw/drone.MOV", "skip_ingestion": true, "utm_epsg": 32617, "auto_clean": true}'
```

### Submit a job (no GPS in the source footage)
```bash
curl -X POST http://localhost:8765/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"video_path": "data/raw/clip.mp4", "skip_georef": true, "auto_clean": true}'
```
Mesh/point cloud come out in local (non-georeferenced) coordinates; no
GeoTIFF DSM is produced (fundamentally needs real-world coordinates). Still
requires genuine camera translation between frames — a near-static hover
shot fails at SfM (`No good initial image pair found`) regardless of GPS.

### Check job status
```bash
curl http://localhost:8765/api/pipeline/jobs/{JOB_ID}
```

### Stream logs live
```bash
wscat -c ws://localhost:8765/ws/{JOB_ID}
```

### Download outputs
Outputs are grouped by run — list runs first to get a `job_id`:
```bash
curl http://localhost:8765/api/outputs | python3 -m json.tool
curl -OJ http://localhost:8765/api/outputs/download/{JOB_ID}/mesh/model.glb
curl -OJ http://localhost:8765/api/outputs/download/{JOB_ID}/pointcloud/dense_labelled.ply
```

API docs: **http://localhost:8765/docs**

---

## Pipeline

```
Video + GPS
  → Frame extraction + blur filter        (ffmpeg)
  → Dynamic masking                        (YOLOv8x-seg)
  → Structure from Motion                  (COLMAP GPU)
  → Dense reconstruction                   (patch-match stereo)
  → Mesh + point cloud + GeoTIFF export
  → Semantic segmentation                  (YOLO-World + SAM2)
  → 2D→3D label projection
```

Full details: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## Runtime (RTX 5070 Laptop, 8 GB VRAM)

| Input | Time |
|-------|------|
| 18 frames (early test dataset) | ~8 min |
| 87 frames @ 4000×3000 (current sample set, Toledo OH) | ~20–30 min |
| 50 frames | ~15–20 min |
| 100 frames @ 1080p | ~35–50 min |
| 10-min video @ 3 fps | ~60–90 min |

---

## Project structure

```
src/
  ingestion/       frame extraction, telemetry parsing, EXIF geotagging
  reconstruction/  COLMAP SfM + MVS + export (OBJ/GLB/FBX/LAS/GeoTIFF)
  segmentation/    dynamic masking, semantic segmentation, label projection
  viewer/          FastAPI server, job queue, WebSocket log stream
data/
  raw/             input video
  frames/          extracted + geotagged JPEGs
  sfm/             COLMAP workspace (auto-cleaned between runs)
  output/{job_id}/ final outputs served by API, one dir per run
tools/
  blender/         Blender 4.2 LTS portable (GLB/FBX export)
  sam2_weights/    SAM2 model weights
  yolo_weights/    YOLOv8 model weights
```

---

## Logging

Two destinations, set up once in `src/viewer/logging_config.py` and used
throughout `server.py`, `jobs.py`, `runner.py`, the routes, and
`scripts/start_ngrok.py`:

- **Console** — INFO+, human-readable. One line per HTTP request (method,
  path, status, timing) plus job lifecycle events. High-frequency polling
  endpoints (`GET /api/pipeline/jobs/{id}`, `/api/health`) log at DEBUG
  instead, so the console stays readable while a job is being watched.
- **`data/logs/backend.log`** — DEBUG+, rotating (5MB × 3 backups). Durably
  records everything the console shows *plus* every individual pipeline log
  line (the same text the app's WebSocket log stream sees), so a run can be
  inspected after the fact even if no one was connected to watch it live.

```bash
tail -f data/logs/backend.log
```

## Docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — pipeline and API reference
- [`TESTING.md`](TESTING.md) — backend API test commands
- [`FRONTEND.md`](FRONTEND.md) — mobile app spec (React Native + Expo)
- [`../DEMO.md`](../DEMO.md) — jury demo script (pre-demo checklist, live walkthrough, fallback plan)
