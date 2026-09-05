# Backend API Testing

Base URL: `http://localhost:8765`

Start server first:
```bash
conda run -n recon python3 -m uvicorn src.viewer.server:app --host 0.0.0.0 --port 8765
```

---

## Health

```bash
curl http://localhost:8765/api/health
```

## System Info

```bash
curl http://localhost:8765/api/system
```

## Submit Job

```bash
curl -X POST http://localhost:8765/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "video_path": "data/raw/drone.MOV",
    "fps": 3.0,
    "blur_threshold": 80,
    "utm_epsg": 32644
  }'
```

Skip ingestion (use existing frames):
```bash
curl -X POST http://localhost:8765/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "video_path": "data/raw/drone.MOV",
    "skip_ingestion": true,
    "utm_epsg": 32615
  }'
```

## List Jobs

```bash
curl http://localhost:8765/api/pipeline/jobs
```

## Job Status & Logs

```bash
curl http://localhost:8765/api/pipeline/jobs/{JOB_ID}
```

## Cancel Job

```bash
curl -X DELETE http://localhost:8765/api/pipeline/jobs/{JOB_ID}
```

## Status Summary

```bash
curl http://localhost:8765/api/pipeline/status
```

## List Outputs

```bash
curl http://localhost:8765/api/outputs
```

## Download File

```bash
curl -OJ http://localhost:8765/api/outputs/download/mesh/model.glb
curl -OJ http://localhost:8765/api/outputs/download/mesh/model.obj
curl -OJ http://localhost:8765/api/outputs/download/pointcloud/dense.ply
curl -OJ http://localhost:8765/api/outputs/download/pointcloud/dense_labelled.ply
curl -OJ http://localhost:8765/api/outputs/download/geotiff/dsm.tif
```

## Preview File (browser / mobile)

```
GET http://localhost:8765/api/outputs/preview/mesh/model.glb
GET http://localhost:8765/api/outputs/preview/pointcloud/dense_labelled.ply
```

## Real-time Log Stream (WebSocket)

```bash
# Install: npm install -g wscat
wscat -c ws://localhost:8765/ws/{JOB_ID}
# __PING__ = heartbeat  |  __DONE__ = finished
```

## Cleanup (free disk between runs)

Quick cleanup — removes SfM workspace + outputs only:
```bash
curl -X POST http://localhost:8765/api/cleanup
```

Full cleanup — also removes frames, masks, semantic maps:
```bash
curl -X POST http://localhost:8765/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{"frames": true, "masks": true, "semantic": true}'
```

Auto-clean before a run (recommended for repeated testing):
```bash
curl -X POST http://localhost:8765/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "video_path": "data/raw/drone.MOV",
    "fps": 3.0,
    "utm_epsg": 32615,
    "auto_clean": true
  }'
```

## Swagger UI

```
http://localhost:8765/docs
```
