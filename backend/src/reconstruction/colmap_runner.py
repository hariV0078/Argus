"""
COLMAP full pipeline via pycolmap Python API.

No subprocess / binary needed — pycolmap 4.2 bundles everything.

Stages:
  1. extract_features     — GPU SIFT on all frames
  2. match_sequential     — match consecutive frames (video-optimal)
  3. incremental_mapping  — SfM → sparse point cloud
  4. align_to_gps         — GPS geo-registration
  5. patch_match_stereo   — GPU dense depth maps
  6. stereo_fusion        — fuse depths → dense PLY
  7. poisson_meshing      — surface reconstruction → mesh PLY
"""

import shutil
from pathlib import Path

import numpy as np
import pandas as pd
import pycolmap
from pycolmap import logging as colmap_logging


def _largest_reconstruction(recon_map) -> pycolmap.Reconstruction:
    """Pick the sub-model with the most registered images."""
    best = max(recon_map.values(), key=lambda r: r.num_reg_images())
    print(f"  [colmap] Best model: {best.num_reg_images()} images, "
          f"{best.num_points3D()} 3-D points")
    return best


# ── Stage 1+2: feature extraction + sequential matching ──────────────────

def extract_and_match(
    db_path: Path,
    image_dir: Path,
    sequential_overlap: int = 10,
    use_gpu: bool = True,
    mask_dir: Path | None = None,
) -> None:
    device = pycolmap.Device.cuda if use_gpu and pycolmap.has_cuda else pycolmap.Device.cpu

    # pycolmap ≥ 4.x: SiftExtractionOptions is nested inside FeatureExtractionOptions
    extract_opts = pycolmap.FeatureExtractionOptions()
    extract_opts.sift.max_num_features = 8192
    extract_opts.max_image_size = 3200
    extract_opts.use_gpu = use_gpu and pycolmap.has_cuda
    extract_opts.num_threads = 4  # cap threads to avoid OOM (default -1 uses all cores)

    reader_opts = pycolmap.ImageReaderOptions()
    reader_opts.camera_model = "OPENCV"
    # single_camera removed in pycolmap ≥ 4.x; use CameraMode.SINGLE instead
    if mask_dir is not None and Path(mask_dir).is_dir():
        reader_opts.mask_path = str(mask_dir)
        print(f"  [colmap] Using dynamic masks from {mask_dir}")

    # Only pass image files — exclude manifest.csv and any other non-image files
    _IMG_EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
    image_names = sorted(
        f.name for f in Path(image_dir).iterdir()
        if f.suffix.lower() in _IMG_EXTS
    )
    print(f"  [colmap] Extracting features from {len(image_names)} images...")
    pycolmap.extract_features(
        database_path=db_path,
        image_path=image_dir,
        image_names=image_names,
        camera_mode=pycolmap.CameraMode.SINGLE,
        reader_options=reader_opts,
        extraction_options=extract_opts,
        device=device,
    )

    seq_opts = pycolmap.SequentialPairingOptions()
    seq_opts.overlap = sequential_overlap
    seq_opts.loop_detection = False  # requires vocab tree download; unnecessary for short videos

    # pycolmap ≥ 4.x: SiftMatchingOptions → FeatureMatchingOptions
    match_opts = pycolmap.FeatureMatchingOptions()

    print("  [colmap] Sequential matching...")
    pycolmap.match_sequential(
        database_path=db_path,
        matching_options=match_opts,
        pairing_options=seq_opts,
        device=device,
    )


# ── Stage 3: incremental SfM ──────────────────────────────────────────────

def run_mapper(
    db_path: Path,
    image_dir: Path,
    sparse_dir: Path,
) -> pycolmap.Reconstruction:
    sparse_dir.mkdir(parents=True, exist_ok=True)

    mapper_opts = pycolmap.IncrementalPipelineOptions()
    mapper_opts.min_num_matches = 15

    print("  [colmap] Incremental mapping (SfM)...")
    recon_map = pycolmap.incremental_mapping(
        database_path=db_path,
        image_path=image_dir,
        output_path=sparse_dir,
        options=mapper_opts,
    )

    if not recon_map:
        raise RuntimeError(
            "Mapper produced no reconstruction. "
            "Check frame overlap (need >= 60%) and blur threshold."
        )

    return _largest_reconstruction(recon_map)


# ── Stage 4: GPS geo-registration ─────────────────────────────────────────

def align_to_gps(
    reconstruction: pycolmap.Reconstruction,
    manifest: pd.DataFrame,
    sparse_geo_dir: Path,
) -> pycolmap.Reconstruction:
    """
    Align sparse reconstruction to GPS.
    Converts WGS84 lat/lon/alt → ECEF (EPSG:4978) before alignment so that
    the resulting reconstruction is in metric ECEF space, not geographic degrees.
    This ensures the dense PLY is in ECEF and can be reprojected to UTM correctly.
    """
    import pyproj as _pyproj

    sparse_geo_dir.mkdir(parents=True, exist_ok=True)

    # Build {image_name: [lat, lon, alt]} lookup
    gps_lookup: dict[str, list[float]] = {}
    for _, row in manifest.iterrows():
        name = Path(row["frame_path"]).name
        gps_lookup[name] = [row["lat"], row["lon"], row["alt_m"]]

    # Only keep entries that exist in reconstruction
    reg_names = {img.name for img in reconstruction.images.values()}
    matched = {k: v for k, v in gps_lookup.items() if k in reg_names}

    if len(matched) < 3:
        raise RuntimeError(
            f"Only {len(matched)} frames matched GPS — need >= 3. "
            "Check that frame filenames match the manifest."
        )

    # Convert lat/lon/alt → ECEF (X,Y,Z in metres from Earth centre)
    # MUST be ECEF so the Sim3d maps reconstruction → metric space (not lat/lon)
    _geo2ecef = _pyproj.Transformer.from_crs("EPSG:4326", "EPSG:4978", always_xy=True)
    image_names = list(matched.keys())
    lats  = [matched[k][0] for k in image_names]
    lons  = [matched[k][1] for k in image_names]
    alts  = [matched[k][2] for k in image_names]
    x_ecef, y_ecef, z_ecef = _geo2ecef.transform(lons, lats, alts)  # always_xy → (lon,lat,alt)
    locations_ecef = np.column_stack([x_ecef, y_ecef, z_ecef])

    print(f"  [colmap] Aligning {len(matched)} frames to GPS (ECEF)...")
    ransac_opts = pycolmap.RANSACOptions()
    ransac_opts.max_error = 5.0     # 5 m GPS tolerance (ECEF metres)
    sim3 = pycolmap.align_reconstruction_to_locations(
        src=reconstruction,
        tgt_image_names=image_names,
        tgt_locations=locations_ecef,
        min_common_images=3,
        ransac_options=ransac_opts,
    )
    if sim3 is None:
        raise RuntimeError(
            "GPS alignment failed — fewer than 3 inliers. "
            "Check that frame filenames match the manifest and GPS has < 5 m error."
        )
    reconstruction.transform(sim3)
    print(f"  [colmap] Geo-alignment OK (scale={sim3.scale:.6f})")

    reconstruction.write(str(sparse_geo_dir))
    return sim3, reconstruction


# ── Stage 5+6: dense MVS ──────────────────────────────────────────────────

def run_dense(
    reconstruction: pycolmap.Reconstruction,
    image_dir: Path,
    dense_dir: Path,
    dense_ply: Path,
    use_gpu: bool = True,
    max_image_size: int = 2000,
) -> None:
    dense_dir.mkdir(parents=True, exist_ok=True)

    # Write COLMAP workspace layout that patch_match_stereo expects
    ws_sparse = dense_dir / "sparse"
    ws_images = dense_dir / "images"

    ws_sparse.mkdir(parents=True, exist_ok=True)
    reconstruction.write(str(ws_sparse))

    if not ws_images.exists():
        ws_images.symlink_to(image_dir.resolve())

    # pycolmap built without CUDA → use the COLMAP CLI binary (which has CUDA)
    import shutil as _shutil
    import subprocess as _sub
    colmap_bin = _shutil.which("colmap") or "colmap"

    print("  [colmap] Undistorting images for dense stereo...")
    _sub.run([
        colmap_bin, "image_undistorter",
        "--image_path", str(image_dir),
        "--input_path", str(ws_sparse),
        "--output_path", str(dense_dir),
        "--output_type", "COLMAP",
    ], check=True)

    # Pass 1: photometric depth maps
    print("  [colmap] Dense depth maps — photometric pass...")
    _sub.run([
        colmap_bin, "patch_match_stereo",
        "--workspace_path", str(dense_dir),
        "--workspace_format", "COLMAP",
        "--PatchMatchStereo.depth_min", "0.1",
        "--PatchMatchStereo.depth_max", "500.0",
        "--PatchMatchStereo.window_radius", "5",
        "--PatchMatchStereo.num_samples", "15",
        "--PatchMatchStereo.num_iterations", "5",
        "--PatchMatchStereo.gpu_index", "0",
        "--PatchMatchStereo.max_image_size", str(max_image_size),
    ], check=True)

    # Pass 2: geometric consistency filtering (required for stereo_fusion)
    print("  [colmap] Dense depth maps — geometric consistency pass...")
    _sub.run([
        colmap_bin, "patch_match_stereo",
        "--workspace_path", str(dense_dir),
        "--workspace_format", "COLMAP",
        "--PatchMatchStereo.geom_consistency", "true",
        "--PatchMatchStereo.gpu_index", "0",
        "--PatchMatchStereo.max_image_size", str(max_image_size),
    ], check=True)

    print("  [colmap] Fusing depth maps (stereo_fusion)...")
    _sub.run([
        colmap_bin, "stereo_fusion",
        "--workspace_path", str(dense_dir),
        "--workspace_format", "COLMAP",
        "--input_type", "geometric",
        "--output_path", str(dense_ply),
        "--StereoFusion.min_num_pixels", "3",
        "--StereoFusion.max_reproj_error", "2.0",
    ], check=True)
    print(f"  [colmap] Dense PLY → {dense_ply}")


# ── Stage 7: Poisson mesh ─────────────────────────────────────────────────

def run_mesher(dense_ply: Path, mesh_ply: Path) -> None:
    """Poisson surface reconstruction via Open3D (handles normals estimation).

    Poisson always solves over a *cubic* octree domain sized off the point
    cloud's largest dimension (scale=1.1 around it) and produces a watertight
    closed surface — even for an aerial scan, which is fundamentally an open
    2.5D height field, not a closed solid. Left untrimmed, that shows up as
    exactly the "large rectangular block / flat vertical wall" artifact: the
    implicit function extrapolates a smooth cap through every region with no
    supporting points, and that invented geometry can be the *majority* of
    the mesh's volume. Standard fix (Kazhdan et al.'s own recommendation,
    also what COLMAP's `poisson_mesher --PoissonMeshing.trim` does):
      1. Use the per-vertex density Poisson already computes to drop the
         lowest-confidence (i.e. least point-supported / most extrapolated)
         vertices.
      2. Crop whatever's left to the point cloud's own bounding box (+2%
         margin) as a second guard against any remaining far-flung tails.
    """
    import open3d as _o3d
    print("  [colmap] Cleaning point cloud (statistical outlier removal)...")
    pcd = _o3d.io.read_point_cloud(str(dense_ply))
    pcd, _ = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)

    print("  [colmap] Estimating normals for Poisson meshing...")
    pcd.estimate_normals(
        search_param=_o3d.geometry.KDTreeSearchParamHybrid(radius=2.0, max_nn=30)
    )
    pcd.orient_normals_consistent_tangent_plane(k=15)

    print("  [colmap] Poisson meshing...")
    mesh, densities = _o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pcd, depth=10, width=0, scale=1.1, linear_fit=False
    )

    print("  [colmap] Trimming low-density (extrapolated) surface...")
    densities = np.asarray(densities)
    density_threshold = np.quantile(densities, 0.05)  # drop least-supported 5% of vertices
    mesh.remove_vertices_by_mask(densities < density_threshold)

    bbox = pcd.get_axis_aligned_bounding_box()
    bbox = bbox.scale(1.02, bbox.get_center())
    mesh = mesh.crop(bbox)

    mesh.remove_degenerate_triangles()
    mesh.remove_unreferenced_vertices()

    # ── Remove residual sliver triangles and floating fragments ────────────
    # Diagnosed by dumping the mesh at every stage (raw Poisson, post-trim,
    # post-crop) and measuring it directly: the density-trim above only
    # drops *vertices* below a global density quantile, so it can't catch a
    # triangle that survives with two "good" vertices and one degenerate
    # one, or a whole small patch that's internally consistent but
    # disconnected from the main surface. Open3D's own
    # remove_degenerate_triangles() only strips *exact* zero-area triangles
    # (duplicate vertex indices) — it does not catch near-zero-area slivers,
    # which measured up to 4.6e4:1 edge-length aspect ratio in this mesh
    # (triangle count: 2,247,723) despite that call. Those slivers are what
    # render as the "thin vertical slab" / "stretched planar surface"
    # artifact — a near-degenerate triangle's normal is numerically
    # ill-conditioned, so it can shade as a near-invisible sliver from one
    # angle and a huge bright streak from another. Separately, 228 of the
    # mesh's 470 connected components had under 10 triangles each (0.08% of
    # triangles total) — small disconnected islands of surface, unconnected
    # to the main reconstruction, that render as the "disconnected block"
    # artifact.
    #
    # Both are removed here by their actual geometric definition (near-zero
    # triangle area or a near-degenerate near-zero edge; component smaller
    # than a floor triangle count) rather than by re-tuning Poisson's
    # depth/scale, which doesn't touch either defect — thresholds are
    # derived from this mesh's own area/edge/size distribution, not
    # arbitrary constants.
    #
    # Area alone isn't a complete criterion: measured directly, a
    # 1e-3-of-median area floor still left triangles with a near-zero
    # *edge* (two nearly-coincident vertices, e.g. two points 0.1% of the
    # mesh's own median edge length apart) whose area happened to sit just
    # above that floor because the third vertex was far away — those are
    # exactly the needle-thin triangles behind the worst-case 4e11:1
    # aspect ratios actually measured here. A min-edge floor at 0.5% of the
    # mesh's own median edge length caught every one of them in that
    # measurement, at a cost of ~0.15% of triangles — so both criteria are
    # applied together.
    triangles = np.asarray(mesh.triangles)
    verts = np.asarray(mesh.vertices)
    p0, p1, p2 = verts[triangles[:, 0]], verts[triangles[:, 1]], verts[triangles[:, 2]]
    areas = 0.5 * np.linalg.norm(np.cross(p1 - p0, p2 - p0), axis=1)
    area_floor = np.median(areas) * 1e-3
    edge_lengths = np.stack([
        np.linalg.norm(p1 - p0, axis=1),
        np.linalg.norm(p2 - p1, axis=1),
        np.linalg.norm(p0 - p2, axis=1),
    ], axis=1)
    min_edge = edge_lengths.min(axis=1)
    edge_floor = np.median(edge_lengths) * 5e-3
    sliver_mask = (areas < area_floor) | (min_edge < edge_floor)

    tri_clusters, cluster_n_tris, _ = mesh.cluster_connected_triangles()
    tri_clusters = np.asarray(tri_clusters)
    cluster_n_tris = np.asarray(cluster_n_tris)
    fragment_floor = 25  # triangles — well above the 460-component median cluster size of 1
    fragment_mask = cluster_n_tris[tri_clusters] < fragment_floor

    remove_mask = sliver_mask | fragment_mask
    if remove_mask.any():
        n_before = len(triangles)
        mesh.remove_triangles_by_mask(remove_mask)
        mesh.remove_unreferenced_vertices()
        print(f"  [colmap] Removed {sliver_mask.sum():,} sliver + "
              f"{fragment_mask.sum():,} fragment triangles "
              f"({n_before:,} → {len(mesh.triangles):,})")

    _o3d.io.write_triangle_mesh(str(mesh_ply), mesh)
    print(f"  [colmap] Mesh PLY → {mesh_ply}  "
          f"({len(mesh.vertices):,} verts  {len(mesh.triangles):,} faces)")


# ── Full pipeline ─────────────────────────────────────────────────────────

def run(
    image_dir: Path,
    workspace: Path,
    manifest: pd.DataFrame,
    sequential_overlap: int = 10,
    use_gpu: bool = True,
    mask_dir: Path | None = None,
    skip_georef: bool = False,
) -> dict[str, Path]:
    workspace = Path(workspace)
    image_dir = Path(image_dir)

    db_path   = workspace / "db.db"
    sparse    = workspace / "sparse"
    sparse_geo = workspace / "sparse_geo"
    dense_dir = workspace / "dense"
    dense_ply = workspace / "dense.ply"
    mesh_ply  = workspace / "mesh.ply"

    workspace.mkdir(parents=True, exist_ok=True)

    extract_and_match(db_path, image_dir, sequential_overlap, use_gpu, mask_dir)
    recon = run_mapper(db_path, image_dir, sparse)

    # ── Dense stereo and meshing in LOCAL SfM frame ─────────────────────────
    # patch_match_stereo and Poisson meshing need small-valued coordinates.
    # ECEF camera positions (~6 M metres) break some of both. Work in local
    # frame first.
    #
    # max_image_size controls dense depth map resolution, which controls how
    # many points stereo_fusion ends up holding in RAM at once (roughly
    # quadratic in max_image_size, and scales with frame count). 2000px was
    # fine for ~18 frames (606K fused points) but OOM-killed a 87-frame run
    # at 8M fused points on this box's 15GB RAM. Scale it down for larger
    # frame counts rather than assume every run is small.
    num_images = recon.num_reg_images()
    if num_images > 60:
        max_image_size = 1200
    elif num_images > 30:
        max_image_size = 1600
    else:
        max_image_size = 2000
    print(f"  [colmap] {num_images} registered images -> dense max_image_size={max_image_size}")
    run_dense(recon, image_dir, dense_dir, dense_ply, use_gpu, max_image_size=max_image_size)
    run_mesher(dense_ply, mesh_ply)

    if skip_georef:
        # No GPS in the source video/telemetry — leave dense_ply/mesh_ply in
        # the local SfM frame (arbitrary scale/origin, not tied to any real
        # EPSG) and skip Sim3d alignment entirely. Downstream (semantic
        # segmentation, export) reads from `sparse`, not `sparse_geo` — the
        # camera poses/tracks it needs exist here regardless of georeferencing.
        print("  [colmap] skip_georef=True — leaving reconstruction in local "
              "(non-georeferenced) coordinates. No GeoTIFF DSM will be produced.")
        return {"sparse_geo": sparse, "dense_ply": dense_ply, "mesh_ply": mesh_ply}

    # ── GPS geo-registration ────────────────────────────────────────────────
    sim3, recon = align_to_gps(recon, manifest, sparse_geo)

    # ── Detect Y-axis reflection from pycolmap's Sim3d convention ──────────
    # pycolmap's align_reconstruction_to_locations may produce a Sim3d with
    # det(R) = -1 (O(3) reflection), resulting in ECEF Y being sign-flipped
    # relative to standard EPSG:4978.  Detect this by comparing a camera
    # projection_center() to its expected ECEF Y from pyproj.
    import pyproj as _pyproj
    _geo2ecef_v = _pyproj.Transformer.from_crs(
        "EPSG:4326", "EPSG:4978", always_xy=True
    )
    _ref_lon = float(manifest["lon"].mean())
    _ref_lat = float(manifest["lat"].mean())
    _ref_alt = float(manifest["alt_m"].mean())
    _, _exp_y, _ = _geo2ecef_v.transform(_ref_lon, _ref_lat, _ref_alt)
    _sample_center = list(recon.images.values())[0].projection_center()
    _y_reflected = (np.sign(_sample_center[1]) != np.sign(_exp_y))
    if _y_reflected:
        print("  [colmap] Y-axis reflection detected in Sim3d — correcting PLYs")

    # ── Transform dense PLY and mesh PLY from local frame → ECEF ───────────
    import open3d as _o3d
    R = sim3.rotation.matrix()
    t = np.asarray(sim3.translation)
    s = sim3.scale

    def _transform_ply(src: Path, name: str) -> None:
        pcd = _o3d.io.read_point_cloud(str(src))
        pts = np.asarray(pcd.points)
        pts_ecef = (s * (R @ pts.T)).T + t
        if _y_reflected:
            pts_ecef[:, 1] = -pts_ecef[:, 1]   # correct O(3) reflection → SO(3)
        out = _o3d.geometry.PointCloud()
        out.points = _o3d.utility.Vector3dVector(pts_ecef)
        if pcd.has_colors():
            out.colors = pcd.colors
        _o3d.io.write_point_cloud(str(src), out)
        print(f"  [colmap] {name} → ECEF  ({len(pts_ecef):,} pts)")

    print("  [colmap] Transforming PLYs to ECEF...")
    _transform_ply(dense_ply, "dense.ply")

    # Transform mesh vertices separately (TriangleMesh, not PointCloud)
    mesh = _o3d.io.read_triangle_mesh(str(mesh_ply))
    verts = np.asarray(mesh.vertices)
    verts_ecef = (s * (R @ verts.T)).T + t
    if _y_reflected:
        verts_ecef[:, 1] = -verts_ecef[:, 1]
    mesh.vertices = _o3d.utility.Vector3dVector(verts_ecef)
    _o3d.io.write_triangle_mesh(str(mesh_ply), mesh)
    print(f"  [colmap] mesh.ply → ECEF  ({len(verts_ecef):,} verts)")

    print(f"\n  [colmap] Outputs:")
    for label, path in [("sparse_geo", sparse_geo),
                         ("dense_ply",  dense_ply),
                         ("mesh_ply",   mesh_ply)]:
        print(f"    {label:<12} {path}")

    return {
        "sparse_geo": sparse_geo,
        "dense_ply":  dense_ply,
        "mesh_ply":   mesh_ply,
    }
