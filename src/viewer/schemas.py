from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PipelineRequest(BaseModel):
    video_path: str = Field(..., description="Path to drone video (relative to project root)")
    telemetry_path: Optional[str] = Field(None, description=".srt or .csv telemetry path; auto-extracted from video if None")
    out_dir: str = Field("data/output", description="Output directory for 3D model files")
    frames_dir: str = Field("data/frames", description="Extracted frames destination")
    workspace: str = Field("data/sfm", description="COLMAP workspace directory")
    masks_dir: str = Field("data/masks", description="YOLO mask output directory")
    semantic_dir: str = Field("data/semantic", description="Semantic label maps directory")
    fps: float = Field(3.0, ge=1.0, le=10.0, description="Frame extraction rate")
    blur_threshold: int = Field(80, ge=0, le=500, description="Laplacian variance cutoff")
    min_dist_m: float = Field(0.5, ge=0.0, description="Minimum GPS distance between frames (m)")
    overlap: int = Field(10, ge=1, le=50, description="COLMAP sequential matcher overlap")
    utm_epsg: int = Field(32644, description="UTM EPSG for GeoTIFF export")
    dsm_res_m: float = Field(0.1, ge=0.01, description="DSM raster resolution (m)")
    use_gpu: bool = Field(True, description="Use GPU for COLMAP dense stereo")
    skip_ingestion: bool = Field(False, description="Skip ingestion (frames already extracted)")
    skip_masking: bool = Field(False, description="Skip dynamic masking")
    skip_reconstruction: bool = Field(False, description="Skip reconstruction (reuse existing SfM)")
    skip_semantic: bool = Field(False, description="Skip semantic segmentation pass")
    auto_clean: bool = Field(False, description="Delete previous outputs + SfM workspace before running")

    class Config:
        json_schema_extra = {
            "example": {
                "video_path": "data/raw/drone.MOV",
                "fps": 3.0,
                "utm_epsg": 32644,
            }
        }


class JobOut(BaseModel):
    id: str
    status: JobStatus
    phase: str
    created_at: str
    updated_at: str
    error: Optional[str]
    outputs: dict
    log_count: int


class JobDetailOut(JobOut):
    logs: list[str]


class OutputFileInfo(BaseModel):
    name: str
    category: str
    size_bytes: int
    download_url: str


class OutputsListResponse(BaseModel):
    total: int
    files: list[OutputFileInfo]


class SystemInfo(BaseModel):
    status: str
    gpu_available: bool
    gpu_name: Optional[str]
    gpu_memory_free_gb: Optional[float]
    gpu_memory_total_gb: Optional[float]
    disk_free_gb: float
    disk_total_gb: float
    python_version: str
    jobs_total: int
    jobs_running: int
    jobs_completed: int
