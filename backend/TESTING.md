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

## Upload a Video (from mobile or curl)

```bash
curl -X POST http://localhost:8765/api/pipeline/upload \
  -F "file=@/path/to/drone_clip.mp4;type=video/mp4"
# -> {"video_path": "data/raw/drone_clip_ab12cd34.mp4", "filename": "...", "size_bytes": ...}
```
Feed `video_path` from the response straight into Submit Job below. Rejects non-video extensions and empty files (400).

## List Sample Inputs (already on the server — no upload needed)

```bash
curl http://localhost:8765/api/pipeline/samples
```
Always includes the pre-extracted `data/frames/` set (currently 87 geotagged JPEGs — Toledo, OH real DJI survey — if present; UTM zone is computed from the manifest's own coordinates, not hardcoded); also lists any video already sitting in `data/raw/` (including ones uploaded above). Each entry's `run_request` is a ready-to-POST body for Submit Job.

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
    "utm_epsg": 32617
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
Stops the current phase's subprocess **and** the pipeline coroutine itself
(`job.task.cancel()` in `src/viewer/jobs.py`) — status settles on `cancelled`
and stays there; it does not silently continue into the next phase. Verify
with a job mid-`Dynamic Masking`:
```bash
sleep 5 && curl http://localhost:8765/api/pipeline/jobs/{JOB_ID}
# status should still read "cancelled", not "running"/"completed"
```

## Status Summary

```bash
curl http://localhost:8765/api/pipeline/status
```

## List Outputs

Grouped by run — each `data/output/{job_id}/` directory is one entry:
```bash
curl http://localhost:8765/api/outputs | python3 -m json.tool
# -> {"total": N, "runs": [{"job_id": "...", "created_at": ..., "status": ...,
#      "mesh": [...], "pointcloud": [...], "geotiff": [...]}, ...]}
```
`created_at`/`status` come from the in-memory job registry and read `null`
for a run whose job predates the current server process (files on disk
persist across restarts; the job list doesn't) — that's expected, not a bug.

## Download File

Substitute a real `job_id` from the listing above:
```bash
curl -OJ http://localhost:8765/api/outputs/download/{JOB_ID}/mesh/model.glb
curl -OJ http://localhost:8765/api/outputs/download/{JOB_ID}/mesh/model.obj
curl -OJ http://localhost:8765/api/outputs/download/{JOB_ID}/pointcloud/dense.ply
curl -OJ http://localhost:8765/api/outputs/download/{JOB_ID}/pointcloud/dense_labelled.ply
curl -OJ http://localhost:8765/api/outputs/download/{JOB_ID}/geotiff/dsm.tif
```

## Preview File (browser / mobile)

```
GET http://localhost:8765/api/outputs/preview/{JOB_ID}/mesh/model.glb
GET http://localhost:8765/api/outputs/preview/{JOB_ID}/pointcloud/dense_labelled.ply
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
    "utm_epsg": 32617,
    "auto_clean": true
  }'
```

## Swagger UI

```
http://localhost:8765/docs
```
