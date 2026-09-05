"""
Phase 4b — Zero-shot semantic segmentation via YOLO-World + SAM2.

Uses YOLO-World (open-vocabulary detection, ultralytics >=8.1) to get bounding
boxes for text prompts, then SAM2 to refine to pixel-accurate masks.

Labels produced:
  0  background
  1  building
  2  road / pavement
  3  vegetation / tree
  4  vehicle (car/bus/truck)
  5  terrain / ground

Run on a subsample of frames (every N-th) for speed — labels are projected
onto the 3D model in the next step using camera poses.

Falls back to YOLO-World detection boxes only if SAM2 raises an error.
"""

from pathlib import Path
from typing import Sequence
import time

import cv2
import numpy as np
import torch
from tqdm import tqdm
from ultralytics import YOLO


SEMANTIC_LABELS = {
    "building":         1,
    "road":             2,
    "pavement":         2,
    "tree":             3,
    "vegetation":       3,
    "grass":            3,
    "car":              4,
    "bus":              4,
    "truck":            4,
    "vehicle":          4,
    "terrain":          5,
    "ground":           5,
    "roof":             1,
    "wall":             1,
}

LABEL_NAMES = {0: "background", 1: "building", 2: "road",
               3: "vegetation", 4: "vehicle", 5: "terrain"}

TEXT_PROMPTS = list(SEMANTIC_LABELS.keys())


def _load_sam2(weights_path: Path, config_name: str = "configs/sam2.1/sam2.1_hiera_l.yaml"):
    """Load SAM2 image predictor."""
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor

    device = "cuda" if torch.cuda.is_available() else "cpu"
    predictor = SAM2ImagePredictor(
        build_sam2(config_name, str(weights_path), device=device)
    )
    return predictor


def _boxes_to_sam2_masks(
    predictor,
    img_rgb: np.ndarray,
    boxes_xyxy: np.ndarray,
) -> np.ndarray:
    """
    Run SAM2 for a batch of prompt boxes.
    Returns (N, H, W) bool array — one mask per box.
    """
    predictor.set_image(img_rgb)
    masks, _, _ = predictor.predict(
        point_coords=None,
        point_labels=None,
        box=boxes_xyxy,
        multimask_output=False,
    )
    # masks shape: (N, 1, H, W) → (N, H, W)
    return masks[:, 0, :, :] if masks.ndim == 4 else masks


def segment_frame(
    img_bgr: np.ndarray,
    yolo_world: YOLO,
    sam2_predictor,
    confidence: float = 0.25,
) -> np.ndarray:
    """
    Segment a single frame into semantic label map.

    Returns uint8 ndarray (H, W) with label IDs 0-5.
    """
    h, w = img_bgr.shape[:2]
    label_map = np.zeros((h, w), dtype=np.uint8)
    priority  = np.zeros((h, w), dtype=np.uint8)  # higher = drawn on top

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    results = yolo_world(
        img_bgr,
        conf=confidence,
        verbose=False,
    )
    if not results or results[0].boxes is None:
        return label_map

    boxes = results[0].boxes
    if len(boxes) == 0:
        return label_map

    boxes_xyxy = boxes.xyxy.cpu().numpy()
    class_ids  = boxes.cls.cpu().numpy().astype(int)
    class_names = [yolo_world.names[c] for c in class_ids]

    # Map YOLO-World class names → our label IDs
    label_ids = [SEMANTIC_LABELS.get(name.lower(), 0) for name in class_names]

    # Filter to only boxes we care about
    valid = [(i, lid) for i, lid in enumerate(label_ids) if lid > 0]
    if not valid:
        return label_map

    valid_idx = [i for i, _ in valid]
    valid_boxes = boxes_xyxy[valid_idx]
    valid_labels = [lid for _, lid in valid]

    # SAM2 refinement
    try:
        sam_masks = _boxes_to_sam2_masks(sam2_predictor, img_rgb, valid_boxes)
        for mask, label_id in zip(sam_masks, valid_labels):
            # Higher label_id = higher priority (vehicles over roads, etc.)
            update = (mask > 0) & (priority < label_id)
            label_map[update] = label_id
            priority[update]  = label_id
    except Exception as e:
        # Fall back to filled bounding boxes
        for box, label_id in zip(valid_boxes, valid_labels):
            x1, y1, x2, y2 = map(int, box)
            label_map[y1:y2, x1:x2] = label_id

    return label_map


def run_semantic_segmentation(
    frame_paths: list[Path],
    out_dir: Path,
    sam2_weights: Path,
    subsample_every: int = 10,
    confidence: float = 0.25,
    device: str | None = None,
) -> dict[str, Path]:
    """
    Run semantic segmentation on every N-th frame.

    Args:
        frame_paths:      list of frame image paths
        out_dir:          where to save label PNG maps
        sam2_weights:     path to sam2.1_hiera_large.pt
        subsample_every:  process 1-in-N frames (speed budget)

    Returns:
        dict mapping frame_path string → label_map_path
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    # YOLO-World model (open-vocabulary)
    yolo_world = YOLO("yolov8x-worldv2.pt")
    yolo_world.set_classes(TEXT_PROMPTS)

    sam2_predictor = _load_sam2(sam2_weights)

    sampled = frame_paths[::subsample_every]
    print(f"  [semantic] Processing {len(sampled)}/{len(frame_paths)} frames "
          f"(every {subsample_every}th)")

    result_map: dict[str, Path] = {}
    t0 = time.time()
    for i, fp in enumerate(tqdm(sampled, desc="semantic-seg")):
        img_bgr = cv2.imread(str(fp))
        if img_bgr is None:
            continue

        label_map = segment_frame(img_bgr, yolo_world, sam2_predictor, confidence)

        out_name = Path(fp).stem + "_semantic.png"
        out_path = out_dir / out_name
        cv2.imwrite(str(out_path), label_map)
        result_map[str(fp)] = out_path

    elapsed = time.time() - t0
    print(f"  [semantic] Done. {len(result_map)} frames in {elapsed:.1f}s  "
          f"({elapsed/max(len(result_map),1):.1f}s/frame)")
    return result_map


def colorise(label_map: np.ndarray) -> np.ndarray:
    """Convert label map to colour image for visualisation."""
    palette = np.array([
        [0,   0,   0  ],  # 0 background  black
        [255, 128, 0  ],  # 1 building     orange
        [128, 128, 128],  # 2 road         grey
        [0,   200, 0  ],  # 3 vegetation   green
        [255, 0,   0  ],  # 4 vehicle      red
        [139, 90,  43 ],  # 5 terrain      brown
    ], dtype=np.uint8)
    h, w = label_map.shape
    colour = np.zeros((h, w, 3), dtype=np.uint8)
    for lid, rgb in enumerate(palette):
        colour[label_map == lid] = rgb
    return colour
