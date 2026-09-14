"""Central logging setup, shared by the FastAPI server and standalone scripts
(scripts/start_ngrok.py). Two destinations:

  - console   INFO+   human-readable, for watching a live demo
  - data/logs/backend.log   DEBUG+, rotating   durable record of a run,
    survives past the terminal scrolling away or the app disconnecting

Call configure_logging() once, as early as possible; get_logger(name) after
that (it calls configure_logging() itself, so it's safe to use on its own
in a module that only needs a child logger).
"""
from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]  # backend/
LOG_DIR = PROJECT_ROOT / "data" / "logs"
LOG_FILE = LOG_DIR / "backend.log"

_configured = False


def configure_logging(console_level: int = logging.INFO, file_level: int = logging.DEBUG) -> logging.Logger:
    """Idempotent — safe to call from server.py, routes, and scripts alike."""
    global _configured
    logger = logging.getLogger("argus")
    if _configured:
        return logger

    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s", datefmt="%H:%M:%S")

    console = logging.StreamHandler()
    console.setLevel(console_level)
    console.setFormatter(fmt)
    logger.addHandler(console)

    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8",
        )
        file_handler.setLevel(file_level)
        file_handler.setFormatter(fmt)
        logger.addHandler(file_handler)
    except OSError as exc:
        logger.warning("Could not open %s for writing (%s) — file logging disabled", LOG_FILE, exc)

    _configured = True
    return logger


def get_logger(suffix: str | None = None) -> logging.Logger:
    """Child logger, e.g. get_logger('routes.pipeline') -> 'argus.routes.pipeline'."""
    configure_logging()
    return logging.getLogger(f"argus.{suffix}") if suffix else logging.getLogger("argus")
