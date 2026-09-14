#!/usr/bin/env python3
"""
Expose the local FastAPI server on the reserved ngrok static domain.

Reads NGROK_AUTHTOKEN / NGROK_DOMAIN / BACKEND_PORT from backend/.env
(see .env.example) so the token never lands in source control.

Usage:
    conda run -n recon python3 scripts/start_ngrok.py
    # or, with the server already running elsewhere:
    conda run -n recon python3 scripts/start_ngrok.py --no-server

The public URL is fixed (free static domain), so the frontend's
EXPO_PUBLIC_BACKEND_URL / Settings > Server URL doesn't need to change
between runs.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from pyngrok import conf, ngrok

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Run as `python3 scripts/start_ngrok.py`, sys.path[0] is scripts/, not
# backend/ — add PROJECT_ROOT so `src.*` (and our shared logging setup) import.
sys.path.insert(0, str(PROJECT_ROOT))
from src.viewer.logging_config import configure_logging, get_logger  # noqa: E402

configure_logging()
logger = get_logger("ngrok")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--no-server",
        action="store_true",
        help="Only open the tunnel; assume uvicorn is already running on BACKEND_PORT.",
    )
    args = parser.parse_args()

    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        sys.exit(
            f"Missing {env_path}. Run: cp .env.example .env  (then fill in NGROK_AUTHTOKEN)"
        )
    load_dotenv(env_path)

    authtoken = os.environ.get("NGROK_AUTHTOKEN", "")
    domain = os.environ.get("NGROK_DOMAIN", "sound-guiding-mammoth.ngrok-free.app")
    port = int(os.environ.get("BACKEND_PORT", "8765"))

    if not authtoken or authtoken == "your_ngrok_authtoken_here":
        sys.exit(
            "NGROK_AUTHTOKEN is not set in .env. Get one at "
            "https://dashboard.ngrok.com/get-started/your-authtoken"
        )

    conf.get_default().auth_token = authtoken
    logger.info("ngrok authenticated, target domain=%s port=%d", domain, port)

    # server_proc/tunnel are set up inside this try — and cleaned up in the
    # matching finally no matter which step fails. Previously ngrok.connect()
    # was OUTSIDE the try/finally: if it raised (e.g. the domain was already
    # bound to another agent — ERR_NGROK_334), the just-spawned uvicorn was
    # never terminated. It kept running, orphaned, forever holding the port —
    # so every subsequent attempt failed too ("address already in use"),
    # compounding with each retry. If you're cleaning up a pile of these,
    # `pkill -f "uvicorn src.viewer.server"` and `pkill -f start_ngrok.py`
    # first, then confirm nothing is still listening: `ss -ltnp | grep 8765`.
    server_proc: subprocess.Popen | None = None
    tunnel = None
    try:
        if not args.no_server:
            logger.info("Starting FastAPI server on :%d ...", port)
            server_proc = subprocess.Popen(
                [
                    sys.executable, "-m", "uvicorn", "src.viewer.server:app",
                    "--host", "0.0.0.0", "--port", str(port),
                ],
                cwd=PROJECT_ROOT,
            )
            time.sleep(2)  # give uvicorn a moment to bind before the tunnel targets it

        tunnel = ngrok.connect(addr=port, proto="http", domain=domain)
        logger.info("Tunnel open: %s -> localhost:%d", tunnel.public_url, port)
        # Plain print for this part — it's the banner a demo audience actually
        # reads, kept free of timestamps/logger noise.
        print(f"\n  Public URL: {tunnel.public_url}")
        print(f"  Forwarding: {tunnel.public_url} -> localhost:{port}")
        print(f"  Swagger UI: {tunnel.public_url}/docs")
        print(f"  Backend log: {PROJECT_ROOT / 'data' / 'logs' / 'backend.log'}")
        print("\nSet this as the backend URL in the app (or frontend/.env's "
              "EXPO_PUBLIC_BACKEND_URL). Ctrl+C to stop.\n")

        while True:
            time.sleep(1)
            if server_proc is not None and server_proc.poll() is not None:
                logger.warning("Server process exited (code %s); stopping tunnel.", server_proc.returncode)
                break
    except KeyboardInterrupt:
        logger.info("Ctrl+C received, shutting down")
    finally:
        if tunnel is not None:
            try:
                ngrok.disconnect(tunnel.public_url)
            except Exception:
                pass
        try:
            ngrok.kill()
        except Exception:
            pass
        if server_proc is not None and server_proc.poll() is None:
            server_proc.terminate()
        logger.info("Tunnel closed")


if __name__ == "__main__":
    main()
