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
   • GPS alignment (Sim3d, ECEF EPSG:4978)
   • Patch-match stereo → dense PLY
   • Poisson meshing → OBJ/GLB/FBX
   • Rasterize → GeoTIFF DSM (UTM)
   • Export → LAS point cloud
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

| File | Format | Size |
|------|--------|------|
| `mesh/model.glb` | GLB | ~84 KB |
| `mesh/model.obj` | OBJ | ~240 KB |
| `mesh/model.fbx` | FBX | ~176 KB |
| `pointcloud/dense.ply` | PLY ECEF | ~16 MB |
| `pointcloud/dense_labelled.ply` | PLY + label | ~9 MB |
| `geotiff/dsm.tif` | GeoTIFF UTM | ~750 MB |

## API Surface

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/pipeline/run` | Submit job |
| `GET` | `/api/pipeline/jobs` | List jobs |
| `GET` | `/api/pipeline/jobs/{id}` | Job detail + logs |
| `DELETE` | `/api/pipeline/jobs/{id}` | Cancel job |
| `GET` | `/api/pipeline/status` | Status counts |
| `GET` | `/api/outputs` | List output files |
| `GET` | `/api/outputs/download/{cat}/{file}` | Download |
| `GET` | `/api/outputs/preview/{cat}/{file}` | Inline serve |
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
