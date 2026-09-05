"""Serve and list 3D reconstruction output files."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..schemas import OutputFileInfo, OutputsListResponse

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parents[3]

_CATEGORIES = ("mesh", "pointcloud", "geotiff")

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
}


def _safe_path(category: str, filename: str) -> Path:
    """Resolve path and guard against traversal attacks."""
    if category not in _CATEGORIES:
        raise HTTPException(404, f"Unknown category '{category}'. Valid: {_CATEGORIES}")
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(400, "Invalid filename")

    base = PROJECT_ROOT / "data" / "output"
    path = (base / category / filename).resolve()

    # Ensure resolved path stays inside output dir
    if not str(path).startswith(str(base.resolve())):
        raise HTTPException(400, "Path traversal detected")
    return path


@router.get("", response_model=OutputsListResponse)
@router.get("/", response_model=OutputsListResponse, include_in_schema=False)
def list_outputs(out_dir: str = "data/output"):
    """List all available output files grouped by category."""
    base = PROJECT_ROOT / out_dir
    files: list[OutputFileInfo] = []

    for cat in _CATEGORIES:
        d = base / cat
        if not d.exists():
            continue
        for f in sorted(d.iterdir()):
            if f.is_file():
                files.append(OutputFileInfo(
                    name=f.name,
                    category=cat,
                    size_bytes=f.stat().st_size,
                    download_url=f"/api/outputs/download/{cat}/{f.name}",
                ))

    return OutputsListResponse(total=len(files), files=files)


@router.get("/download/{category}/{filename}")
def download_file(category: str, filename: str):
    """Download a single output file by category and name."""
    path = _safe_path(category, filename)
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "File not found")

    media_type = _CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(
        path=path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/preview/{category}/{filename}")
def preview_file(category: str, filename: str):
    """Serve a file inline (no download header). Useful for images / GeoTIFFs."""
    path = _safe_path(category, filename)
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "File not found")

    media_type = _CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path=path, media_type=media_type)
