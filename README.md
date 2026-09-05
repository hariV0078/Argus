## ARGUS
Single-pass drone video to georeferenced 3D model pipeline. Submits to a FastAPI server, processes via COLMAP + AI segmentation, and serves outputs for mobile/web visualization.

**Built for:** National Technical Research Organisation · SIH 2026

---

## What it produces

| Output | Format | Description |
|--------|--------|-------------|
| `mesh/model.glb` | GLB | 3D mesh — mobile/web viewer ready |
| `mesh/model.obj` | OBJ | 3D mesh — Blender/MeshLab |
| `mesh/model.fbx` | FBX | 3D mesh — Unity/Unreal |
| `pointcloud/dense.ply` | PLY | 655K-point cloud (ECEF) |
| `pointcloud/dense_labelled.ply` | PLY | Semantic colour-coded point cloud |
| `geotiff/dsm.tif` | GeoTIFF | Digital surface model (UTM, ~750 MB) |

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
  -d '{"video_path": "data/raw/drone.MOV", "skip_ingestion": true, "utm_epsg": 32615, "auto_clean": true}'
```

### Check job status
```bash
curl http://localhost:8765/api/pipeline/jobs/{JOB_ID}
```

### Stream logs live
```bash
wscat -c ws://localhost:8765/ws/{JOB_ID}
```

### Download outputs
```bash
curl -OJ http://localhost:8765/api/outputs/download/mesh/model.glb
curl -OJ http://localhost:8765/api/outputs/download/pointcloud/dense_labelled.ply
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
| 18 frames (test dataset) | ~8 min |
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
  output/          final outputs served by API
tools/
  blender/         Blender 4.2 LTS portable (GLB/FBX export)
  sam2_weights/    SAM2 model weights
  yolo_weights/    YOLOv8 model weights
```

---

## Docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — pipeline and API reference
- [`TESTING.md`](TESTING.md) — backend API test commands
- [`FRONTEND.md`](FRONTEND.md) — mobile app spec (React Native + Expo)
