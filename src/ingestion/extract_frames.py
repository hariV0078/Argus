"""
Extract frames from a drone video with quality filtering.

Filters applied in order:
  1. Blur  — Laplacian variance < threshold → skip
  2. GPS gap — distance to last kept frame < min_dist_m → skip
"""

import subprocess
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from tqdm import tqdm
import pymap3d


def _blur_score(img_bgr: np.ndarray) -> float:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6_371_000
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlam = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlam / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


def _interpolate_gps(
    frame_ms: float,
    telemetry: pd.DataFrame,
) -> dict | None:
    """Linear interpolation of GPS/attitude for a given timestamp (ms)."""
    t = telemetry["timestamp_ms"].values
    if frame_ms < t[0] or frame_ms > t[-1]:
        return None
    idx = np.searchsorted(t, frame_ms)
    if idx == 0:
        row = telemetry.iloc[0]
    elif idx >= len(telemetry):
        row = telemetry.iloc[-1]
    else:
        lo, hi = telemetry.iloc[idx - 1], telemetry.iloc[idx]
        alpha = (frame_ms - t[idx - 1]) / max(t[idx] - t[idx - 1], 1)
        row = lo.copy()
        for col in ("lat", "lon", "alt_m", "rel_alt_m",
                    "gimbal_pitch", "gimbal_yaw", "gimbal_roll"):
            if col in lo and not np.isnan(lo[col]) and not np.isnan(hi[col]):
                row[col] = lo[col] + alpha * (hi[col] - lo[col])
    return row.to_dict()


def extract(
    video_path: Path,
    out_dir: Path,
    telemetry: pd.DataFrame,
    target_fps: float = 3.0,
    blur_threshold: float = 80.0,
    min_dist_m: float = 0.5,
) -> pd.DataFrame:
    """
    Extract frames and return a DataFrame with one row per kept frame:
      frame_path, timestamp_ms, lat, lon, alt_m, rel_alt_m,
      gimbal_pitch, gimbal_yaw, gimbal_roll, blur_score
    """
    video_path = Path(video_path)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Get video metadata
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=r_frame_rate,nb_frames,duration",
         "-of", "csv=p=0", str(video_path)],
        capture_output=True, text=True, check=True,
    )
    parts = probe.stdout.strip().split("\n")[0].split(",")
    num, den = (int(x) for x in parts[0].split("/"))
    native_fps = num / den
    duration_s = float(parts[2]) if parts[2] != "N/A" else None

    step = max(1, round(native_fps / target_fps))
    print(f"  [extract] {video_path.name}  native={native_fps:.2f}fps  "
          f"step={step} (→ ~{native_fps/step:.2f}fps sampled)")

    cap = cv2.VideoCapture(str(video_path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    kept = []
    last_lat, last_lon = None, None
    frame_idx = 0
    kept_count = 0
    blur_dropped = 0
    dist_dropped = 0

    with tqdm(total=total, unit="fr", desc="extracting") as pbar:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            pbar.update(1)

            if frame_idx % step != 0:
                frame_idx += 1
                continue

            ts_ms = (frame_idx / native_fps) * 1000

            # Blur filter
            score = _blur_score(frame)
            if score < blur_threshold:
                blur_dropped += 1
                frame_idx += 1
                continue

            # GPS interpolation
            gps = _interpolate_gps(ts_ms, telemetry)
            if gps is None:
                frame_idx += 1
                continue

            # Distance filter
            if last_lat is not None:
                dist = _haversine_m(last_lat, last_lon, gps["lat"], gps["lon"])
                if dist < min_dist_m:
                    dist_dropped += 1
                    frame_idx += 1
                    continue

            # Save frame
            fname = f"{kept_count:05d}.jpg"
            fpath = out_dir / fname
            cv2.imwrite(str(fpath), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])

            last_lat, last_lon = gps["lat"], gps["lon"]
            kept_count += 1
            kept.append(dict(
                frame_path=str(fpath),
                frame_idx=frame_idx,
                timestamp_ms=ts_ms,
                blur_score=score,
                **{k: gps.get(k) for k in (
                    "lat", "lon", "alt_m", "rel_alt_m",
                    "gimbal_pitch", "gimbal_yaw", "gimbal_roll"
                )},
            ))
            frame_idx += 1

    cap.release()

    print(f"  [extract] kept={kept_count}  blur_dropped={blur_dropped}  "
          f"dist_dropped={dist_dropped}  total_read={frame_idx}")

    if not kept:
        raise RuntimeError("No frames passed quality filters. "
                           "Lower blur_threshold or min_dist_m.")

    return pd.DataFrame(kept)
