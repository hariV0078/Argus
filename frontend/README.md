# Argus

**Single-pass drone video → georeferenced 3D reconstruction, on mobile.**

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2057-000.svg?style=flat-square)](https://docs.expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB.svg?style=flat-square&logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Private-lightgrey.svg?style=flat-square)](#license)

Argus is the Android / iOS client for a reconstruction pipeline. An operator submits one UAV flyover (plus GPS / metadata), monitors the job, and inspects the textured mesh, labelled point cloud, and DSM on the device.

Built for **Smart India Hackathon** · NTRO · Software (Robotics and Drones)  
Problem: *Single-Pass Drone Video to Accurate 3D Model Generation System*

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Backend integration](#backend-integration)
- [Repository structure](#repository-structure)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

A single drone pass produces video and telemetry. The backend (OpenDroneMap / COLMAP, filtering, meshing) runs on a workstation. Argus is the field UI:

1. Authenticate the operator.
2. Point the app at the reconstruction server on the LAN.
3. Submit a job (`video_path`, frame rate, blur threshold, UTM EPSG).
4. Stream logs and poll status until the job completes.
5. Open GLB, PLY, and GeoTIFF outputs on-device.

The phone does not reconstruct the scene. It submits work, tracks progress, and renders results.

Without a live server, Argus still runs a **local preview pipeline** and a sample 3D viewer so the product flow can be demonstrated offline.

---

## Features

| Area | What you get |
| --- | --- |
| Auth | Dummy operator login; session persists on device until logout |
| Jobs | Submit, list, and inspect pipeline status |
| Live updates | WebSocket log stream + HTTP poll every 10 seconds |
| 3D mesh | expo-gl + three.js orbit viewer (GLB when the server is connected) |
| Point cloud | Coloured PLY with semantic label palette |
| Map | GeoTIFF / DSM bounds on a satellite map |
| Offline demo | Sample mesh and mock job logs with no backend |

---

## Architecture

```
  Argus (Expo Go)
        │
        │  HTTP  POST /api/pipeline/run
        │  HTTP  GET  /api/pipeline/jobs/{id}
        │  WS    /ws/{id}
        │  HTTP  GET  /api/outputs
        ▼
  FastAPI  :8765
        │
        ▼
  model.glb · dense_labelled.ply · dsm.tif
        │
        ▼
  expo-gl + three.js  /  react-native-maps
```

| Screen | Role |
| --- | --- |
| Home | Backend URL, Connect, recent jobs, sample 3D |
| New Scan | `POST /api/pipeline/run` |
| Jobs | Pipeline + reconstruction job lists |
| Viewer | Mesh viewer; links to point cloud and map |
| Job detail | WebSocket logs and progress |
| Outputs | One card per run (`GET /api/outputs`) — 3D Mesh / Point Cloud / Map |

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Expo SDK 57, React Native, TypeScript |
| Navigation | Expo Router |
| State | Zustand |
| 3D | expo-gl, three.js |
| Maps | react-native-maps |
| Networking | `fetch`, native `WebSocket` |
| Backend | FastAPI on `http://<lan-ip>:8765` |

There is **no frontend database**. Session and server URL are stored on device. `.env` is not required and must not be committed.

---

## Getting started

### Prerequisites

- Node.js 18 or later
- npm
- [Expo Go](https://expo.dev/go) on iOS or Android
- Phone and development machine on the same Wi‑Fi
- Optional: reconstruction API listening on port **8765**

### Install

```bash
git clone https://github.com/<org>/Argus.git
cd Argus
npm install
```

### Run

```bash
npx expo start
```

Scan the QR code with Expo Go. Metro must be started from the **Argus** directory.

| Script | Description |
| --- | --- |
| `npx expo start` | Development server and QR |
| `npx expo start --android` | Open Android (emulator / adb) |
| `npx expo start --ios` | Open iOS Simulator (macOS only) |

---

## Usage

### Demo credentials

| Field | Value |
| --- | --- |
| Email | `ashwinram28102005@ntro.com` |
| Password | `Ashwin@28102005` |

### Offline (no server)

1. Sign in.
2. Do not tap **Connect**.
3. Open the **Viewer** tab, or Home → **Open sample 3D output**.
4. Drag to orbit. This is expo-gl + three.js.

**New Scan → Submit job** with the default path `data/raw/drone.MOV` runs the local preview: logs, then sample mesh, point cloud, and map.

### Live backend

1. Start FastAPI on the workstation (`:8765`).
2. On Home, set Backend URL to `http://<workstation-lan-ip>:8765`.
3. Phone and workstation must share the same network. Do not use `127.0.0.1` on a physical device.
4. Tap **Connect**.
5. **New Scan** — `video_path` is a path **on the server** (for example `data/raw/drone.MOV`), not a file on the phone.
6. Submit → job screen (logs) → **Outputs** → mesh / point cloud / map.

---

## Backend integration

Base URL is entered in the app (Home / Settings). No environment file is required.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/pipeline/upload` | Upload a video picked on-device (multipart) → returns `video_path` |
| `GET` | `/api/pipeline/samples` | Sample inputs already on the server (submit without uploading) |
| `POST` | `/api/pipeline/run` | Start a job |
| `GET` | `/api/pipeline/jobs/{id}` | Job status |
| `WS` | `/ws/{id}` | Log stream (`__DONE__`, `__PING__`) |
| `GET` | `/api/outputs` | Every run's outputs, grouped by `job_id` — one entry per run (mesh / point cloud / geotiff) |
| `GET` | `/api/outputs/download/{job_id}/mesh/model.glb` | Textured mesh from one run |
| `GET` | `/api/outputs/download/{job_id}/pointcloud/dense_labelled.ply` | Labelled cloud from one run |

### Submit body

```json
{
  "video_path": "data/raw/drone.MOV",
  "fps": 3.0,
  "blur_threshold": 80,
  "utm_epsg": 32644
}
```

Job status values: `pending` · `running` · `completed` · `failed` · `cancelled`.

QA checklist covering these endpoints from the app side (login, offline demo, live connect, job submission, outputs): [`TESTING.md`](TESTING.md).

---

## Repository structure

```
Argus/
├── app/                      Expo Router screens
│   ├── login.tsx
│   ├── (tabs)/               Home, New Scan, Jobs, Viewer, Profile
│   ├── pipeline/             Job detail and live logs
│   ├── outputs/              Mesh, point cloud, map
│   ├── reconstruction/       Sample video and metadata flow
│   └── settings/
├── src/
│   ├── api/                  FastAPI client and types
│   ├── components/gl/        expo-gl + three.js viewers
│   ├── hooks/                Job poller and WebSocket
│   ├── store/                Auth, jobs, server state
│   ├── lib/                  Session, sample assets
│   └── theme.ts
├── assets/                   Brand and sample flight / mesh
├── app.json
├── package.json
└── README.md
```

---

## Scripts

```bash
npm install
npx expo start
```

---

## Contributing

This repository is the mobile client for a team project.

- **Clone** is enough to run the app and attach your own backend.
- Direct `git push` requires collaborator access.
- Otherwise fork the repository and open a pull request against `main`.

Please do not commit `.env`, credentials, or machine-local IP addresses.

---

## License

Private — Smart India Hackathon team use. All rights reserved unless the team publishes otherwise.
