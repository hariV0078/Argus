from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from .schemas import JobStatus


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
        return job

    def get(self, jid: str) -> Optional[Job]:
        return self._jobs.get(jid)

    def all(self) -> list[Job]:
        return sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)

    async def log(self, job: Job, msg: str) -> None:
        job.logs.append(msg)
        job.updated_at = _now()
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
        if job.process is not None:
            try:
                job.process.terminate()
            except ProcessLookupError:
                pass
        job.status = JobStatus.CANCELLED
        job.updated_at = _now()
        await self.log(job, "Job cancelled by user")
        await self.log(job, "__DONE__")


# module-level singleton
jobs = JobManager()
