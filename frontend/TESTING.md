# Frontend App Testing

Backend base URL used below: `http://localhost:8765` (swap for your workstation LAN IP when testing on a physical phone — see the WSL2 note in [repo-root README](../README.md#run-both)).

Start the app first:
```bash
npx expo start
```
Scan the QR with Expo Go, or press `w` for the web target (`npx expo start --web`) for a fast desktop check.

There is no automated test suite in this app yet (no `jest`/`test` script in `package.json`) — this is a manual QA checklist, mirroring `backend/TESTING.md`'s endpoint coverage from the app side. Typecheck is the closest thing to an automated check:
```bash
npx tsc --noEmit
```

---

## Login

Demo credentials (`app/login.tsx`):
```
Email:    ashwinram28102005@ntro.com
Password: Ashwin@28102005
```
Expected: session persists on device (AsyncStorage) — closing and reopening the app should skip straight past login.

## Offline Demo Mode (no backend required)

1. Sign in.
2. On Home, do **not** tap Connect.
3. Open **Viewer** tab, or Home → **Open sample 3D output**.
4. Drag to orbit — confirms `expo-gl` + `three.js` render locally (`src/lib/sampleGlb.ts`).
5. **New Scan** → submit with the default `data/raw/drone.MOV` path → confirms the local mock pipeline (`src/services/mockDb.ts`): logs stream, then sample mesh / point cloud / map appear.

## Connect to Live Backend

Start the backend first (`backend/README.md#run`), then:

1. Settings → Server (or Home) → enter `http://<workstation-lan-ip>:8765`.
2. Tap **Connect**. This calls `GET /api/outputs` under the hood (`src/api/client.ts:connectBackend`) with a 4s timeout.
   - Expected on success: connected state, no error toast.
   - Expected on backend down: "Server is not running or blocked..." friendly error.
   - Expected on unreachable IP (e.g. WSL2-only address): "Phone cannot reach that IP..." friendly error.
3. Equivalent manual check from a machine that *can* reach the backend:
   ```bash
   curl http://<workstation-lan-ip>:8765/api/outputs
   ```

## Submit a Job (live)

Three ways in, all on the **New Scan** tab (`app/(tabs)/new.tsx`) once connected:

### A. Sample input already on the server (fastest — nothing to upload)
1. A "Sample inputs on server" card should appear, listing the pre-extracted frame set (`GET /api/pipeline/samples`).
2. Tap it → expect immediate navigation to the job/pipeline detail screen (submits `sample.run_request` as-is, `skip_ingestion: true`).

Equivalent manual check:
```bash
curl http://localhost:8765/api/pipeline/samples
```

### B. Upload a video from the phone
1. Tap **Upload video from files** (or **from gallery**) → pick any small MP4/MOV.
2. Expect the button to show a loading state, then **Video path** auto-fills with a `data/raw/...` path and an "Uploaded: ..." line appears.
3. Tap **Submit job**.

Test this on a **real iOS device** specifically, not just Android/simulator —
`src/api/client.ts:uploadVideo` uses `expo-file-system`'s native upload task
on native platforms (not `fetch`+`FormData`) precisely because iOS is where
`FormData`'s `{uri,name,type}` file-part form is known to fail with
`Unsupported FormData implementation` on the current Expo/RN stack
([expo/expo#33134](https://github.com/expo/expo/issues/33134)). If this ever
regresses, it's most likely someone reverted to `fetch`+`FormData` for
"simplicity" — check that first.

Equivalent manual check (`POST /api/pipeline/upload`, `src/api/client.ts:uploadVideo`):
```bash
curl -X POST http://localhost:8765/api/pipeline/upload -F "file=@drone_clip.mp4;type=video/mp4"
```
Rejects non-video extensions and empty files (400) — worth confirming the app surfaces that error rather than hanging.

### C. Manually typed server path
```
video_path:     data/raw/drone.MOV   (path on the SERVER, not the phone)
fps:            3.0
blur_threshold: 80
utm_epsg:       32644
```
Submit → expect navigation to the job/pipeline detail screen.

Equivalent request (`POST /api/pipeline/run`, `src/api/client.ts:runPipeline`):
```bash
curl -X POST http://localhost:8765/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"video_path": "data/raw/drone.MOV", "fps": 3.0, "blur_threshold": 80, "utm_epsg": 32644}'
```

> Note: A and B are real backend calls; **Pick device video (offline preview)** at the bottom of New Scan is a *separate*, fully local flow (`app/reconstruction/*`, backed by `src/services/mockDb.ts`) that never touches the server — useful for demoing the UX without a backend at all, but don't confuse its fake progress bar with a real job.

## Job Status & Live Logs

`app/pipeline/[jobId].tsx` — poll + WebSocket, backed by `src/hooks/useJobPoller.ts` (HTTP, every 10s) and `src/hooks/useJobSocket.ts` (`ws://.../ws/{id}`).

- Expected: status badge updates (`pending` → `running` → `completed`/`failed`/`cancelled`), log lines stream live.
- `__PING__` messages should not appear as log spam; `__DONE__` should stop the stream and settle final status.

Equivalent manual checks:
```bash
curl http://localhost:8765/api/pipeline/jobs/{JOB_ID}
wscat -c ws://localhost:8765/ws/{JOB_ID}
```

## Jobs List

**Jobs** tab → expect the submitted job to appear with correct status, matching `GET /api/pipeline/jobs`.

## Outputs

**Outputs** tab (`app/outputs/index.tsx`) → expect one card per **run**, newest first ("Run 1" = most recent), each with exactly three rows — **3D Mesh**, **Point Cloud**, **Map** — not a flat file list. A category with no file for that run shows as a dimmed "Not available" row rather than being skipped or crashing.

Expect a run to appear the moment you Connect even with no job submitted this session — this backend already ships one completed run's outputs on disk (`data/output/{job_id}/` — mesh, labelled point cloud, DSM), and `GET /api/outputs` scans disk directly (not just the in-memory job list), so it survives a server restart too. That run's card may show `created_at`/status as blank/`null` if its job predates the current server process — that's expected, not a bug (see `backend/TESTING.md#list-outputs`).

`src/api/client.ts:listOutputRuns` maps the backend's actual response shape (`{total, runs: [{job_id, created_at, status, mesh: [{name, category, size_bytes}], pointcloud: [...], geotiff: [...]}]}`) into the app's `RunOutputs`/`OutputFile` types and rebuilds `download_url`/`preview_url` per-file as absolute, job-scoped, ngrok-safe URLs — if outputs ever silently stop appearing after a backend change, check this mapping first (field-name or route-shape drift here is a likely cause).

Tapping a tile:
- **3D Mesh** → `app/outputs/model.tsx`: prefers `model.glb`; loads via `expo-gl`/`three.js`, orbit controls work.
- **Point Cloud** → `app/outputs/pointcloud.tsx`: prefers `dense_labelled.ply` over plain `dense.ply` (semantic label palette from `src/constants/labelColors.ts`).
- **Map** → `app/outputs/map.tsx`: prefers `dsm.tif`; GeoTIFF/DSM bounds overlay on `react-native-maps`.

Equivalent manual checks (substitute a real `job_id` from the listing):
```bash
curl http://localhost:8765/api/outputs | python3 -m json.tool
curl -OJ http://localhost:8765/api/outputs/download/{JOB_ID}/mesh/model.glb
curl -OJ http://localhost:8765/api/outputs/download/{JOB_ID}/pointcloud/dense_labelled.ply
```

### Multiple runs

Submit a second job (New Scan → a sample input) and let it complete → expect a **second** run card to appear above the first (newest-first), and the first run's card/files to be completely unaffected — each run has its own `data/output/{job_id}/` directory, so nothing gets overwritten.

## Settings

- **Server** (`app/settings/server.tsx`): change/clear backend URL, re-Connect.
- **Defaults** (`app/settings/defaults.tsx`): default fps / blur_threshold / utm_epsg persist across app restarts.
- **Storage**: sample/local data clears correctly.
- **Account**: logout returns to `login.tsx` and clears session.

## Cross-check with backend docs

Any endpoint behavior mismatch between the app and the server should be verified directly against the backend, per `backend/TESTING.md`, before filing it as a frontend bug — most "broken" screens turn out to be a backend job in a `failed`/`pending` state, or the phone simply unable to route to the server IP (see the WSL2 networking note in the repo-root README).
