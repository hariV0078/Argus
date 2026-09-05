"""Cleanup endpoint — free disk space between runs."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..runner import cleanup_workspace

router = APIRouter()


class CleanupRequest(BaseModel):
    workspace: str = Field("data/sfm", description="COLMAP SfM workspace to delete")
    out_dir: str = Field("data/output", description="Output directory to delete")
    frames: bool = Field(False, description="Also delete extracted frames")
    masks: bool = Field(False, description="Also delete YOLO mask PNGs")
    semantic: bool = Field(False, description="Also delete semantic label maps")
    frames_dir: str = Field("data/frames")
    masks_dir: str = Field("data/masks")
    semantic_dir: str = Field("data/semantic")


@router.post("/cleanup", tags=["System"], summary="Delete previous run artefacts")
def run_cleanup(req: CleanupRequest = CleanupRequest()):
    """
    Free disk space before a new run.

    **Always deleted:**
    - `data/sfm/`    — COLMAP workspace (depth maps, stereo patches) — largest
    - `data/output/` — exported GeoTIFF, mesh, point cloud files

    **Optional (set flag=true):**
    - `frames`   — extracted JPEGs (safe to delete if video is intact)
    - `masks`    — YOLO mask PNGs
    - `semantic` — semantic label maps
    """
    summary = cleanup_workspace(
        workspace=req.workspace,
        out_dir=req.out_dir,
        frames_dir=req.frames_dir if req.frames else None,
        masks_dir=req.masks_dir if req.masks else None,
        semantic_dir=req.semantic_dir if req.semantic else None,
    )
    return summary
