"""Async pipeline runner — launches each phase as a subprocess and streams stdout
back to the job log / WebSocket subscribers in real time."""

from __future__ import annotations

import asyncio
import shutil
import sys
from pathlib import Path
from typing import Optional

from .jobs import Job, jobs
from .logging_config import get_logger
from .schemas import JobStatus

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PYTHON = sys.executable  # already inside the 'recon' conda env
logger = get_logger("pipeline")


def _sizeof_fmt(num: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if abs(num) < 1024.0:
            return f"{num:.1f} {unit}"
        num /= 1024.0
    return f"{num:.1f} TB"


def cleanup_workspace(
    workspace: str = "data/sfm",
    out_dir: str = "data/output",
    frames_dir: str | None = None,
    masks_dir: str | None = None,
    semantic_dir: str | None = None,
) -> dict:
    """
    Delete previous run artefacts to free disk space.

    Always removes:
      • data/sfm/      (COLMAP workspace — depth maps, patches, stereo — biggest)
      • data/output/   (exported outputs: GeoTIFF, mesh, point clouds)

    Optional (pass the dir name to also remove):
      • frames_dir     (extracted JPEGs — re-extractable from video)
      • masks_dir      (YOLO mask PNGs)
      • semantic_dir   (semantic label maps)

    Returns a summary dict.
    """
    removed = []
    freed_bytes = 0

    def _rm(path_str: str, label: str) -> None:
        nonlocal freed_bytes
        p = PROJECT_ROOT / path_str
        if p.exists():
            size = sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
            shutil.rmtree(p)
            freed_bytes += size
            removed.append({"path": path_str, "freed": _sizeof_fmt(size)})

    _rm(workspace, "SfM workspace")
    _rm(out_dir, "outputs")
    if frames_dir:
        _rm(frames_dir, "frames")
    if masks_dir:
        _rm(masks_dir, "masks")
    if semantic_dir:
        _rm(semantic_dir, "semantic")

    return {
        "removed": removed,
        "total_freed": _sizeof_fmt(freed_bytes),
        "freed_bytes": freed_bytes,
    }


# ── helpers ──────────────────────────────────────────────────────────────────

async def _run_phase(job: Job, cmd: list[str], phase: str) -> int:
    """Spawn *cmd* as a subprocess, stream combined stdout+stderr into job logs,
    return the exit code."""
    await jobs.log(job, f"┌── {phase} ──")
    job.phase = phase
    logger.info("Job %s: phase '%s' starting", job.id, phase)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        cwd=PROJECT_ROOT,
    )
    job.process = proc

    assert proc.stdout is not None
    async for raw in proc.stdout:
        line = raw.decode(errors="replace").rstrip()
        if line:
            await jobs.log(job, f"│ {line}")

    await proc.wait()
    job.process = None
    rc = proc.returncode
    status = "OK" if rc == 0 else f"FAILED (exit {rc})"
    await jobs.log(job, f"└── {phase}: {status}")
    (logger.info if rc == 0 else logger.warning)("Job %s: phase '%s' finished — %s", job.id, phase, status)
    return rc


def _collect_outputs(out_dir: str) -> dict[str, list[dict]]:
    base = PROJECT_ROOT / out_dir
    result: dict[str, list[dict]] = {}
    for cat in ("mesh", "pointcloud", "geotiff"):
        d = base / cat
        if d.exists():
            result[cat] = [
                {"name": f.name, "size": f.stat().st_size}
                for f in sorted(d.iterdir())
                if f.is_file()
            ]
    return result


# ── main runner ───────────────────────────────────────────────────────────────

async def run_pipeline(job: Job, cfg: dict) -> None:
    job.status = JobStatus.RUNNING
    await jobs.log(job, f"▶ Job {job.id} started")
    logger.info(
        "Job %s: pipeline started (video_path=%s skip_ingestion=%s utm_epsg=%s auto_clean=%s)",
        job.id, cfg.get("video_path"), cfg.get("skip_ingestion", False),
        cfg.get("utm_epsg"), cfg.get("auto_clean", False),
    )

    try:
        frames_dir = cfg.get("frames_dir", "data/frames")
        workspace = cfg.get("workspace", "data/sfm")
        masks_dir = cfg.get("masks_dir", "data/masks")
        semantic_dir = cfg.get("semantic_dir", "data/semantic")
        # Each job gets its own output directory (data/output/{job_id}) unless
        # the caller explicitly overrides out_dir — this is what lets the app
        # show every run's mesh/point-cloud/DSM independently instead of each
        # run overwriting the last one's files.
        out_dir = cfg.get("out_dir") or f"data/output/{job.id}"
        manifest = f"{frames_dir}/manifest.csv"

        # ── Auto-clean previous run ───────────────────────────────────────────
        if cfg.get("auto_clean"):
            await jobs.log(job, "🧹 auto_clean: removing previous outputs and SfM workspace...")
            summary = cleanup_workspace(
                workspace=workspace,
                out_dir=out_dir,
                # Only remove frames/masks/semantic if we're re-running those phases
                frames_dir=frames_dir if not cfg.get("skip_ingestion") else None,
                masks_dir=masks_dir if not cfg.get("skip_masking") else None,
                semantic_dir=semantic_dir if not cfg.get("skip_semantic") else None,
            )
            for item in summary["removed"]:
                await jobs.log(job, f"  deleted {item['path']}  ({item['freed']})")
            await jobs.log(job, f"  ✔ freed {summary['total_freed']} total")

        # ── Phase 2: Ingestion ────────────────────────────────────────────────
        if not cfg.get("skip_ingestion"):
            cmd = [
                PYTHON, "-m", "src.ingestion.pipeline",
                "--video", cfg["video_path"],
                "--out-dir", frames_dir,
                "--fps", str(cfg.get("fps", 3.0)),
                "--blur-threshold", str(cfg.get("blur_threshold", 80)),
                "--min-dist-m", str(cfg.get("min_dist_m", 0.5)),
            ]
            if cfg.get("telemetry_path"):
                cmd += ["--telemetry", cfg["telemetry_path"]]
            if cfg.get("skip_georef"):
                cmd.append("--skip-georef")
            rc = await _run_phase(job, cmd, "Ingestion")
            if rc != 0:
                raise RuntimeError("Ingestion phase failed")
        else:
            await jobs.log(job, "⏭ Ingestion skipped")

        # ── Phase 4a: Dynamic Masking (before SfM) ───────────────────────────
        if not cfg.get("skip_masking"):
            rc = await _run_phase(job, [
                PYTHON, "-m", "src.segmentation.pipeline",
                "--manifest", manifest,
                "--mask-dir", masks_dir,
                "--mask-only",
            ], "Dynamic Masking")
            if rc != 0:
                raise RuntimeError("Dynamic masking phase failed")
        else:
            await jobs.log(job, "⏭ Masking skipped")

        # ── Phase 3: Reconstruction ───────────────────────────────────────────
        if not cfg.get("skip_reconstruction"):
            cmd = [
                PYTHON, "-m", "src.reconstruction.pipeline",
                "--frames", frames_dir,
                "--manifest", manifest,
                "--workspace", workspace,
                "--out-dir", out_dir,
                "--overlap", str(cfg.get("overlap", 10)),
                "--utm-epsg", str(cfg.get("utm_epsg", 32644)),
                "--dsm-res-m", str(cfg.get("dsm_res_m", 0.1)),
            ]
            if not cfg.get("use_gpu", True):
                cmd.append("--no-gpu")
            if cfg.get("skip_georef"):
                cmd.append("--skip-georef")
            rc = await _run_phase(job, cmd, "Reconstruction")
            if rc != 0:
                raise RuntimeError("Reconstruction phase failed")
        else:
            await jobs.log(job, "⏭ Reconstruction skipped")

        # ── Phase 4b+c: Semantic Segmentation ────────────────────────────────
        if not cfg.get("skip_semantic"):
            rc = await _run_phase(job, [
                PYTHON, "-m", "src.segmentation.pipeline",
                "--manifest", manifest,
                "--semantic-dir", semantic_dir,
                "--reconstruction", f"{workspace}/{'sparse' if cfg.get('skip_georef') else 'sparse_geo'}",
                "--dense-ply", f"{workspace}/dense.ply",
                "--out-ply", f"{out_dir}/pointcloud/dense_labelled.ply",
                "--semantic-only",
            ], "Semantic Segmentation")
            if rc != 0:
                await jobs.log(job, "⚠ Semantic pass failed — core outputs still available")
        else:
            await jobs.log(job, "⏭ Semantic segmentation skipped")

        # ── Finalise ──────────────────────────────────────────────────────────
        job.outputs = _collect_outputs(out_dir)
        n = sum(len(v) for v in job.outputs.values())
        job.status = JobStatus.COMPLETED
        await jobs.log(job, f"✔ Pipeline complete — {n} output file(s) ready")
        logger.info("Job %s: pipeline COMPLETED — %d output file(s) in %s", job.id, n, out_dir)

    except asyncio.CancelledError:
        job.status = JobStatus.CANCELLED
        await jobs.log(job, "Job cancelled")
        logger.warning("Job %s: pipeline cancelled (phase=%s)", job.id, job.phase)
        raise

    except Exception as exc:
        job.status = JobStatus.FAILED
        job.error = str(exc)
        await jobs.log(job, f"✘ Error: {exc}")
        logger.error("Job %s: pipeline FAILED (phase=%s) — %s", job.id, job.phase, exc)

    finally:
        # Always emit the sentinel so WebSocket clients know the stream is over
        await jobs.log(job, "__DONE__")
