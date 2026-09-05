"""
Reconstruction pipeline — single entry point.

Usage:
  conda run -n recon python -m src.reconstruction.pipeline \
      --frames data/frames \
      --manifest data/frames/manifest.csv \
      --workspace data/sfm \
      --out-dir data/output
"""

import argparse
import json
import time
from pathlib import Path

import pandas as pd

from .colmap_runner import run as run_colmap
from src.export.exporter import run_all as export_all


def run(
    frames_dir: Path,
    manifest_path: Path,
    workspace: Path,
    out_dir: Path,
    sequential_overlap: int = 10,
    utm_epsg: int = 32644,
    dsm_resolution_m: float = 0.1,
    use_gpu: bool = True,
) -> dict:
    t0 = time.time()

    manifest = pd.read_csv(manifest_path)
    print(f"\n[reconstruction] {len(manifest)} frames  workspace={workspace}")

    # COLMAP: SfM + dense + mesh
    colmap_outputs = run_colmap(
        image_dir=frames_dir,
        workspace=workspace,
        manifest=manifest,
        sequential_overlap=sequential_overlap,
        use_gpu=use_gpu,
    )

    # Export all required formats
    export_results = export_all(
        dense_ply=colmap_outputs["dense_ply"],
        mesh_ply=colmap_outputs["mesh_ply"],
        out_root=out_dir,
        utm_epsg=utm_epsg,
        dsm_resolution_m=dsm_resolution_m,
    )

    elapsed = time.time() - t0
    summary = {
        "elapsed_s": round(elapsed, 1),
        "elapsed_min": round(elapsed / 60, 1),
        "colmap": {k: str(v) for k, v in colmap_outputs.items()},
        "exports": {k: str(v) if v else None for k, v in export_results.items()},
    }
    (out_dir / "reconstruction_summary.json").write_text(
        json.dumps(summary, indent=2)
    )
    print(f"\n[reconstruction] Done in {elapsed/60:.1f} min")
    return summary


def main():
    ap = argparse.ArgumentParser(description="SIH26158 reconstruction pipeline")
    ap.add_argument("--frames",   required=True, type=Path)
    ap.add_argument("--manifest", required=True, type=Path)
    ap.add_argument("--workspace", type=Path, default=Path("data/sfm"))
    ap.add_argument("--out-dir",   type=Path, default=Path("data/output"))
    ap.add_argument("--overlap", type=int, default=10)
    ap.add_argument("--utm-epsg", type=int, default=32644)
    ap.add_argument("--dsm-res-m", type=float, default=0.1)
    ap.add_argument("--no-gpu", action="store_true")
    args = ap.parse_args()

    run(
        frames_dir=args.frames,
        manifest_path=args.manifest,
        workspace=args.workspace,
        out_dir=args.out_dir,
        sequential_overlap=args.overlap,
        utm_epsg=args.utm_epsg,
        dsm_resolution_m=args.dsm_res_m,
        use_gpu=not args.no_gpu,
    )


if __name__ == "__main__":
    main()
