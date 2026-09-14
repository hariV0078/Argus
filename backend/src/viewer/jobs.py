from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from .logging_config import get_logger
from .schemas import JobStatus

logger = get_logger("jobs")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Job:
    id: str
    status: JobStatus
    phase: str
    created_at: str
    updated_at: str
    config: dict
    logs: list[str] = field(default_factory=list)
    error: Optional[str] = None
    outputs: dict = field(default_factory=dict)
    # subprocess handle — set while a phase is running
    process: Optional[object] = field(default=None, repr=False)
    # the asyncio Task running run_pipeline() for this job — cancel() needs
    # this to actually stop the coroutine, not just the current subprocess
    # (killing the subprocess alone leaves run_pipeline free to move on to
    # the next phase, which is exactly the bug this field fixes)
    task: Optional[asyncio.Task] = field(default=None, repr=False)
    # live WebSocket subscribers
    _subscribers: set[asyncio.Queue] = field(default_factory=set, repr=False)


class JobManager:
    def __init__(self):
        self._jobs: dict[str, Job] = {}

    def create(self, config: dict) -> Job:
        jid = str(uuid.uuid4())
        now = _now()
        job = Job(
            id=jid,
            status=JobStatus.PENDING,
            phase="queued",
            created_at=now,
            updated_at=now,
            config=config,
        )
        self._jobs[jid] = job
        logger.info(
            "Job %s created — video_path=%s skip_ingestion=%s utm_epsg=%s",
            jid, config.get("video_path"), config.get("skip_ingestion", False), config.get("utm_epsg"),
        )
        return job

    def get(self, jid: str) -> Optional[Job]:
        return self._jobs.get(jid)

    def all(self) -> list[Job]:
        return sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)

    async def log(self, job: Job, msg: str) -> None:
        job.logs.append(msg)
        job.updated_at = _now()
        # DEBUG only (file, not console) — durably records the full pipeline
        # transcript even if no one is watching the WebSocket at the time.
        logger.debug("[%s] %s", job.id[:8], msg)
        dead: set[asyncio.Queue] = set()
        for q in job._subscribers:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                dead.add(q)
        job._subscribers -= dead

    def subscribe(self, job: Job) -> asyncio.Queue:
        """Return a queue that receives all future log lines.
        Existing logs are replayed immediately so late joiners catch up."""
        q: asyncio.Queue = asyncio.Queue(maxsize=4000)
        for msg in job.logs:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                break
        job._subscribers.add(q)
        return q

    def unsubscribe(self, job: Job, q: asyncio.Queue) -> None:
        job._subscribers.discard(q)

    async def cancel(self, job: Job) -> None:
        if job.status not in (JobStatus.PENDING, JobStatus.RUNNING):
            return
        logger.info("Job %s cancelled (was %s, phase=%s)", job.id, job.status.value, job.phase)

        # Kill the OS-level subprocess doing the actual work right now...
        if job.process is not None:
            try:
                job.process.terminate()
            except ProcessLookupError:
                pass

        # ...AND cancel the coroutine driving it, or run_pipeline() simply
        # carries on to the next phase once the killed subprocess's await
        # returns (this was the actual bug: only the subprocess was ever
        # stopped, so a "cancelled" job kept running in the background).
        if job.task is not None and not job.task.done():
            job.task.cancel()

        job.status = JobStatus.CANCELLED
        job.updated_at = _now()
        await self.log(job, "Job cancelled by user")
        await self.log(job, "__DONE__")


# module-level singleton
jobs = JobManager()
