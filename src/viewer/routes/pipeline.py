"""Pipeline management routes + WebSocket log streaming."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect

from ..jobs import Job, jobs
from ..runner import run_pipeline
from ..schemas import JobDetailOut, JobOut, JobStatus, PipelineRequest

router = APIRouter()
ws_router = APIRouter()


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
async def start_pipeline(req: PipelineRequest, background: BackgroundTasks):
    """Submit a pipeline job. Returns immediately with the job ID.
    Poll GET /api/pipeline/jobs/{id} or stream WS /ws/{id} for progress."""
    cfg = req.model_dump()
    job = jobs.create(cfg)
    background.add_task(run_pipeline, job, cfg)
    return _job_out(job)


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
