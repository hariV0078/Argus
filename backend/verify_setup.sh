#!/usr/bin/env bash
# Checkpoint verification — run after setup.sh completes
# Every check must pass before moving to Phase 1
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0

check() {
    local label="$1"; shift
    if "$@" &>/dev/null; then
        echo -e "${GREEN}[PASS]${NC} $label"
        ((PASS++))
    else
        echo -e "${RED}[FAIL]${NC} $label"
        ((FAIL++))
    fi
}

warn_check() {
    local label="$1"; shift
    if "$@" &>/dev/null; then
        echo -e "${GREEN}[PASS]${NC} $label"
        ((PASS++))
    else
        echo -e "${YELLOW}[WARN]${NC} $label (optional)"
    fi
}

echo "========================================"
echo " SIH26158 — Phase 0 Checkpoint"
echo "========================================"

# System tools
echo -e "\n--- System Tools ---"
check "ffmpeg"      ffmpeg -version
check "exiftool"    exiftool -ver
check "git"         git --version
check "conda"       conda --version
warn_check "docker" docker --version

# GPU
echo -e "\n--- GPU / CUDA ---"
check "nvidia-smi"  nvidia-smi
check "CUDA driver >= 520" bash -c "nvidia-smi | grep -oP 'CUDA Version: \K[0-9]+' | awk -F. '\$1 >= 12'"

# Conda env
echo -e "\n--- Conda Environment 'recon' ---"
check "env exists"      conda env list | grep -q "^recon "
check "python 3.10"     conda run -n recon python --version 2>&1 | grep -q "3\.10"
check "colmap"          conda run -n recon bash -c "colmap --help 2>&1 | grep -qi 'COLMAP'"
check "ultralytics"     conda run -n recon python -c "import ultralytics; print(ultralytics.__version__)"
check "open3d"          conda run -n recon python -c "import open3d; print(open3d.__version__)"
check "pyproj"          conda run -n recon python -c "import pyproj"
check "gdal"            conda run -n recon python -c "from osgeo import gdal"
check "trimesh"         conda run -n recon python -c "import trimesh"
check "laspy"           conda run -n recon python -c "import laspy"
check "fastapi"         conda run -n recon python -c "import fastapi"
warn_check "sam2"       conda run -n recon python -c "import sam2"

# PyTorch + CUDA
echo -e "\n--- PyTorch CUDA ---"
check "torch installed"  conda run -n recon python -c "import torch"
check "torch CUDA"       conda run -n recon python -c "import torch; assert torch.cuda.is_available(), 'CUDA not available'"
check "torch CUDA device" conda run -n recon python -c "
import torch
dev = torch.cuda.get_device_name(0)
print(f'GPU: {dev}')
assert 'RTX' in dev or 'GeForce' in dev or 'Tesla' in dev
"

# Weights
echo -e "\n--- Model Weights ---"
check "SAM2 weights"        test -f "$SCRIPT_DIR/tools/sam2_weights/sam2.1_hiera_large.pt"
warn_check "YOLO weights"   test -f "$SCRIPT_DIR/tools/yolo_weights/yolov8x-seg.pt"
warn_check "OpenMVS binary" test -d "$SCRIPT_DIR/tools/OpenMVS"

# ODM Docker — optional, only if Docker Desktop is configured
echo -e "\n--- OpenDroneMap (optional) ---"
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    warn_check "ODM image" docker images 2>/dev/null | grep -q "opendronemap/odm"
else
    echo -e "${YELLOW}[SKIP]${NC} Docker not available — ODM skipped (using COLMAP+OpenMVS instead)"
fi

# Project structure
echo -e "\n--- Project Structure ---"
check "src/ingestion"       test -d "$SCRIPT_DIR/src/ingestion"
check "src/reconstruction"  test -d "$SCRIPT_DIR/src/reconstruction"
check "src/segmentation"    test -d "$SCRIPT_DIR/src/segmentation"
check "data/raw"            test -d "$SCRIPT_DIR/data/raw"
check "data/output"         test -d "$SCRIPT_DIR/data/output"
check "config/pipeline.yaml" test -f "$SCRIPT_DIR/config/pipeline.yaml"

# Summary
echo -e "\n========================================"
echo -e " Results: ${GREEN}${PASS} passed${NC}  ${RED}${FAIL} failed${NC}"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}Fix failing checks before Phase 1.${NC}"
    exit 1
else
    echo -e "${GREEN}All mandatory checks passed. Proceed to Phase 1.${NC}"
fi
