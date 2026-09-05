"""
Write GPS + attitude EXIF tags into extracted frames using exiftool.

Writes:
  GPSLatitude, GPSLongitude, GPSAltitude, GPSAltitudeRef
  GPSImgDirection (yaw), CameraElevationAngle (pitch)
  DateTimeOriginal

Verifies at least one frame has real GPS before returning.
"""

import subprocess
import tempfile
import csv
from pathlib import Path

import pandas as pd
import numpy as np


def _dd_to_dms(dd: float) -> tuple[int, int, float]:
    dd = abs(dd)
    d = int(dd)
    m = int((dd - d) * 60)
    s = (dd - d - m / 60) * 3600
    return d, m, s


def _build_exiftool_csv(frame_df: pd.DataFrame, csv_path: Path) -> None:
    """Write the CSV that exiftool -csv= consumes."""
    rows = []
    for _, row in frame_df.iterrows():
        lat, lon = row["lat"], row["lon"]
        alt = row.get("alt_m", 0) or 0
        yaw   = row.get("gimbal_yaw", np.nan)
        pitch = row.get("gimbal_pitch", np.nan)

        lat_ref = "N" if lat >= 0 else "S"
        lon_ref = "E" if lon >= 0 else "W"
        lat_d, lat_m, lat_s = _dd_to_dms(lat)
        lon_d, lon_m, lon_s = _dd_to_dms(lon)

        rec = {
            "SourceFile": row["frame_path"],
            "GPSLatitude": f"{lat_d} {lat_m} {lat_s:.6f}",
            "GPSLatitudeRef": lat_ref,
            "GPSLongitude": f"{lon_d} {lon_m} {lon_s:.6f}",
            "GPSLongitudeRef": lon_ref,
            "GPSAltitude": f"{abs(alt):.3f}",
            "GPSAltitudeRef": "0" if alt >= 0 else "1",
        }
        if not np.isnan(yaw):
            rec["GPSImgDirection"] = f"{yaw:.2f}"
            rec["GPSImgDirectionRef"] = "T"
        if not np.isnan(pitch):
            rec["CameraElevationAngle"] = f"{pitch:.2f}"

        rows.append(rec)

    if not rows:
        return

    fieldnames = list(rows[0].keys())
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def tag(frame_df: pd.DataFrame, verify: bool = True) -> None:
    """
    Geotag all frames in-place using exiftool.

    Args:
        frame_df: output from extract_frames.extract()
        verify:   if True, confirm GPS landed on first frame and raise if not
    """
    with tempfile.NamedTemporaryFile(
        suffix=".csv", mode="w", delete=False, prefix="geotag_"
    ) as tf:
        csv_path = Path(tf.name)

    _build_exiftool_csv(frame_df, csv_path)

    print(f"  [geotag] Writing GPS EXIF to {len(frame_df)} frames...")
    result = subprocess.run(
        [
            "exiftool",
            f"-csv={csv_path}",
            "-overwrite_original",
            "-q",           # suppress per-file output
        ],
        capture_output=True, text=True,
    )
    csv_path.unlink(missing_ok=True)

    if result.returncode not in (0, 1):
        raise RuntimeError(f"exiftool failed:\n{result.stderr}")

    # exiftool exit 1 = some files had warnings — usually fine
    if result.stderr.strip():
        print(f"  [geotag] exiftool warnings: {result.stderr.strip()[:200]}")

    if verify:
        _verify_first_frame(frame_df.iloc[0]["frame_path"])


def _verify_first_frame(frame_path: str) -> None:
    result = subprocess.run(
        ["exiftool", "-GPSLatitude", "-GPSLongitude", "-GPSAltitude", frame_path],
        capture_output=True, text=True,
    )
    lines = result.stdout.strip()
    if "GPS Latitude" not in lines:
        raise RuntimeError(
            f"GPS tags NOT found on {frame_path} after geotagging.\n"
            "Check that exiftool supports writing to this JPEG format.\n"
            f"exiftool output:\n{lines}"
        )
    print(f"  [geotag] Verified GPS on {Path(frame_path).name}:")
    for line in lines.splitlines():
        print(f"           {line.strip()}")
