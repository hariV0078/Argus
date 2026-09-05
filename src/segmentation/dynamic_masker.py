"""
Phase 4a — Dynamic object masking via YOLOv8-seg.

Produces COLMAP-compatible mask images alongside each frame:
  frames/00001.jpg  →  masks/00001.jpg.png

COLMAP mask convention: pixel > 0 = IGNORE during feature extraction.
So we paint detected dynamic objects white (255) and everything else black (0).

COCO classes masked (dynamic objects that corrupt SfM):
  0  person       2  car         3  motorcycle
  5  bus          7  truck       16 dog
  1  bicycle      14 bird        15 cat

Run this BEFORE colmap feature_extractor.
"""

from pathlib import Path
import time
from typing import Sequence

import cv2
import numpy as np
import pandas as pd
import torch
from tqdm import tqdm
from ultralytics import YOLO


DYNAMIC_CLASSES = [0, 1, 2, 3, 5, 7, 14, 15, 16]  # person,bicycle,car,motorcycle,bus,truck,bird,cat,dog


def _build_mask(
    frame_hw: tuple[int, int],
    results,
    dilation_px: int = 5,
) -> np.ndarray:
    """Return uint8 mask (255=ignore) from a YOLO result."""
    h, w = frame_hw
    mask = np.zeros((h, w), dtype=np.uint8)

    if results.masks is None:
        return mask

    for seg_mask in results.masks.data:  # (H', W') float32 tensors on GPU
        m = seg_mask.cpu().numpy()
        m_resized = cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST)
        mask = np.maximum(mask, (m_resized > 0.5).astype(np.uint8) * 255)

    if dilation_px > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (dilation_px * 2 + 1, dilation_px * 2 + 1)
        )
        mask = cv2.dilate(mask, kernel)

    return mask


def generate_masks(
    frame_df: pd.DataFrame,
    mask_dir: Path,
    model_path: Path | str = "yolov8x-seg.pt",
    classes: Sequence[int] = DYNAMIC_CLASSES,
    confidence: float = 0.4,
    dilation_px: int = 5,
    device: str | None = None,
    batch_size: int = 4,
) -> pd.DataFrame:
    """
    Run YOLO-seg on all frames and write COLMAP-format mask PNGs.

    Args:
        frame_df:   manifest from ingestion (must have 'frame_path' column)
        mask_dir:   output directory for masks
        model_path: path to yolov8x-seg.pt (or model name for auto-download)
        classes:    COCO class IDs to mask
        confidence: YOLO detection confidence threshold
        dilation_px: dilate masks by N pixels to cover edges

    Returns:
        Updated frame_df with 'mask_path' column added.
    """
    mask_dir = Path(mask_dir)
    mask_dir.mkdir(parents=True, exist_ok=True)

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    model = YOLO(str(model_path))

    frame_paths = [Path(p) for p in frame_df["frame_path"]]
    mask_paths  = []
    masked_counts = []

    t0 = time.time()
    for i in range(0, len(frame_paths), batch_size):
        batch = frame_paths[i : i + batch_size]
        batch_imgs = [str(p) for p in batch]

        results = model(
            batch_imgs,
            classes=list(classes),
            conf=confidence,
            device=device,
            verbose=False,
            stream=False,
        )

        for frame_path, res in zip(batch, results):
            h, w = res.orig_shape
            mask = _build_mask((h, w), res, dilation_px)

            # COLMAP mask filename: <image_name>.png
            mask_name = frame_path.name + ".png"
            mask_path = mask_dir / mask_name
            cv2.imwrite(str(mask_path), mask)

            n_masked = (mask > 0).sum()
            pct = n_masked / (h * w) * 100
            masked_counts.append(pct)
            mask_paths.append(str(mask_path))

        if (i // batch_size) % 10 == 0:
            elapsed = time.time() - t0
            fps = (i + len(batch)) / max(elapsed, 0.001)
            print(f"  [masker] {i+len(batch)}/{len(frame_paths)} frames  "
                  f"{fps:.1f} fps  avg_masked={np.mean(masked_counts):.1f}%",
                  end="\r")

    print(f"\n  [masker] Done. Avg masked area: {np.mean(masked_counts):.1f}%  "
          f"Masks → {mask_dir}")

    frame_df = frame_df.copy()
    frame_df["mask_path"] = mask_paths
    return frame_df


def summarise(frame_df: pd.DataFrame) -> dict:
    """Quick stats on how much area is masked per frame."""
    if "mask_path" not in frame_df.columns:
        return {}
    total, masked = 0, 0
    for p in frame_df["mask_path"]:
        m = cv2.imread(str(p), cv2.IMREAD_GRAYSCALE)
        if m is not None:
            total  += m.size
            masked += (m > 0).sum()
    return {
        "total_pixels": total,
        "masked_pixels": masked,
        "masked_pct": masked / total * 100 if total else 0,
    }
