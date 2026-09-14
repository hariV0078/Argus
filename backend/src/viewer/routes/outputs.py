"""Serve and list 3D reconstruction output files, grouped by run (job).

Each pipeline run writes to its own data/output/{job_id}/ directory (see
runner.py), so this module lists/serves per-run rather than a single flat
"current outputs" set — that's what lets the app show "Run 1", "Run 2", ...
each with its own mesh / point cloud / DSM, instead of every run overwriting
the last one's files.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..jobs import jobs
from ..logging_config import get_logger
from ..schemas import OutputFileInfo, RunOutputs, RunsListResponse

router = APIRouter()
logger = get_logger("routes.outputs")

PROJECT_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_ROOT = PROJECT_ROOT / "data" / "output"

_CATEGORIES = ("mesh", "pointcloud", "geotiff")
_SAFE_SEGMENT = lambda s: "/" not in s and "\\" not in s and ".." not in s and s not in ("", ".")

_CONTENT_TYPES: dict[str, str] = {
    ".ply":  "application/octet-stream",
    ".las":  "application/octet-stream",
    ".obj":  "model/obj",
    ".mtl":  "model/mtl",
    ".glb":  "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".fbx":  "application/octet-stream",
    ".tif":  "image/tiff",
    ".tiff": "image/tiff",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".json": "application/json",
}


def _safe_path(job_id: str, category: str, filename: str) -> Path:
    """Resolve path and guard against traversal attacks."""
    if category not in _CATEGORIES:
        raise HTTPException(404, f"Unknown category '{category}'. Valid: {_CATEGORIES}")
    if not _SAFE_SEGMENT(job_id) or not _SAFE_SEGMENT(filename):
        raise HTTPException(400, "Invalid path segment")

    path = (OUTPUT_ROOT / job_id / category / filename).resolve()

    # Ensure resolved path stays inside the output root
    if not str(path).startswith(str(OUTPUT_ROOT.resolve())):
        raise HTTPException(400, "Path traversal detected")
    return path


def _file_info(job_id: str, category: str, f: Path) -> OutputFileInfo:
    return OutputFileInfo(
        name=f.name,
        category=category,
        size_bytes=f.stat().st_size,
        download_url=f"/api/outputs/download/{job_id}/{category}/{f.name}",
        preview_url=f"/api/outputs/preview/{job_id}/{category}/{f.name}",
    )


@router.get("", response_model=RunsListResponse)
@router.get("/", response_model=RunsListResponse, include_in_schema=False)
def list_outputs():
    """List every run's outputs, newest first, grouped by job (mesh / point
    cloud / geotiff). Scans disk directly — works even after a server
    restart, when the in-memory job list (used only to enrich created_at /
    status) is empty."""
    runs: list[RunOutputs] = []

    if OUTPUT_ROOT.exists():
        for job_dir in OUTPUT_ROOT.iterdir():
            if not job_dir.is_dir():
                continue
            by_cat: dict[str, list[OutputFileInfo]] = {}
            for cat in _CATEGORIES:
                d = job_dir / cat
                if d.exists():
                    entries = [_file_info(job_dir.name, cat, f) for f in sorted(d.iterdir()) if f.is_file()]
                    if entries:
                        by_cat[cat] = entries
            if not by_cat:
                continue  # empty/in-progress run — nothing to show yet

            job = jobs.get(job_dir.name)
            runs.append(RunOutputs(
                job_id=job_dir.name,
                created_at=job.created_at if job else None,
                status=job.status.value if job else None,
                mesh=by_cat.get("mesh", []),
                pointcloud=by_cat.get("pointcloud", []),
                geotiff=by_cat.get("geotiff", []),
            ))

    # Newest first — by known created_at, falling back to directory mtime
    # for runs whose job fell out of the in-memory registry (server restart).
    def _sort_key(r: RunOutputs) -> str:
        if r.created_at:
            return r.created_at
        return "0"  # unknown — sinks to the bottom rather than floating up
    runs.sort(key=_sort_key, reverse=True)

    logger.info("Outputs requested — %d run(s)", len(runs))
    return RunsListResponse(total=len(runs), runs=runs)


@router.get("/download/{job_id}/{category}/{filename}")
def download_file(job_id: str, category: str, filename: str):
    """Download a single output file from one run."""
    path = _safe_path(job_id, category, filename)
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "File not found")

    media_type = _CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")
    logger.info("Download: %s/%s/%s (%.1f MB)", job_id[:8], category, filename, path.stat().st_size / 1e6)
    return FileResponse(
        path=path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/preview/{job_id}/{category}/{filename}")
def preview_file(job_id: str, category: str, filename: str):
    """Serve a file inline (no download header). Useful for images / GeoTIFFs."""
    path = _safe_path(job_id, category, filename)
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "File not found")

    media_type = _CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path=path, media_type=media_type)
