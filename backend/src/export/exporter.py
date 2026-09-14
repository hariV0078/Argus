"""
Export pipeline — converts COLMAP outputs to all required formats.

Outputs produced:
  ├── output/mesh/       model.obj  (+ .mtl + textures)
  ├── output/pointcloud/ dense.ply  dense.las
  ├── output/geotiff/    dsm.tif
  └── output/mesh/       model.glb  model.fbx (via Blender if available)
"""

import shutil
import subprocess
from pathlib import Path

import numpy as np
import open3d as o3d
import laspy
import pandas as pd
import trimesh


# ── PLY → OBJ (textured mesh) ─────────────────────────────────────────────

def ply_mesh_to_obj(mesh_ply: Path, out_dir: Path) -> Path:
    """Convert Poisson mesh PLY → OBJ using open3d.

    Recenters vertices to their own bounding-box centroid before writing.

    mesh_ply is in whatever frame the reconstruction finished in — for a
    georeferenced run that's absolute ECEF (~5,000,000 m magnitude from
    Earth's centre). glTF's binary format *mandates* float32 position
    accessors (not a config option — part of the core spec), and float32
    only carries ~7 significant decimal digits: at ECEF magnitude that's
    ~0.2-0.35 m of quantization noise on every single vertex, independently,
    on export to GLB (and FBX, which is float32 internally too) — roughly
    10x this mesh's own real geometric detail (~2 cm median triangle edge).
    That's indistinguishable from random per-vertex jitter at 10x the mesh's
    own feature scale, and reads exactly as the "thin fragmented slab"
    corruption reported against the mobile viewer — a coordinate-precision
    bug in the export step, not a meshing defect (OBJ/PLY/LAS/GeoTIFF are
    all unaffected: OBJ and PLY here are written as float64/ASCII, LAS
    encodes large magnitudes exactly via its int32 scale+offset header, and
    GeoTIFF's float32 is only ever applied to elevation *values*, never to
    the double-precision affine transform that positions the grid).

    Recentering to the bbox centroid brings coordinates to within a few
    hundred metres of zero, where float32 precision is sub-millimetre —
    negligible. The dropped offset is preserved in model_origin.json (ECEF
    + WGS84) for anything downstream that needs the real-world position. A
    non-georeferenced (skip_georef) mesh is already near-origin in local
    SfM-frame units, so this is a harmless near-zero no-op for it.
    """
    import json

    out_dir.mkdir(parents=True, exist_ok=True)
    mesh = o3d.io.read_triangle_mesh(str(mesh_ply))

    verts = np.asarray(mesh.vertices)
    center = verts.mean(axis=0) if len(verts) else np.zeros(3)
    mesh.vertices = o3d.utility.Vector3dVector(verts - center)

    mesh.compute_vertex_normals()
    obj_path = out_dir / "model.obj"
    o3d.io.write_triangle_mesh(str(obj_path), mesh, write_ascii=False)

    origin = {"ecef_offset": {"x": float(center[0]), "y": float(center[1]), "z": float(center[2])}}
    if np.linalg.norm(center) > 1000:  # only meaningful for real ECEF-scale offsets
        try:
            import pyproj
            to_wgs84 = pyproj.Transformer.from_crs("EPSG:4978", "EPSG:4326", always_xy=True)
            lon, lat, alt = to_wgs84.transform(center[0], center[1], center[2])
            origin["wgs84"] = {"lat": lat, "lon": lon, "alt_m": alt}
        except Exception as e:
            print(f"  [export] (non-fatal) could not compute WGS84 origin: {e}")
    (out_dir / "model_origin.json").write_text(json.dumps(origin, indent=2))

    print(f"  [export] OBJ → {obj_path}  "
          f"({len(mesh.vertices)} verts, {len(mesh.triangles)} faces)  "
          f"[recentered by {np.linalg.norm(center):.1f} m for float32 GLB/FBX precision]")
    return obj_path


# ── PLY point cloud → LAS ─────────────────────────────────────────────────

def _detect_and_reproject(pts: np.ndarray, epsg_in: int, epsg_out: int):
    """
    Reproject point cloud to target UTM CRS.

    After pycolmap align_reconstruction_to_locations with WGS84 lat/lon/alt targets,
    the reconstruction (and dense PLY) is in geographic coordinates (lat, lon, alt_m).
    Detect this case and reproject correctly instead of assuming ECEF.
    """
    import pyproj

    # Heuristic: geographic coords have |X| < 90 (latitude) and |Y| < 180 (longitude)
    if np.abs(pts[:, 0]).max() <= 90.0 and np.abs(pts[:, 1]).max() <= 180.0:
        # PLY is in (lat, lon, alt) WGS84 geographic
        transformer = pyproj.Transformer.from_crs("EPSG:4326", f"EPSG:{epsg_out}", always_xy=True)
        east, north, elev = transformer.transform(pts[:, 1], pts[:, 0], pts[:, 2])  # lon, lat, alt
    else:
        # Assume EPSG:epsg_in (ECEF or other metric CRS)
        transformer = pyproj.Transformer.from_crs(f"EPSG:{epsg_in}", f"EPSG:{epsg_out}", always_xy=True)
        east, north, elev = transformer.transform(pts[:, 0], pts[:, 1], pts[:, 2])

    return east, north, elev


def ply_to_las(dense_ply: Path, out_dir: Path, epsg: int = 4978) -> Path:
    """
    Convert dense PLY point cloud → LAS 1.4.

    Handles both ECEF (EPSG:4978) and geographic WGS84 (lat/lon/alt) point clouds.
    """
    import pyproj

    out_dir.mkdir(parents=True, exist_ok=True)
    pcd = o3d.io.read_point_cloud(str(dense_ply))
    pts = np.asarray(pcd.points)
    colors = np.asarray(pcd.colors) if pcd.has_colors() else None

    # If geographic, store as-is in LAS (x=lon, y=lat, z=alt) with EPSG:4326
    is_geo = np.abs(pts[:, 0]).max() <= 90.0 and np.abs(pts[:, 1]).max() <= 180.0
    if is_geo:
        las_x, las_y, las_z = pts[:, 1], pts[:, 0], pts[:, 2]  # lon, lat, alt
    else:
        las_x, las_y, las_z = pts[:, 0], pts[:, 1], pts[:, 2]

    las = laspy.LasData(header=laspy.LasHeader(point_format=2, version="1.4"))
    las.header.offsets = np.array([las_x.min(), las_y.min(), las_z.min()])
    las.header.scales  = np.array([0.000001, 0.000001, 0.001]) if is_geo else np.array([0.001, 0.001, 0.001])

    las.x = las_x
    las.y = las_y
    las.z = las_z

    if colors is not None:
        las.red   = (colors[:, 0] * 65535).astype(np.uint16)
        las.green = (colors[:, 1] * 65535).astype(np.uint16)
        las.blue  = (colors[:, 2] * 65535).astype(np.uint16)

    las_path = out_dir / "dense.las"
    las.write(str(las_path))
    print(f"  [export] LAS → {las_path}  ({len(pts):,} points)")
    return las_path


# ── PLY point cloud → GeoTIFF DSM ─────────────────────────────────────────

def ply_to_geotiff(
    dense_ply: Path,
    out_dir: Path,
    resolution_m: float = 0.1,
    epsg_in: int = 4978,
    epsg_out: int = 32644,
) -> Path:
    """
    Generate a GeoTIFF DSM (Digital Surface Model) from the dense point cloud.

    Steps:
      1. Re-project ECEF → UTM (or whatever epsg_out is)
      2. Grid by 2D binning to resolution_m GSD
      3. Write with rasterio + correct CRS / geotransform
    """
    import rasterio
    from rasterio.transform import from_origin
    from scipy.interpolate import griddata

    out_dir.mkdir(parents=True, exist_ok=True)

    pcd = o3d.io.read_point_cloud(str(dense_ply))
    pts = np.asarray(pcd.points)

    import pyproj
    print(f"  [export] Reprojecting {len(pts):,} points "
          f"EPSG:{epsg_in} → EPSG:{epsg_out} ...")
    transformer = pyproj.Transformer.from_crs(
        f"EPSG:{epsg_in}", f"EPSG:{epsg_out}", always_xy=True,
    )
    east, north, elev = transformer.transform(pts[:, 0], pts[:, 1], pts[:, 2])

    # Grid extents — use robust percentiles, not raw min/max. A dense MVS
    # point cloud (especially at higher point counts) commonly has a handful
    # of mis-triangulated outlier points sitting far from the real scene;
    # even one such point blows up a naive min/max by orders of magnitude,
    # which then blows up the grid allocation below (silently requesting
    # hundreds of GB and crashing) even though the actual surveyed area is
    # a few hundred metres across.
    e_min, e_max = (float(x) for x in np.percentile(east, [0.5, 99.5]))
    n_min, n_max = (float(x) for x in np.percentile(north, [0.5, 99.5]))
    ncols = max(1, int((e_max - e_min) / resolution_m))
    nrows = max(1, int((n_max - n_min) / resolution_m))

    # Hard safety net regardless: if the (already outlier-trimmed) extent
    # still implies a huge grid, coarsen resolution rather than crash.
    _MAX_CELLS = 40_000_000  # ~6300x6300 — keeps the float32 output well under 1GB
    if ncols * nrows > _MAX_CELLS:
        scale = ((ncols * nrows) / _MAX_CELLS) ** 0.5
        resolution_m *= scale
        ncols = max(1, int((e_max - e_min) / resolution_m))
        nrows = max(1, int((n_max - n_min) / resolution_m))
        print(f"  [export] Requested resolution would need a {ncols * nrows / scale**2 / 1e6:.0f}M-cell "
              f"grid — coarsened to {resolution_m:.3f} m GSD ({nrows}×{ncols})")

    print(f"  [export] DSM grid {nrows}×{ncols} @ {resolution_m} m GSD")

    # Drop points outside the robust bounds (the outliers percentile-trimming
    # excluded above) before sampling for griddata — keeps the interpolation
    # input clean, not just the output canvas.
    in_bounds = (east >= e_min) & (east <= e_max) & (north >= n_min) & (north <= n_max)
    east, north, elev = east[in_bounds], north[in_bounds], elev[in_bounds]

    # Thin to at most 500k points for griddata speed
    if len(east) > 500_000:
        idx = np.random.choice(len(east), 500_000, replace=False)
        east_s, north_s, elev_s = east[idx], north[idx], elev[idx]
    else:
        east_s, north_s, elev_s = east, north, elev

    grid_e = np.linspace(e_min, e_max, ncols)
    grid_n = np.linspace(n_max, n_min, nrows)  # north-to-south for raster
    ge, gn = np.meshgrid(grid_e, grid_n)

    dsm = griddata(
        np.column_stack([east_s, north_s]),
        elev_s,
        (ge, gn),
        method="linear",
    ).astype(np.float32)

    tiff_path = out_dir / "dsm.tif"
    transform = from_origin(e_min, n_max, resolution_m, resolution_m)
    with rasterio.open(
        str(tiff_path), "w",
        driver="GTiff",
        height=nrows, width=ncols,
        count=1, dtype=np.float32,
        crs=f"EPSG:{epsg_out}",
        transform=transform,
        compress="lzw",
    ) as dst:
        dst.write(dsm, 1)
        dst.update_tags(DESCRIPTION="DSM from COLMAP dense point cloud")

    print(f"  [export] GeoTIFF DSM → {tiff_path}")

    # Bounds sidecar (WGS84 lat/lon) — the app's Map screen can't parse a
    # GeoTIFF client-side, so hand it a tiny JSON with what it actually
    # needs instead. Without this the map has no way to know where the
    # survey actually was and (in the version shipped by the Argus repo
    # clone) silently fell back to hardcoded placeholder coordinates from
    # whatever sample data it was originally built against — showing the
    # same fixed location for every run regardless of the real GeoTIFF.
    import json
    to_wgs84 = pyproj.Transformer.from_crs(f"EPSG:{epsg_out}", "EPSG:4326", always_xy=True)
    sw_lon, sw_lat = to_wgs84.transform(e_min, n_min)
    ne_lon, ne_lat = to_wgs84.transform(e_max, n_max)
    bounds = {
        "epsg": epsg_out,
        "sw": {"lat": sw_lat, "lon": sw_lon},
        "ne": {"lat": ne_lat, "lon": ne_lon},
        "center": {"lat": (sw_lat + ne_lat) / 2, "lon": (sw_lon + ne_lon) / 2},
    }
    bounds_path = out_dir / "dsm_bounds.json"
    bounds_path.write_text(json.dumps(bounds, indent=2))
    print(f"  [export] DSM bounds → {bounds_path}  "
          f"(center {bounds['center']['lat']:.5f}, {bounds['center']['lon']:.5f})")

    return tiff_path


# ── OBJ → GLB (trimesh, no external tools needed) ─────────────────────────

def obj_to_glb(obj_path: Path, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    scene = trimesh.load(str(obj_path), force="scene")
    glb_path = out_dir / "model.glb"
    scene.export(str(glb_path))
    size_mb = glb_path.stat().st_size / 1e6
    print(f"  [export] GLB → {glb_path}  ({size_mb:.1f} MB)")
    return glb_path


# ── OBJ → FBX (Blender headless; falls back gracefully) ───────────────────

def obj_to_fbx(obj_path: Path, out_dir: Path) -> Path | None:
    out_dir.mkdir(parents=True, exist_ok=True)
    fbx_path = out_dir / "model.fbx"
    blender_script = (
        Path(__file__).parent.parent.parent / "tools" / "blender_convert.py"
    )

    # Prefer portable binary in tools/blender/, fall back to system PATH
    portable = Path(__file__).parent.parent.parent / "tools" / "blender" / "blender"
    blender = str(portable) if portable.exists() else shutil.which("blender")
    if not blender:
        print("  [export] Blender not found — FBX skipped.")
        print("  [export] Run setup again or: tools/blender/blender --version")
        return None

    result = subprocess.run(
        [blender, "--background", "--python", str(blender_script),
         "--", str(obj_path), str(fbx_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0 or not fbx_path.exists():
        print(f"  [export] FBX conversion failed:\n{result.stderr[-500:]}")
        return None

    print(f"  [export] FBX → {fbx_path}")
    return fbx_path


# ── copy source PLY into output ────────────────────────────────────────────

def copy_ply(src_ply: Path, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    dst = out_dir / "dense.ply"
    shutil.copy2(src_ply, dst)
    print(f"  [export] PLY → {dst}")
    return dst


def _clean_dense_ply(src_ply: Path, workspace: Path) -> Path:
    """
    Remove stray outlier points from stereo_fusion's raw output before
    anything gets exported from it.

    stereo_fusion routinely leaves a handful of badly-triangulated points
    far from the actual scene (weak/noisy matches at frame boundaries, sky,
    reflections). run_mesher() already filters its own working copy before
    Poisson meshing, so the mesh comes out clean — but that filtering never
    reaches the point cloud exports (PLY/LAS) or the GeoTIFF bounds, so a
    handful of outliers among millions of good points can make the point
    cloud viewer render as a tiny speck (bounding box stretched by the
    outliers to contain them) even though the mesh next to it looks fine.
    """
    pcd = o3d.io.read_point_cloud(str(src_ply))
    before = len(pcd.points)
    pcd, _ = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
    after = len(pcd.points)

    clean_ply = workspace / "dense_clean.ply"
    o3d.io.write_point_cloud(str(clean_ply), pcd)
    if before != after:
        print(f"  [export] Cleaned dense.ply: {before:,} -> {after:,} points "
              f"({before - after:,} outliers removed)")
    return clean_ply


# ── main export orchestrator ───────────────────────────────────────────────

def run_all(
    dense_ply: Path,
    mesh_ply: Path,
    out_root: Path,
    utm_epsg: int = 32644,
    dsm_resolution_m: float = 0.1,
    skip_geotiff: bool = False,
) -> dict[str, Path | None]:
    """
    Produce all required formats from COLMAP outputs.

    skip_geotiff=True for a non-georeferenced reconstruction (no GPS in the
    source video) — dense_ply/mesh_ply are in local, arbitrary-scale
    coordinates, and a DSM fundamentally requires real-world (UTM) ones, so
    it's skipped rather than written with meaningless coordinates.

    Returns dict of format → output path (None if skipped).
    """
    mesh_dir  = out_root / "mesh"
    pc_dir    = out_root / "pointcloud"
    tiff_dir  = out_root / "geotiff"

    results = {}

    print("\n[export] Cleaning dense point cloud...")
    dense_ply = _clean_dense_ply(dense_ply, dense_ply.parent)

    print("\n[export] PLY point cloud...")
    results["ply"] = copy_ply(dense_ply, pc_dir)

    print("\n[export] OBJ mesh...")
    results["obj"] = ply_mesh_to_obj(mesh_ply, mesh_dir)

    print("\n[export] LAS point cloud...")
    results["las"] = ply_to_las(dense_ply, pc_dir, epsg=4978)

    if skip_geotiff:
        print("\n[export] GeoTIFF DSM... skipped (no georeferencing — source video had no GPS)")
        results["geotiff"] = None
    else:
        print("\n[export] GeoTIFF DSM...")
        results["geotiff"] = ply_to_geotiff(
            dense_ply, tiff_dir,
            resolution_m=dsm_resolution_m,
            epsg_in=4978,
            epsg_out=utm_epsg,
        )

    print("\n[export] GLB...")
    results["glb"] = obj_to_glb(results["obj"], mesh_dir)

    print("\n[export] FBX...")
    results["fbx"] = obj_to_fbx(results["obj"], mesh_dir)

    print("\n[export] Summary:")
    for fmt, path in results.items():
        status = str(path) if path else "SKIPPED"
        print(f"  {fmt:<8} {status}")

    return results
