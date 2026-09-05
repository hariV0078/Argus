#!/usr/bin/env bash
# Phase 0 — Environment Setup
# Run once: bash setup.sh
# Re-running is safe (idempotent checks throughout)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }
step() { echo -e "\n${YELLOW}==>${NC} $*"; }

# ──────────────────────────────────────────────
# 1. System packages
# ──────────────────────────────────────────────
step "Installing system packages (exiftool, libgl, etc.)"
sudo apt-get update -qq
sudo apt-get install -y -qq \
    libimage-exiftool-perl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    wget curl git
ok "System packages ready"

# ──────────────────────────────────────────────
# 2. Docker — skipped in WSL2
# ODM is optional; COLMAP + OpenMVS cover the same reconstruction path natively.
# If you want ODM: install Docker Desktop on Windows, enable WSL2 integration,
# then run: docker pull opendronemap/odm
# ──────────────────────────────────────────────
step "Docker check (WSL2 — skipping auto-install)"
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    ok "Docker already available: $(docker --version)"
else
    warn "Docker not found. ODM is optional — COLMAP+OpenMVS handle reconstruction natively."
    warn "To use ODM: install Docker Desktop on Windows → enable WSL2 integration → docker pull opendronemap/odm"
fi

# ──────────────────────────────────────────────
# 3a. Conda environment (no PyTorch — installed separately below)
# ──────────────────────────────────────────────
step "Creating conda environment 'recon' (Python 3.10)"
if conda env list | grep -q "^recon "; then
    warn "Environment 'recon' already exists — updating"
    conda env update -n recon -f environment.yml --prune
else
    conda env create -f environment.yml
fi
ok "Conda env ready"

# ──────────────────────────────────────────────
# 3b-i. openimageio — pip wheel provides libOpenImageIO.so.3.1 that COLMAP needs
#        conda solver silently skips it; pip wheel works fine
# ──────────────────────────────────────────────
step "openimageio (pip wheel + symlink for COLMAP binary)"
conda run -n recon pip install openimageio --quiet
OIIO_LIB="$(conda run -n recon python -c \
    "import site; print(site.getsitepackages()[0])")/OpenImageIO/lib"
ENV_LIB="/home/hari/miniconda3/envs/recon/lib"
ln -sf "$OIIO_LIB/libOpenImageIO.so.3.1.17"      "$ENV_LIB/libOpenImageIO.so.3.1"
ln -sf "$OIIO_LIB/libOpenImageIO.so.3.1.17"      "$ENV_LIB/libOpenImageIO.so"
ln -sf "$OIIO_LIB/libOpenImageIO_Util.so.3.1.17" "$ENV_LIB/libOpenImageIO_Util.so.3.1"
ln -sf "$OIIO_LIB/libOpenImageIO_Util.so.3.1.17" "$ENV_LIB/libOpenImageIO_Util.so"
conda run -n recon colmap --help &>/dev/null && ok "COLMAP binary loads" || fail "COLMAP binary still broken"

# ──────────────────────────────────────────────
# 3b. PyTorch — CUDA 12.8 wheels (RTX 5070 / Blackwell SM_120 requires >= cu128)
# ──────────────────────────────────────────────
step "Installing PyTorch 2.6+ with CUDA 12.8 (Blackwell)"
TORCH_INDEX="https://download.pytorch.org/whl/cu128"
conda run -n recon pip install torch torchvision torchaudio \
    --index-url "$TORCH_INDEX" \
    --quiet
# Quick CUDA sanity check
conda run -n recon python -c "
import torch
assert torch.cuda.is_available(), 'CUDA unavailable after torch install'
print(f'  torch {torch.__version__}  |  GPU: {torch.cuda.get_device_name(0)}')
" && ok "PyTorch CUDA ready" || warn "PyTorch installed but CUDA not detected — check driver"

# ──────────────────────────────────────────────
# 4. OpenMVS prebuilt binary
# ──────────────────────────────────────────────
step "Downloading OpenMVS prebuilt binary"
OPENMVS_DIR="$SCRIPT_DIR/tools/OpenMVS"
OPENMVS_BIN="$OPENMVS_DIR/bin/DensifyPointCloud"

if [ -f "$OPENMVS_BIN" ]; then
    ok "OpenMVS already present at $OPENMVS_DIR"
else
    # Try to get latest release binary from GitHub
    OPENMVS_RELEASE_URL="https://github.com/cdcseacave/openMVS/releases/latest"
    warn "Fetching OpenMVS release page to find binary..."
    # Download tarball — adjust tag as needed
    OPENMVS_TAG=$(curl -sI "$OPENMVS_RELEASE_URL" | grep -i location | grep -oP 'v[\d.]+' | head -1)
    if [ -z "$OPENMVS_TAG" ]; then
        warn "Could not auto-detect OpenMVS version. Downloading v2.3.0 as fallback."
        OPENMVS_TAG="v2.3.0"
    fi
    OPENMVS_URL="https://github.com/cdcseacave/openMVS/releases/download/${OPENMVS_TAG}/OpenMVS_Linux.tar.gz"
    mkdir -p "$OPENMVS_DIR"
    wget -q --show-progress -O "$OPENMVS_DIR/OpenMVS_Linux.tar.gz" "$OPENMVS_URL" || {
        warn "Prebuilt binary download failed. Will build from source or skip."
        warn "Manual option: sudo apt install libopenmvs-dev"
        warn "or: conda install -n recon -c open3d-admin open3d  (as MVS alternative)"
    }
    if [ -f "$OPENMVS_DIR/OpenMVS_Linux.tar.gz" ]; then
        tar -xzf "$OPENMVS_DIR/OpenMVS_Linux.tar.gz" -C "$OPENMVS_DIR"
        rm "$OPENMVS_DIR/OpenMVS_Linux.tar.gz"
        ok "OpenMVS extracted to $OPENMVS_DIR"
    fi
fi

# ──────────────────────────────────────────────
# 5. Blender portable binary (for FBX export, no sudo required)
# ──────────────────────────────────────────────
step "Blender portable binary (FBX export)"
BLENDER_DIR="$SCRIPT_DIR/tools/blender"
BLENDER_BIN="$BLENDER_DIR/blender"
if [ -f "$BLENDER_BIN" ]; then
    ok "Blender already present: $($BLENDER_BIN --version 2>&1 | head -1)"
else
    mkdir -p "$BLENDER_DIR"
    BLENDER_URL="https://download.blender.org/release/Blender4.2/blender-4.2.0-linux-x64.tar.xz"
    wget -q --show-progress -O "$BLENDER_DIR/blender.tar.xz" "$BLENDER_URL"
    tar -xJf "$BLENDER_DIR/blender.tar.xz" -C "$BLENDER_DIR" --strip-components=1
    rm "$BLENDER_DIR/blender.tar.xz"
    ok "Blender ready: $($BLENDER_BIN --version 2>&1 | head -1)"
fi

# ──────────────────────────────────────────────
# 6. SAM2 model weights
# ──────────────────────────────────────────────
step "Downloading SAM2 model weights (sam2.1_hiera_large)"
WEIGHTS_DIR="$SCRIPT_DIR/tools/sam2_weights"
mkdir -p "$WEIGHTS_DIR"
SAM2_URL="https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_large.pt"
if [ -f "$WEIGHTS_DIR/sam2.1_hiera_large.pt" ]; then
    ok "SAM2 weights already present"
else
    wget -q --show-progress -O "$WEIGHTS_DIR/sam2.1_hiera_large.pt" "$SAM2_URL"
    ok "SAM2 weights downloaded"
fi

# ──────────────────────────────────────────────
# 7. YOLO model weights
# ──────────────────────────────────────────────
step "Downloading YOLOv8 segmentation weights"
YOLO_DIR="$SCRIPT_DIR/tools/yolo_weights"
mkdir -p "$YOLO_DIR"
# Pull via ultralytics (auto-downloads on first use, but we cache them here)
conda run -n recon python -c "
from ultralytics import YOLO
import shutil, os
m = YOLO('yolov8x-seg.pt')
dest = '$YOLO_DIR/yolov8x-seg.pt'
if not os.path.exists(dest):
    shutil.move('yolov8x-seg.pt', dest)
print('YOLO weights cached at', dest)
" 2>/dev/null || warn "YOLO auto-download skipped (run verify_setup.sh to confirm later)"

ok "Phase 0 setup complete. Run: bash verify_setup.sh"
