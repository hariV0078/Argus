"""System health and hardware info."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter

from ..jobs import jobs
from ..schemas import JobStatus, SystemInfo

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _gpu_info() -> tuple[bool, Optional[str], Optional[float], Optional[float]]:
    try:
        import torch
        if not torch.cuda.is_available():
            return False, None, None, None
        name = torch.cuda.get_device_name(0)
        free_b, total_b = torch.cuda.mem_get_info(0)
        return True, name, round(free_b / 1e9, 2), round(total_b / 1e9, 2)
    except Exception:
        return False, None, None, None


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/system", response_model=SystemInfo)
def system_info():
    """Hardware and job stats."""
    gpu_ok, gpu_name, gpu_free, gpu_total = _gpu_info()

    usage = shutil.disk_usage(PROJECT_ROOT)
    all_jobs = jobs.all()
    counts = {s: sum(1 for j in all_jobs if j.status == s) for s in JobStatus}

    return SystemInfo(
        status="ok",
        gpu_available=gpu_ok,
        gpu_name=gpu_name,
        gpu_memory_free_gb=gpu_free,
        gpu_memory_total_gb=gpu_total,
        disk_free_gb=round(usage.free / 1e9, 2),
        disk_total_gb=round(usage.total / 1e9, 2),
        python_version=sys.version,
        jobs_total=len(all_jobs),
        jobs_running=counts[JobStatus.RUNNING],
        jobs_completed=counts[JobStatus.COMPLETED],
    )
