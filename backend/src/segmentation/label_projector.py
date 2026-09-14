"""
Phase 4c — 2D semantic label → 3D point cloud projection.

For each 3D point in the COLMAP sparse reconstruction, finds all 2D observations
(image + pixel), looks up the semantic label at that pixel, and votes for the
most-common label. Result: each 3D point gains a semantic class.

Uses pycolmap to read camera poses + intrinsics directly.

Output: labelled PLY where:
  scalar field  "label"        0-5 semantic class
  RGB           painted with LABEL_COLOURS for viewer compat
"""

from pathlib import Path
from collections import Counter

import numpy as np
import open3d as o3d
import cv2
import pycolmap
from tqdm import tqdm

LABEL_COLOURS = np.array([
    [0,   0,   0  ],  # 0 background
    [255, 128, 0  ],  # 1 building
    [128, 128, 128],  # 2 road
    [0,   200, 0  ],  # 3 vegetation
    [255, 0,   0  ],  # 4 vehicle
    [139, 90,  43 ],  # 5 terrain
], dtype=np.uint8)


def _load_label_maps(semantic_map: dict[str, Path]) -> dict[str, np.ndarray]:
    """Load all label PNG files into memory."""
    loaded = {}
    for frame_path, label_path in semantic_map.items():
        lm = cv2.imread(str(label_path), cv2.IMREAD_GRAYSCALE)
        if lm is not None:
            loaded[str(Path(frame_path).name)] = lm
    print(f"  [projector] Loaded {len(loaded)} semantic label maps")
    return loaded


def project_labels(
    reconstruction_dir: Path,
    dense_ply: Path,
    semantic_map: dict[str, Path],
    out_ply: Path,
) -> Path:
    """
    Project semantic labels from 2D frames onto the dense 3D point cloud.

    Strategy:
      1. Use the COLMAP sparse model to get camera poses + point 3D→2D tracks
      2. For each track observation, look up the label at that (image, pixel)
      3. Majority vote per 3D point
      4. For dense cloud points (not in sparse), find nearest sparse point label

    Args:
        reconstruction_dir: path to COLMAP sparse model (sparse_geo/)
        dense_ply:          path to stereo_fusion dense point cloud
        semantic_map:       {frame_path: label_map_path} from semantic_segmenter
        out_ply:            where to write the labelled PLY

    Returns:
        out_ply path
    """
    out_ply = Path(out_ply)
    out_ply.parent.mkdir(parents=True, exist_ok=True)

    # Load COLMAP reconstruction
    recon = pycolmap.Reconstruction(str(reconstruction_dir))
    label_maps = _load_label_maps(semantic_map)

    if not label_maps:
        print("  [projector] No label maps found — copying PLY without labels")
        import shutil
        shutil.copy2(dense_ply, out_ply)
        return out_ply

    # ── Step 1: vote labels on sparse 3D points ──────────────────────────
    print(f"  [projector] Voting labels on {recon.num_points3D()} sparse points...")

    sparse_pts = {}  # point3D_id → {'xyz': np.array, 'votes': Counter}
    for pt3d_id, pt3d in recon.points3D.items():
        sparse_pts[pt3d_id] = {
            "xyz":   np.array(pt3d.xyz),
            "votes": Counter(),
        }

    for img_id, image in tqdm(recon.images.items(), desc="voting"):
        img_name = image.name
        if img_name not in label_maps:
            continue

        label_map = label_maps[img_name]
        lh, lw = label_map.shape

        camera = recon.cameras[image.camera_id]
        # Camera intrinsics (OPENCV model: fx,fy,cx,cy,k1,k2,p1,p2)
        params = camera.params
        fx, fy = params[0], params[1]
        cx, cy = params[2], params[3]

        # World→camera transform (pycolmap ≥ 4.x: cam_from_world replaces rotation_matrix/tvec)
        _pose = image.cam_from_world()
        R = _pose.rotation.matrix()
        t = _pose.translation

        for p2d in image.points2D:
            if p2d.point3D_id == pycolmap.INVALID_POINT3D_ID:
                continue
            pt3d_id = p2d.point3D_id
            if pt3d_id not in sparse_pts:
                continue

            # 2D pixel in image
            px = int(round(p2d.xy[0]))
            py = int(round(p2d.xy[1]))

            # Clamp to label map dims (might differ if resized)
            px_s = int(px * lw / camera.width)
            py_s = int(py * lh / camera.height)

            if 0 <= px_s < lw and 0 <= py_s < lh:
                label = int(label_map[py_s, px_s])
                if label > 0:
                    sparse_pts[pt3d_id]["votes"][label] += 1

    # Resolve votes for sparse points
    sparse_labels: dict[int, int] = {}
    for pt3d_id, data in sparse_pts.items():
        if data["votes"]:
            sparse_labels[pt3d_id] = data["votes"].most_common(1)[0][0]
        else:
            sparse_labels[pt3d_id] = 0

    # ── Step 2: transfer labels to dense cloud via nearest sparse point ──
    print(f"  [projector] Transferring to dense cloud {dense_ply} ...")

    dense_pcd = o3d.io.read_point_cloud(str(dense_ply))
    dense_pts = np.asarray(dense_pcd.points)

    # Build KD-tree on labelled sparse points
    labelled_ids = [pid for pid, lbl in sparse_labels.items() if lbl > 0]
    if not labelled_ids:
        print("  [projector] No labelled sparse points — check semantic subsample rate")
        import shutil
        shutil.copy2(dense_ply, out_ply)
        return out_ply

    sparse_xyz   = np.array([sparse_pts[pid]["xyz"] for pid in labelled_ids])
    sparse_lbl   = np.array([sparse_labels[pid]     for pid in labelled_ids])

    sparse_pcd_sub = o3d.geometry.PointCloud()
    sparse_pcd_sub.points = o3d.utility.Vector3dVector(sparse_xyz)
    kdtree = o3d.geometry.KDTreeFlann(sparse_pcd_sub)

    dense_labels = np.zeros(len(dense_pts), dtype=np.uint8)
    for i, pt in enumerate(tqdm(dense_pts, desc="knn-transfer", mininterval=2)):
        _, idx, _ = kdtree.search_knn_vector_3d(pt, 1)
        dense_labels[i] = sparse_lbl[idx[0]]

    # ── Step 3: paint dense cloud + write ────────────────────────────────
    colours = LABEL_COLOURS[dense_labels.clip(0, len(LABEL_COLOURS) - 1)]
    dense_pcd.colors = o3d.utility.Vector3dVector(colours.astype(np.float64) / 255.0)

    # Write PLY with label as custom scalar
    # open3d doesn't support custom scalar fields, so embed label in blue channel
    # and write raw PLY manually for full compatibility
    _write_labelled_ply(out_ply, dense_pts, colours, dense_labels,
                        np.asarray(dense_pcd.normals) if dense_pcd.has_normals() else None)

    print(f"  [projector] Labelled PLY → {out_ply}  "
          f"({len(dense_pts):,} points)")
    return out_ply


def _write_labelled_ply(
    path: Path,
    points: np.ndarray,
    colours: np.ndarray,
    labels: np.ndarray,
    normals: np.ndarray | None,
) -> None:
    """Write PLY with per-point label scalar field (CloudCompare / MeshLab compatible)."""
    has_normals = normals is not None and len(normals) == len(points)
    n = len(points)

    normal_header = "property float nx\nproperty float ny\nproperty float nz\n" if has_normals else ""
    header = (
        "ply\n"
        "format binary_little_endian 1.0\n"
        f"element vertex {n}\n"
        "property float x\nproperty float y\nproperty float z\n"
        + normal_header +
        "property uchar red\nproperty uchar green\nproperty uchar blue\n"
        "property uchar label\n"
        "end_header\n"
    )

    import struct
    with open(path, "wb") as f:
        f.write(header.encode())
        for i in range(n):
            x, y, z = points[i]
            r, g, b = colours[i]
            lbl = labels[i]
            if has_normals:
                nx, ny, nz = normals[i]
                f.write(struct.pack("<ffffffBBBB", x, y, z, nx, ny, nz, r, g, b, lbl))
            else:
                f.write(struct.pack("<fffBBBB", x, y, z, r, g, b, lbl))
