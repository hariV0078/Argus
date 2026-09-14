# Jury Demo Script

> **Keep this file in sync with the code.** Any change that touches what a
> presenter would click, type, or say — a renamed screen, a moved button, a
> new endpoint, a different default port/URL, a new failure mode — should be
> reflected here in the same change. A demo script that lies about the UI is
> worse than no demo script. If you're an AI assistant making such a change,
> update this file as part of that same task rather than waiting to be asked.

Single-pass drone video → georeferenced 3D model. SIH 2026 PS #17 (National
Technical Research Organisation, Software / Robotics and Drones track).

---

## 60-second pitch (say this first)

> "Operational drone scenarios — disaster response, border recon — often
> allow only **one flyover**. You don't get to circle back for better
> coverage. Argus takes that single pass — video plus GPS and flight
> metadata — and produces a **georeferenced, metrically accurate 3D model**:
> textured mesh, semantic point cloud, and a GeoTIFF elevation map, in under
> 15 minutes for a 10-minute flight. This phone app is the field UI: an
> operator submits the flight, watches it process, and inspects the result
> on-device — no laptop needed in the field."

Then go straight to Outputs (step 3 below) — lead with the finished model,
not the pipeline internals. Explain how it was built *after* the "wow."

---

## Pre-demo checklist (do this ~10 minutes before you're called up)

1. **Backend + tunnel**, from `backend/`:
   ```bash
   conda run -n recon python3 scripts/start_ngrok.py
   ```
   Confirm the banner prints `Public URL: https://sound-guiding-mammoth.ngrok-free.app`
   and `curl https://sound-guiding-mammoth.ngrok-free.app/api/health` (from
   any machine, e.g. your own phone's browser) returns `{"status":"ok"}`.
2. **`data/output/` has at least one run with real files** — this is what
   step 3 shows. Check:
   ```bash
   curl -s https://sound-guiding-mammoth.ngrok-free.app/api/outputs | python3 -m json.tool
   ```
   `"total"` is the number of **runs**, not files — should be **≥ 1**, and
   the first run's `mesh`/`pointcloud`/`geotiff` arrays should each be
   non-empty (7 files total across them: 3 mesh formats, 3 point cloud
   formats, 1 GeoTIFF). If `"total": 0`, **stop and regenerate before you go
   on stage**:
   ```bash
   curl -X POST https://sound-guiding-mammoth.ngrok-free.app/api/pipeline/run \
     -H "Content-Type: application/json" \
     -d '{"video_path": "data/raw/drone.MOV", "skip_ingestion": true, "utm_epsg": 32617, "auto_clean": true}'
   ```
   Takes roughly **20–30 minutes** for the current 87-frame sample set (Toledo,
   OH — real DJI survey with GPS EXIF; more frames/detail than the app needs
   to prove the point, but budget the time). Don't discover it empty with the
   jury watching. See [Fallback plan](#fallback-plan-if-something-breaks-on-stage)
   if you're out of time.
3. **Phone**: Expo Go installed, on the venue Wi-Fi (or mobile data — the
   ngrok tunnel doesn't need the phone on the same network as the laptop).
4. **App running**: from `frontend/`, `npx expo start`, scan the QR.
5. Log in with the demo credentials (below), and on **Home**, set Backend
   URL to `https://sound-guiding-mammoth.ngrok-free.app` and tap **Connect**
   — confirm it says "Connected", not an error. Do this *before* you're
   called up, not live (see step 2 of the script).

```
Email:    ashwinram28102005@ntro.com
Password: Ashwin@28102005
```

---

## Live demo script

### 1. Login (10s)
Already done in the pre-demo checklist — just show the Home screen exists
and skip straight to "Connected" state. Don't re-type credentials on stage
unless asked.

### 2. Show it's live, not canned (15s)
Point at the **Backend URL** field on Home: `https://sound-guiding-mammoth.ngrok-free.app`
— say "that's a real server on our laptop, reachable from anywhere, not a
mock." Tap **Connect** again on stage if you want the visible round-trip.

### 3. Outputs — the finished model (90s, the core of the demo)
Go to **Outputs**. You'll see a **Run 1** card — this comes straight from
the backend's `data/output/{job_id}/`, a real reconstruction that already
ran. Nothing here is bundled with the app. Each run card has exactly three
rows: 3D Mesh, Point Cloud, Map.

- Tap **3D Mesh** → mesh viewer. Drag to orbit. Point out it's textured, not
  a bare wireframe, and that it's the real building/terrain shapes from the
  flyover, not a blocky placeholder.
- Back → tap **Point Cloud**. Point out the colour coding — that's the
  semantic segmentation pass (buildings / vegetation / terrain / vehicles),
  not just raw geometry.
- Back → tap **Map**. Point out the DSM bounds overlaid on a real satellite
  map — this is what makes it *georeferenced*, not just a floating 3D
  object: every point has a real-world UTM coordinate.

### 4. New Scan — prove the pipeline actually runs (60–90s)
Go to **New Scan**. Two ways to start a real job, pick one:

- **Sample inputs on server** card → tap the pre-extracted frame set entry.
  Fastest option — no upload wait, jumps straight to a running job.
- Or **Upload video from files/gallery** → pick any short clip → watch it
  upload (real bytes over the tunnel to `data/raw/`) → **Submit job**.

Either way you land on the job detail screen. Let logs stream for ~20–30
seconds — point at a couple of lines (frame extraction / masking /
`Creating SIFT CPU feature extractor` etc.) to show it's genuinely invoking
COLMAP and the AI models, not printing canned text. Then say "this test set
takes 20–30 minutes end-to-end — a full production flight is fewer, more
purposefully-spaced frames and targets under 15 minutes per the problem
statement — we won't wait live," and navigate back to **Jobs** or **Home**.

Cancel works correctly if you need it (it actually stops the pipeline, not
just the current phase — see `backend/TESTING.md#cancel-job`), but there's
no reason to cancel on stage: it just stops the reconstruction you started,
drawing attention to a job you're not going to see finish.

### 5. Jobs list (10s)
**Jobs** tab — show the job just submitted sitting at `running`, alongside
its `pending`/`completed` history if you've run others. Reinforces "this is
a queue of real work," not one hardcoded demo path.

If a job from an earlier slot finished since you last checked Outputs, pull
to refresh there — a **Run 2** card appears above Run 1, and Run 1 is
untouched. Worth mentioning if asked "what happens to old results": nothing
gets overwritten, every run keeps its own mesh/point cloud/DSM.

### 6. Close (15s)
Back to Outputs or the mesh viewer — end on the visual, not a settings
screen. Mention output formats if asked: **OBJ, PLY, LAS, GeoTIFF, GLB/glTF,
FBX** — covers Blender/MeshLab, Unity/Unreal, and GIS tooling, per the
problem statement's required export set.

---

## Fallback plan (if something breaks on stage)

- **Backend unreachable / ngrok down**: on Home, don't tap Connect (or tap
  **Disconnect** if already connected). The app drops to **offline demo
  mode** — a bundled sample mesh and a mocked job flow (`src/services/mockDb.ts`)
  still let you show every screen and the interaction model. Say so plainly:
  "we're offline right now, this is the local preview" — don't pretend it's
  live.
- **`data/output/` came back empty and there's no time to re-run**: same
  fallback — disconnect and use the offline demo mesh for the visual, then
  describe the real pipeline verbally using this doc's pitch section.
- **A job you started earlier hasn't finished**: that's fine — Outputs still
  shows whatever completed in an *earlier* run. You don't need the job
  submitted in step 4 to finish; it's there to prove submission works, not
  to be the thing you show finished.

---

## Anticipated questions

| Question | Answer |
|---|---|
| How accurate is the reconstruction? | Target ≤ 1m spatial accuracy, georeferenced via GPS→ECEF (EPSG:4978) alignment — see `backend/ARCHITECTURE.md`. |
| Why single-pass? | Operational constraint from the problem statement — disaster response / recon flights don't get a second pass. |
| What's under the hood? | COLMAP (GPU SfM + MVS) for geometry, YOLOv8-seg for dynamic object masking *before* reconstruction, YOLO-World + SAM2 for zero-shot semantic labelling *after*, projected back onto the point cloud via COLMAP tracks + KNN. |
| What hardware does this need? | Runs on a single RTX 5070 laptop GPU (8GB VRAM) — see `backend/README.md#hardware`. Cloud-equivalent: an A10G-class instance. |
| Does the phone do any of the processing? | No — it's a thin client. Submit, poll/stream status, render results. All reconstruction is server-side. |
| What if the network drops mid-flight-review? | The app has an offline mode with a local sample mesh precisely for this; the backend also survives a client disconnect and reconnect — jobs keep running and their logs replay from the start to a late-joining WebSocket client. |

---

## Reference: exact commands

```bash
# Backend + public tunnel (from backend/)
cp .env.example .env   # once, fill in NGROK_AUTHTOKEN
conda run -n recon python3 scripts/start_ngrok.py

# Frontend (from frontend/)
npm install
npx expo start

# Health / outputs check from anywhere
curl https://sound-guiding-mammoth.ngrok-free.app/api/health
curl https://sound-guiding-mammoth.ngrok-free.app/api/outputs

# Regenerate demo outputs from the sample dataset (~20-30 min, 87 frames)
curl -X POST https://sound-guiding-mammoth.ngrok-free.app/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"video_path": "data/raw/drone.MOV", "skip_ingestion": true, "utm_epsg": 32617, "auto_clean": true}'
```

Backend logs (for debugging a bad run *before* you're on stage, not during):
`backend/data/logs/backend.log` — durable, rotating, survives a server
restart; console output mirrors it at INFO level. See `backend/TESTING.md`
and `frontend/TESTING.md` for the full endpoint/screen checklist this script
assumes already passes.
