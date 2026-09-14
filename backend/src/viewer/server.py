"""
SIH 2026 PS #17 — 3D Reconstruction Pipeline API
==================================================

Run:
    conda run -n recon uvicorn src.viewer.server:app --host 0.0.0.0 --port 8000 --reload

Or via module:
    conda run -n recon python -m src.viewer.server
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .logging_config import configure_logging, get_logger
from .routes import cleanup, outputs, pipeline, system

PROJECT_ROOT = Path(__file__).resolve().parents[2]

configure_logging()
logger = get_logger("server")

# High-frequency polling endpoints — log these at DEBUG (file only) so the
# console stays readable during a demo; everything else logs at INFO.
_QUIET_PREFIXES = ("/api/pipeline/jobs/", "/api/health")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up")
    # Each job creates its own data/output/{job_id}/{mesh,pointcloud,geotiff}/
    # on demand (see runner.py) — just ensure the parent exists.
    (PROJECT_ROOT / "data" / "output").mkdir(parents=True, exist_ok=True)
    logger.info("Ready — Swagger UI at /docs, log file at data/logs/backend.log")
    yield
    logger.info("Shutting down")
    # Graceful shutdown: nothing to clean up (background tasks managed by FastAPI)


app = FastAPI(
    title="SIH26158 — Drone Video to 3D Model API",
    description=(
        "Single-pass drone video → georeferenced 3D model pipeline.\n\n"
        "**Phases:** Ingestion → Dynamic Masking → COLMAP SfM → Dense MVS → "
        "Semantic Segmentation → Multi-format Export\n\n"
        "**WebSocket log stream:** `ws://<host>:<port>/ws/{job_id}`"
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """One line per request: method, path, status, timing. Lets you watch the
    phone talk to the server live in the terminal during a demo."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    level = logging.DEBUG if request.url.path.startswith(_QUIET_PREFIXES) else logging.INFO
    logger.log(level, "%s %s -> %d (%.1fms)", request.method, request.url.path, response.status_code, duration_ms)
    return response


# REST routers
app.include_router(pipeline.router,   prefix="/api/pipeline", tags=["Pipeline"])
app.include_router(outputs.router,    prefix="/api/outputs",  tags=["Outputs"])
app.include_router(system.router,     prefix="/api",          tags=["System"])
app.include_router(cleanup.router,    prefix="/api",          tags=["System"])

# WebSocket router (no /api prefix — cleaner WS URL)
app.include_router(pipeline.ws_router, tags=["WebSocket"])


@app.get("/", tags=["System"], summary="Service root")
def root():
    return {
        "service": "SIH26158 Drone 3D Reconstruction API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "start_pipeline":  "POST /api/pipeline/run",
            "list_jobs":       "GET  /api/pipeline/jobs",
            "job_detail":      "GET  /api/pipeline/jobs/{id}",
            "cancel_job":      "DELETE /api/pipeline/jobs/{id}",
            "pipeline_status": "GET  /api/pipeline/status",
            "list_outputs":    "GET  /api/outputs",
            "download_file":   "GET  /api/outputs/download/{category}/{filename}",
            "system_info":     "GET  /api/system",
            "health":          "GET  /api/health",
            "cleanup":         "POST /api/cleanup",
            "log_stream_ws":   "WS   /ws/{job_id}",
        },
    }


if __name__ == "__main__":
    uvicorn.run(
        "src.viewer.server:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
