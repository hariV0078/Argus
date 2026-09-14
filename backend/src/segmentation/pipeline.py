"""
Phase 4 segmentation pipeline — orchestrates:
  4a. dynamic_masker      → COLMAP mask PNGs (blocks cars/people from SfM)
  4b. semantic_segmenter  → per-frame label maps (subsample)
  4c. label_projector     → 3D label transfer onto point cloud

Usage:
  conda run -n recon python -m src.segmentation.pipeline \
      --manifest data/frames/manifest.csv \
      --mask-dir data/masks \
      --semantic-dir data/semantic \
      --reconstruction data/sfm/sparse_geo \
      --dense-ply data/sfm/dense.ply \
      --sam2-weights tools/sam2_weights/sam2.1_hiera_large.pt \
      --out-ply data/output/pointcloud/dense_labelled.ply

Step 4a must run BEFORE reconstruction (masks feed into COLMAP).
Steps 4b+4c run AFTER reconstruction (need camera poses).
"""

import argparse
import json
import time
from pathlib import Path

import pandas as pd

from .dynamic_masker   import generate_masks, summarise
from .semantic_segmenter import run_semantic_segmentation
from .label_projector  import project_labels


def run_masking(
    manifest_path: Path,
    mask_dir: Path,
    yolo_weights: Path | str = "yolov8x-seg.pt",
    confidence: float = 0.4,
    dilation_px: int = 5,
    batch_size: int = 4,
) -> pd.DataFrame:
    """
    4a — Generate dynamic masks for all frames.
    Run BEFORE COLMAP feature extraction.
    Returns updated manifest with 'mask_path' column.
    """
    manifest = pd.read_csv(manifest_path)
    print(f"\n[4a] Generating COLMAP masks for {len(manifest)} frames...")
    t0 = time.time()
    manifest = generate_masks(
        frame_df=manifest,
        mask_dir=mask_dir,
        model_path=yolo_weights,
        confidence=confidence,
        dilation_px=dilation_px,
        batch_size=batch_size,
    )
    stats = summarise(manifest)
    elapsed = time.time() - t0
    print(f"[4a] Done in {elapsed:.1f}s  "
          f"avg_masked={stats.get('masked_pct', 0):.1f}%")

    # Save updated manifest so reconstruction pipeline picks up mask_path
    manifest.to_csv(manifest_path, index=False)
    print(f"[4a] Manifest updated → {manifest_path}")
    return manifest


def run_semantic(
    manifest_path: Path,
    semantic_dir: Path,
    sam2_weights: Path,
    subsample_every: int = 10,
    confidence: float = 0.25,
) -> dict[str, Path]:
    """
    4b — Zero-shot semantic segmentation on subsampled frames.
    Run AFTER reconstruction (does not depend on camera poses directly).
    """
    manifest = pd.read_csv(manifest_path)
    frame_paths = [Path(p) for p in manifest["frame_path"]]
    print(f"\n[4b] Semantic segmentation on "
          f"{len(frame_paths)//subsample_every} frames "
          f"(every {subsample_every}th)...")
    t0 = time.time()
    semantic_map = run_semantic_segmentation(
        frame_paths=frame_paths,
        out_dir=semantic_dir,
        sam2_weights=sam2_weights,
        subsample_every=subsample_every,
        confidence=confidence,
    )
    elapsed = time.time() - t0
    print(f"[4b] Done in {elapsed:.1f}s  ({len(semantic_map)} frames labelled)")

    # Persist semantic map as JSON for the projector
    smap_path = semantic_dir / "semantic_map.json"
    smap_path.write_text(
        json.dumps({k: str(v) for k, v in semantic_map.items()}, indent=2)
    )
    return semantic_map


def run_projection(
    reconstruction_dir: Path,
    dense_ply: Path,
    semantic_dir: Path,
    out_ply: Path,
) -> Path:
    """
    4c — Project 2D semantic labels onto the 3D point cloud.
    Run AFTER 4b.
    """
    # Load semantic map from JSON
    smap_path = semantic_dir / "semantic_map.json"
    if not smap_path.exists():
        raise FileNotFoundError(
            f"Semantic map not found at {smap_path}. Run step 4b first."
        )
    import json
    raw = json.loads(smap_path.read_text())
    semantic_map = {k: Path(v) for k, v in raw.items()}

    print(f"\n[4c] Projecting labels onto {dense_ply.name}...")
    t0 = time.time()
    out = project_labels(
        reconstruction_dir=reconstruction_dir,
        dense_ply=dense_ply,
        semantic_map=semantic_map,
        out_ply=out_ply,
    )
    elapsed = time.time() - t0
    print(f"[4c] Done in {elapsed:.1f}s  → {out}")
    return out


def main():
    ap = argparse.ArgumentParser(description="Phase 4: segmentation pipeline")
    ap.add_argument("--manifest",       required=True, type=Path)
    ap.add_argument("--mask-dir",       type=Path, default=Path("data/masks"))
    ap.add_argument("--semantic-dir",   type=Path, default=Path("data/semantic"))
    ap.add_argument("--reconstruction", type=Path, default=Path("data/sfm/sparse_geo"))
    ap.add_argument("--dense-ply",      type=Path, default=Path("data/sfm/dense.ply"))
    ap.add_argument("--sam2-weights",   type=Path,
                    default=Path("tools/sam2_weights/sam2.1_hiera_large.pt"))
    ap.add_argument("--out-ply",        type=Path,
                    default=Path("data/output/pointcloud/dense_labelled.ply"))
    ap.add_argument("--yolo-weights",   type=Path,
                    default=Path("tools/yolo_weights/yolov8x-seg.pt"))
    ap.add_argument("--subsample",      type=int, default=10)
    ap.add_argument("--mask-only",      action="store_true",
                    help="Only run 4a (masks), skip 4b+4c — use before reconstruction")
    ap.add_argument("--semantic-only",  action="store_true",
                    help="Only run 4b+4c — use after reconstruction")
    args = ap.parse_args()

    if not args.semantic_only:
        run_masking(
            manifest_path=args.manifest,
            mask_dir=args.mask_dir,
            yolo_weights=args.yolo_weights,
        )

    if not args.mask_only:
        semantic_map = run_semantic(
            manifest_path=args.manifest,
            semantic_dir=args.semantic_dir,
            sam2_weights=args.sam2_weights,
            subsample_every=args.subsample,
        )
        run_projection(
            reconstruction_dir=args.reconstruction,
            dense_ply=args.dense_ply,
            semantic_dir=args.semantic_dir,
            out_ply=args.out_ply,
        )


if __name__ == "__main__":
    main()
