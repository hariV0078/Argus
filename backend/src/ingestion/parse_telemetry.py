"""
Parse drone telemetry into a clean per-frame CSV.

Supported sources (auto-detected):
  - DJI SRT subtitle file  (.srt embedded in video or extracted)
  - exiftool GPS dump      (produced by: exiftool -ee -G3 -csv video.MOV)
  - plain CSV              (columns: timestamp_ms, lat, lon, alt_m, pitch, roll, yaw)
"""

import re
import csv
import json
import subprocess
import tempfile
from pathlib import Path

import pandas as pd
import numpy as np


# ── DJI SRT ────────────────────────────────────────────────────────────────

_SRT_BLOCK = re.compile(
    r"\[latitude:\s*([+-]?\d+\.\d+)\]"
    r".*?\[longitude:\s*([+-]?\d+\.\d+)\]"
    r".*?\[rel_alt:\s*([+-]?\d+\.\d+)"
    r".*?abs_alt:\s*([+-]?\d+\.\d+)\]",
    re.DOTALL,
)
_SRT_TIMESTAMP = re.compile(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})")
_SRT_GIMBAL = re.compile(
    r"\[pitch\s*:\s*([+-]?\d+\.?\d*)\]"
    r".*?\[yaw\s*:\s*([+-]?\d+\.?\d*)\]"
    r".*?\[roll\s*:\s*([+-]?\d+\.?\d*)\]",
    re.DOTALL,
)


def _parse_srt(srt_path: Path) -> pd.DataFrame:
    text = srt_path.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"\n\s*\n", text.strip())
    rows = []
    for block in blocks:
        ts_m = _SRT_TIMESTAMP.search(block)
        gps_m = _SRT_BLOCK.search(block)
        if not (ts_m and gps_m):
            continue
        h, m, s, ms = (int(x) for x in ts_m.groups())
        t_ms = ((h * 3600 + m * 60 + s) * 1000) + ms
        lat, lon = float(gps_m.group(1)), float(gps_m.group(2))
        rel_alt, abs_alt = float(gps_m.group(3)), float(gps_m.group(4))
        gimbal_m = _SRT_GIMBAL.search(block)
        pitch = float(gimbal_m.group(1)) if gimbal_m else float("nan")
        yaw   = float(gimbal_m.group(2)) if gimbal_m else float("nan")
        roll  = float(gimbal_m.group(3)) if gimbal_m else float("nan")
        rows.append(dict(
            timestamp_ms=t_ms, lat=lat, lon=lon,
            alt_m=abs_alt, rel_alt_m=rel_alt,
            gimbal_pitch=pitch, gimbal_yaw=yaw, gimbal_roll=roll,
        ))
    return pd.DataFrame(rows)


# ── exiftool CSV dump ───────────────────────────────────────────────────────

def _parse_exiftool_csv(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path, low_memory=False)
    col_map = {c: c.lower().replace(" ", "_") for c in df.columns}
    df = df.rename(columns=col_map)

    # Try to find GPS columns under various exiftool naming conventions
    lat_col  = next((c for c in df.columns if "gps" in c and "lat"  in c), None)
    lon_col  = next((c for c in df.columns if "gps" in c and "lon"  in c), None)
    alt_col  = next((c for c in df.columns if "gps" in c and "alt"  in c), None)
    time_col = next((c for c in df.columns if "gps" in c and "time" in c), None)

    if not (lat_col and lon_col):
        raise ValueError(f"Could not find GPS lat/lon columns in {csv_path}. "
                         f"Available: {list(df.columns)}")

    out = pd.DataFrame()
    out["lat"] = pd.to_numeric(df[lat_col], errors="coerce")
    out["lon"] = pd.to_numeric(df[lon_col], errors="coerce")
    out["alt_m"] = pd.to_numeric(df[alt_col], errors="coerce") if alt_col else float("nan")

    if time_col:
        # GPS time is often "HH:MM:SS.sss" — convert to ms offset from first
        def _to_ms(t):
            try:
                parts = str(t).split(":")
                h, m, s = int(parts[0]), int(parts[1]), float(parts[2])
                return int((h * 3600 + m * 60 + s) * 1000)
            except Exception:
                return float("nan")
        out["timestamp_ms"] = df[time_col].apply(_to_ms)
        out["timestamp_ms"] -= out["timestamp_ms"].iloc[0]
    else:
        out["timestamp_ms"] = range(len(out))

    for col in ("gimbal_pitch", "gimbal_yaw", "gimbal_roll"):
        out[col] = float("nan")

    return out.dropna(subset=["lat", "lon"])


# ── extract SRT embedded in video ──────────────────────────────────────────

def _extract_srt_from_video(video_path: Path, out_dir: Path) -> Path | None:
    srt_path = out_dir / (video_path.stem + ".srt")
    if srt_path.exists():
        return srt_path
    # ffmpeg extracts subtitle stream 0 if present
    result = subprocess.run(
        ["ffmpeg", "-i", str(video_path), "-f", "srt", str(srt_path), "-y"],
        capture_output=True, text=True,
    )
    if srt_path.exists() and srt_path.stat().st_size > 100:
        return srt_path
    # DJI sometimes uses stream index s:0
    result2 = subprocess.run(
        ["ffmpeg", "-i", str(video_path), "-map", "0:s:0", str(srt_path), "-y"],
        capture_output=True, text=True,
    )
    if srt_path.exists() and srt_path.stat().st_size > 100:
        return srt_path
    return None


def _extract_via_exiftool(video_path: Path, out_dir: Path) -> pd.DataFrame | None:
    csv_path = out_dir / (video_path.stem + "_exiftool.csv")
    result = subprocess.run(
        ["exiftool", "-ee", "-G3", "-csv", str(video_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return None
    csv_path.write_text(result.stdout)
    try:
        return _parse_exiftool_csv(csv_path)
    except ValueError:
        return None


# ── public API ─────────────────────────────────────────────────────────────

def parse(
    source: Path,
    video_path: Path | None = None,
    out_dir: Path | None = None,
) -> pd.DataFrame:
    """
    Parse telemetry from `source`.

    source can be:
      - .srt  file
      - exiftool -csv output file
      - plain CSV with required columns
      - video file (auto-extracts SRT / exiftool GPS)

    Returns DataFrame with columns:
      timestamp_ms, lat, lon, alt_m, rel_alt_m,
      gimbal_pitch, gimbal_yaw, gimbal_roll
    """
    source = Path(source)
    if out_dir is None:
        out_dir = source.parent
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    suffix = source.suffix.lower()

    if suffix == ".srt":
        df = _parse_srt(source)

    elif suffix == ".csv":
        df = _parse_exiftool_csv(source)

    elif suffix in (".mp4", ".mov", ".avi", ".mkv", ".m4v"):
        # Try SRT embedded in video first
        srt = _extract_srt_from_video(source, out_dir)
        if srt:
            print(f"  [telemetry] SRT extracted: {srt}")
            df = _parse_srt(srt)
        else:
            print("  [telemetry] No SRT found — trying exiftool GPS track")
            df = _extract_via_exiftool(source, out_dir)
            if df is None or df.empty:
                raise RuntimeError(
                    f"Could not extract GPS from {source}. "
                    "Supply a .srt or exiftool CSV manually."
                )
    else:
        raise ValueError(f"Unsupported telemetry source: {source}")

    if df.empty:
        raise RuntimeError(f"Telemetry parsed but no GPS rows found in {source}")

    # Ensure required columns exist
    for col in ("rel_alt_m", "gimbal_pitch", "gimbal_yaw", "gimbal_roll"):
        if col not in df.columns:
            df[col] = float("nan")

    df = df.reset_index(drop=True)
    df.index.name = "telemetry_idx"

    print(f"  [telemetry] {len(df)} GPS records  "
          f"lat [{df.lat.min():.5f}, {df.lat.max():.5f}]  "
          f"lon [{df.lon.min():.5f}, {df.lon.max():.5f}]  "
          f"alt [{df.alt_m.min():.1f}, {df.alt_m.max():.1f}] m")
    return df


def save(df: pd.DataFrame, path: Path) -> None:
    df.to_csv(path, index=False)
    print(f"  [telemetry] Saved to {path}")
