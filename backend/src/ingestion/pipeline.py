"""
Ingestion pipeline — single entry point.

Usage:
  conda run -n recon python -m src.ingestion.pipeline \
      --video data/raw/drone.MOV \
      --out-dir data/frames

Or pass a pre-extracted SRT/CSV:
  python -m src.ingestion.pipeline \
      --video data/raw/drone.MOV \
      --telemetry data/raw/telemetry.srt \
      --out-dir data/frames
"""

import argparse
import json
import time
from pathlib import Path

import pandas as pd

from .parse_telemetry import parse as parse_telemetry, save as save_telemetry
from .extract_frames import extract as extract_frames, extract_no_gps
from .geotag_frames import tag as geotag


def run(
    video_path: Path,
    out_dir: Path,
    telemetry_source: Path | None = None,
    target_fps: float = 3.0,
    blur_threshold: float = 80.0,
    min_dist_m: float = 0.5,
    skip_georef: bool = False,
) -> pd.DataFrame:
    """
    Full ingestion: telemetry → frames → geotag.
    Returns frame manifest DataFrame.

    skip_georef=True is for source video with no GPS at all (no DJI SRT, no
    embedded location, no sidecar telemetry): skips telemetry parsing and
    EXIF geotagging entirely, extracts frames by pure time-interval spacing
    instead of GPS-distance dedup. The resulting reconstruction stays in
    local (non-georeferenced) coordinates — see colmap_runner.run(skip_georef=...).
    """
    video_path = Path(video_path)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.time()

    if skip_georef:
        print("\n[1/2] No GPS available — extracting frames by time interval...")
        frame_df = extract_no_gps(
            video_path=video_path,
            out_dir=out_dir,
            target_fps=target_fps,
            blur_threshold=blur_threshold,
        )
        telemetry = frame_df  # for the summary block below
        print("\n[2/2] Skipping EXIF geotagging (no GPS)")
    else:
        # Step 1: telemetry
        print("\n[1/3] Parsing telemetry...")
        telem_source = telemetry_source if telemetry_source else video_path
        telemetry = parse_telemetry(telem_source, video_path=video_path, out_dir=out_dir)
        save_telemetry(telemetry, out_dir / "telemetry.csv")

        # Step 2: frame extraction
        print("\n[2/3] Extracting frames...")
        frame_df = extract_frames(
            video_path=video_path,
            out_dir=out_dir,
            telemetry=telemetry,
            target_fps=target_fps,
            blur_threshold=blur_threshold,
            min_dist_m=min_dist_m,
        )

        # Step 3: GPS EXIF tagging
        print("\n[3/3] Geotagging frames...")
        geotag(frame_df, verify=True)

    # Save manifest (used by reconstruction phase)
    manifest_path = out_dir / "manifest.csv"
    frame_df.to_csv(manifest_path, index=False)

    elapsed = time.time() - t0
    summary = {
        "video": str(video_path),
        "frames_kept": len(frame_df),
        "telemetry_records": len(telemetry),
        "elapsed_s": round(elapsed, 1),
        "skip_georef": skip_georef,
    }
    if not skip_georef:
        summary["lat_range"] = [round(frame_df.lat.min(), 6), round(frame_df.lat.max(), 6)]
        summary["lon_range"] = [round(frame_df.lon.min(), 6), round(frame_df.lon.max(), 6)]
        summary["alt_range_m"] = [round(frame_df.alt_m.min(), 1), round(frame_df.alt_m.max(), 1)]
    (out_dir / "ingestion_summary.json").write_text(
        json.dumps(summary, indent=2)
    )

    print(f"\n[ingestion] Done in {elapsed:.1f}s")
    print(f"  frames   : {len(frame_df)}")
    print(f"  manifest : {manifest_path}")
    return frame_df


def main():
    ap = argparse.ArgumentParser(description="SIH26158 ingestion pipeline")
    ap.add_argument("--video", required=True, type=Path)
    ap.add_argument("--telemetry", type=Path, default=None,
                    help="SRT or exiftool CSV; if omitted auto-extracts from video")
    ap.add_argument("--out-dir", type=Path, default=Path("data/frames"))
    ap.add_argument("--fps", type=float, default=3.0,
                    help="Target extraction FPS (default 3)")
    ap.add_argument("--blur-threshold", type=float, default=80.0,
                    help="Laplacian variance cutoff (default 80)")
    ap.add_argument("--min-dist-m", type=float, default=0.5,
                    help="Min GPS distance between kept frames (default 0.5 m)")
    ap.add_argument("--skip-georef", action="store_true",
                     help="No GPS in the source video — skip telemetry parsing and "
                          "geotagging, extract frames by time interval instead.")
    args = ap.parse_args()

    run(
        video_path=args.video,
        out_dir=args.out_dir,
        telemetry_source=args.telemetry,
        target_fps=args.fps,
        blur_threshold=args.blur_threshold,
        min_dist_m=args.min_dist_m,
        skip_georef=args.skip_georef,
    )


if __name__ == "__main__":
    main()
