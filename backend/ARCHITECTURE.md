# SIH 2026 PS #17 — Architecture

## Pipeline

```
drone.MOV + GPS
      │
   Ingestion  (src/ingestion/)
   • Extract frames @ 3 fps, blur-filter
   • Parse SRT/EXIF GPS → manifest.csv
   • Geotag EXIF on each frame
      │
   Masking  (src/segmentation/dynamic_masker.py)
   • YOLOv8x-seg → mask cars/people
   • Masks fed into COLMAP to suppress dynamic objects
      │
   Reconstruction  (src/reconstruction/)
   • COLMAP: feature extract → sequential match → incremental SfM
   • GPS alignment (Sim3d, ECEF EPSG:4978) — skippable (skip_georef=true)
     for footage with no GPS at all; mesh/point cloud then stay in local,
     non-georeferenced coordinates and the GeoTIFF step is skipped (a DSM
     fundamentally needs real-world coordinates). Ingestion's frame
     extraction also switches to pure time-interval spacing in that case
     (no GPS-distance dedup to fall back on). Still requires real camera
     translation between frames — SfM cannot triangulate a near-static
     hover shot regardless of GPS; see colmap_runner.py's "No good initial
     image pair found" failure mode.
   • Patch-match stereo → dense PLY (depth-map resolution scales down
     automatically for larger frame counts — stereo_fusion holding millions
     of points in RAM at once is a real OOM risk on a full-size run)
   • Poisson meshing (depth=10) → density-trim + bbox crop → OBJ/GLB/FBX
     (trim removes Poisson's extrapolated "cap" over unobserved regions —
     without it, an open aerial scene gets meshed as a closed watertight
     block. See colmap_runner.py:run_mesher for the full rationale.)
   • Rasterize → GeoTIFF DSM (UTM) — bounds computed from robust percentiles,
     not raw min/max (a handful of outlier points can otherwise blow up the
     grid to an unallocatable size)
   • Export → LAS point cloud; dense point cloud gets an outlier pass first
      │
   Semantics  (src/segmentation/)
   • YOLO-World + SAM2 → per-frame label maps (6 classes)
   • Project 2D labels → 3D via COLMAP tracks + KNN
   • Output: dense_labelled.ply
      │
   FastAPI Server  (src/viewer/)
   • Job queue, WebSocket log stream
   • File download / preview endpoints
```

## Outputs

Each run writes to its own directory, `data/output/{job_id}/`, so every
run's outputs are kept — nothing gets overwritten by the next job. This is
what lets the app show "Run 1", "Run 2", ... independently.

| File | Format | Size |
|------|--------|------|
| `mesh/model.glb` | GLB | ~55 MB (~1.1M verts / ~2.2M faces, 87-frame sample set) |
| `mesh/model.obj` | OBJ | ~200 MB |
| `mesh/model.fbx` | FBX | ~55 MB |
| `pointcloud/dense.ply` | PLY ECEF | ~72 MB (~2.76M points) |
| `pointcloud/dense_labelled.ply` | PLY + label | ~43 MB |
| `geotiff/dsm.tif` | GeoTIFF UTM | ~26 MB |

Mesh sizes above are with density-trimmed Poisson (depth=10) — see the
Reconstruction step above. Scales with scene complexity, point density, and
frame count — the current 87-frame sample set (real DJI survey, Toledo OH)
is considerably denser than the 18-frame set used earlier in development.
Dense point clouds also get a statistical outlier pass at export time
(`exporter.py:_clean_dense_ply`) — stereo_fusion routinely leaves a handful
of badly-triangulated stray points that would otherwise blow up the point
cloud's apparent bounding box.

## API Surface

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/pipeline/run` | Submit job |
| `POST` | `/api/pipeline/upload` | Upload a video (multipart) → `data/raw/`, returns `video_path` |
| `GET` | `/api/pipeline/samples` | List sample inputs already on the server (no upload needed) |
| `GET` | `/api/pipeline/jobs` | List jobs |
| `GET` | `/api/pipeline/jobs/{id}` | Job detail + logs |
| `DELETE` | `/api/pipeline/jobs/{id}` | Cancel job |
| `GET` | `/api/pipeline/status` | Status counts |
| `GET` | `/api/outputs` | List every run's outputs, grouped by job_id (mesh / pointcloud / geotiff) |
| `GET` | `/api/outputs/download/{job_id}/{cat}/{file}` | Download |
| `GET` | `/api/outputs/preview/{job_id}/{cat}/{file}` | Inline serve |
| `GET` | `/api/system` | GPU / disk info |
| `GET` | `/api/health` | Liveness |
| `POST` | `/api/cleanup` | Delete previous run artefacts |
| `WS` | `/ws/{job_id}` | Real-time logs |

## Key Tech

- **COLMAP 4.1.1** + **pycolmap ≥ 4.x** — SfM + MVS
- **pyproj / EPSG:4978** — GPS → ECEF alignment
- **SAM2 + YOLO-World** — zero-shot semantic masking
- **FastAPI + BackgroundTasks** — async job runner
- **RTX 5070 / CUDA 12.8** — GPU target

## Start Server

```bash
conda run -n recon python3 -m uvicorn src.viewer.server:app --host 0.0.0.0 --port 8765
```
