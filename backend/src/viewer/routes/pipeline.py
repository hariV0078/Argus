"""Pipeline management routes + WebSocket log streaming."""

from __future__ import annotations

import asyncio
import csv
import math
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect

from ..jobs import Job, jobs
from ..logging_config import get_logger
from ..runner import run_pipeline
from ..schemas import (
    JobDetailOut,
    JobOut,
    JobStatus,
    PipelineRequest,
    SampleDataset,
    SamplesListResponse,
    UploadResponse,
)

router = APIRouter()
ws_router = APIRouter()
logger = get_logger("routes.pipeline")

PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
FRAMES_DIR = PROJECT_ROOT / "data" / "frames"
_VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi"}
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _job_out(job: Job) -> JobOut:
    return JobOut(
        id=job.id,
        status=job.status,
        phase=job.phase,
        created_at=job.created_at,
        updated_at=job.updated_at,
        error=job.error,
        outputs=job.outputs,
        log_count=len(job.logs),
    )


def _job_detail(job: Job) -> JobDetailOut:
    return JobDetailOut(
        **_job_out(job).model_dump(),
        logs=list(job.logs),
    )


# ── REST endpoints ────────────────────────────────────────────────────────────

@router.post("/run", response_model=JobOut, status_code=202)
async def start_pipeline(req: PipelineRequest):
    """Submit a pipeline job. Returns immediately with the job ID.
    Poll GET /api/pipeline/jobs/{id} or stream WS /ws/{id} for progress.

    Uses asyncio.create_task (not FastAPI's BackgroundTasks) so the running
    coroutine can be held on job.task — that handle is what makes
    DELETE /jobs/{id} able to actually stop the pipeline, not just the
    subprocess of whichever phase happens to be running at the moment.
    """
    cfg = req.model_dump()
    job = jobs.create(cfg)
    job.task = asyncio.create_task(run_pipeline(job, cfg))
    return _job_out(job)


@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_video(file: UploadFile = File(...)):
    """Upload a drone video from the mobile app and stash it under data/raw/.

    Returns the server-side path — pass it straight into PipelineRequest.video_path
    (or POST /api/pipeline/run) to start reconstruction on it.
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    original = file.filename or "upload.mp4"
    ext = Path(original).suffix.lower() or ".mp4"
    if ext not in _VIDEO_EXTS:
        logger.warning("Upload rejected: '%s' has unsupported extension '%s'", original, ext)
        raise HTTPException(400, f"Unsupported video type '{ext}'. Use one of {sorted(_VIDEO_EXTS)}")

    safe_stem = _SAFE_NAME.sub("_", Path(original).stem)[:80] or "upload"
    dest = RAW_DIR / f"{safe_stem}_{uuid.uuid4().hex[:8]}{ext}"

    size = 0
    with dest.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            out.write(chunk)
    await file.close()

    if size == 0:
        dest.unlink(missing_ok=True)
        logger.warning("Upload rejected: '%s' was empty", original)
        raise HTTPException(400, "Uploaded file is empty")

    rel_path = str(dest.relative_to(PROJECT_ROOT))
    logger.info("Upload received: '%s' -> %s (%.1f MB)", original, rel_path, size / 1e6)
    return UploadResponse(video_path=rel_path, filename=dest.name, size_bytes=size)


def _utm_epsg_for(lon: float, lat: float) -> int:
    """UTM EPSG for a WGS84 lon/lat — whatever sample dataset happens to be
    sitting in data/frames/, its manifest's own coordinates decide the zone.
    A hardcoded zone silently goes wrong the next time the sample dataset
    changes (it did once already)."""
    zone = int((lon + 180) / 6) + 1
    return (32600 if lat >= 0 else 32700) + zone


@router.get("/samples", response_model=SamplesListResponse)
def list_samples():
    """List sample inputs already available on the server — for the app's
    'Use sample dataset' action, so a demo doesn't depend on uploading a video."""
    samples: list[SampleDataset] = []

    # Pre-extracted frame set (this repo ships one: data/frames/ + manifest.csv)
    manifest = FRAMES_DIR / "manifest.csv"
    if manifest.exists():
        with manifest.open() as f:
            rows = list(csv.DictReader(f))
        frame_count = len(rows)

        def _valid_floats(key: str) -> list[float]:
            out = []
            for r in rows:
                try:
                    v = float(r.get(key, ""))
                except (TypeError, ValueError):
                    continue
                if not math.isnan(v):
                    out.append(v)
            return out

        lats, lons = _valid_floats("lat"), _valid_floats("lon")
        # No usable GPS (e.g. a skip_georef extraction sitting in data/frames/)
        # — fall back to a plausible default rather than crash; this sample
        # just won't be offered as georeferenced-accurate.
        utm_epsg = _utm_epsg_for(sum(lons) / len(lons), sum(lats) / len(lats)) if lats and lons else 32644
        if frame_count:
            samples.append(SampleDataset(
                id="frames-sample",
                name="Pre-extracted drone frames",
                description=f"{frame_count} geotagged JPEGs already on the server "
                            "(no video needed) — runs masking → reconstruction → semantics.",
                kind="frames",
                frame_count=frame_count,
                utm_epsg=utm_epsg,
                run_request={
                    "video_path": "data/raw/drone.MOV",
                    "skip_ingestion": True,
                    "utm_epsg": utm_epsg,
                    "auto_clean": True,
                },
            ))

    # Any raw video files already dropped on the server (e.g. by a previous upload)
    if RAW_DIR.exists():
        for f in sorted(RAW_DIR.iterdir()):
            if f.is_file() and f.suffix.lower() in _VIDEO_EXTS:
                rel = str(f.relative_to(PROJECT_ROOT))
                samples.append(SampleDataset(
                    id=f"video-{f.stem}",
                    name=f.name,
                    description=f"Video on server ({f.stat().st_size / 1e6:.1f} MB) — full pipeline from raw footage.",
                    kind="video",
                    video_path=rel,
                    utm_epsg=32644,
                    run_request={"video_path": rel, "fps": 3.0, "utm_epsg": 32644, "auto_clean": True},
                ))

    logger.info("Samples requested — %d available", len(samples))
    return SamplesListResponse(total=len(samples), samples=samples)


@router.get("/jobs", response_model=list[JobOut])
def list_jobs():
    """List all jobs, newest first."""
    return [_job_out(j) for j in jobs.all()]


@router.get("/jobs/{job_id}", response_model=JobDetailOut)
def get_job(job_id: str):
    """Get full job detail including all log lines."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return _job_detail(job)


@router.delete("/jobs/{job_id}", response_model=JobOut)
async def cancel_job(job_id: str):
    """Cancel a running or pending job."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status not in (JobStatus.PENDING, JobStatus.RUNNING):
        raise HTTPException(409, f"Cannot cancel job in status '{job.status}'")
    await jobs.cancel(job)
    return _job_out(job)


@router.get("/status", response_model=dict)
def pipeline_status():
    """Quick summary: how many jobs in each status."""
    all_jobs = jobs.all()
    counts: dict[str, int] = {s.value: 0 for s in JobStatus}
    for j in all_jobs:
        counts[j.status.value] += 1
    running = [_job_out(j) for j in all_jobs if j.status == JobStatus.RUNNING]
    return {"counts": counts, "running": running}


# ── WebSocket log stream ──────────────────────────────────────────────────────

@ws_router.websocket("/ws/{job_id}")
async def ws_logs(websocket: WebSocket, job_id: str):
    """Stream live log lines for *job_id*.

    Protocol:
    - Each message is a plain UTF-8 string (one log line).
    - ``__PING__`` — heartbeat (ignore or echo back).
    - ``__DONE__`` — pipeline finished; client should close.

    Late-joining clients receive buffered history first, then live lines.
    """
    job = jobs.get(job_id)
    if not job:
        await websocket.close(code=4004, reason="Job not found")
        return

    await websocket.accept()
    q = jobs.subscribe(job)

    try:
        while True:
            try:
                msg = await asyncio.wait_for(q.get(), timeout=20.0)
                await websocket.send_text(msg)
                if msg == "__DONE__":
                    break
            except asyncio.TimeoutError:
                await websocket.send_text("__PING__")
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        jobs.unsubscribe(job, q)
        try:
            await websocket.close()
        except Exception:
            pass
