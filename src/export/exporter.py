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
    """Convert Poisson mesh PLY → OBJ using open3d."""
    out_dir.mkdir(parents=True, exist_ok=True)
    mesh = o3d.io.read_triangle_mesh(str(mesh_ply))
    mesh.compute_vertex_normals()
    obj_path = out_dir / "model.obj"
    o3d.io.write_triangle_mesh(str(obj_path), mesh, write_ascii=False)
    print(f"  [export] OBJ → {obj_path}  "
          f"({len(mesh.vertices)} verts, {len(mesh.triangles)} faces)")
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

    # Grid extents
    e_min, e_max = east.min(),  east.max()
    n_min, n_max = north.min(), north.max()
    ncols = max(1, int((e_max - e_min) / resolution_m))
    nrows = max(1, int((n_max - n_min) / resolution_m))

    print(f"  [export] DSM grid {nrows}×{ncols} @ {resolution_m} m GSD")

    # Thin to at most 500k points for griddata speed
    if len(pts) > 500_000:
        idx = np.random.choice(len(pts), 500_000, replace=False)
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


# ── main export orchestrator ───────────────────────────────────────────────

def run_all(
    dense_ply: Path,
    mesh_ply: Path,
    out_root: Path,
    utm_epsg: int = 32644,
    dsm_resolution_m: float = 0.1,
) -> dict[str, Path | None]:
    """
    Produce all required formats from COLMAP outputs.

    Returns dict of format → output path (None if skipped).
    """
    mesh_dir  = out_root / "mesh"
    pc_dir    = out_root / "pointcloud"
    tiff_dir  = out_root / "geotiff"

    results = {}

    print("\n[export] PLY point cloud...")
    results["ply"] = copy_ply(dense_ply, pc_dir)

    print("\n[export] OBJ mesh...")
    results["obj"] = ply_mesh_to_obj(mesh_ply, mesh_dir)

    print("\n[export] LAS point cloud...")
    results["las"] = ply_to_las(dense_ply, pc_dir, epsg=4978)

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
