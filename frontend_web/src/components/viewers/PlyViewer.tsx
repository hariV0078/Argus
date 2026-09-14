import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { IoCloudUploadOutline, IoEyeOutline, IoRefreshOutline, IoSyncOutline } from 'react-icons/io5';
import { NGROK_HEADERS } from '../../api/client';
import { LABEL_COLORS } from '../../lib/labelColors';
import './viewers.css';

function makeSemanticCloud() {
  const count = 5200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = LABEL_COLORS.map((hex) => new THREE.Color(hex));

  for (let i = 0; i < count; i += 1) {
    const label = i % 6;
    const x = (Math.random() - 0.5) * 24;
    const z = (Math.random() - 0.5) * 24;
    const y = label === 1 ? Math.random() * 8.5 : label === 3 ? 0.4 + Math.random() * 2.2 : Math.random() * 0.7;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    const c = palette[label];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: true, size: 0.1 }));
}

export function PlyViewer({ url }: { url?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<string>(url ? 'Downloading point cloud…' : 'Sample Point Cloud');
  const [err, setErr] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [pointCount, setPointCount] = useState<number | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cloudObjRef = useRef<THREE.Points | null>(null);

  const loadPlyBuffer = (buffer: ArrayBuffer, name: string) => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    if (cloudObjRef.current) {
      scene.remove(cloudObjRef.current);
      cloudObjRef.current = null;
    }

    try {
      const geometry = new PLYLoader().parse(buffer);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const center = box.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
      const size = box.getSize(new THREE.Vector3());
      const radius = size.length() || 1;
      const dist = Math.max(0.5, radius * 0.9);

      camera.position.set(dist * 0.6, dist * 0.45, dist * 0.6);
      controls.target.set(0, 0, 0);
      controls.update();

      const hasColor = !!geometry.getAttribute('color');
      const count = geometry.getAttribute('position')?.count || 0;
      setPointCount(count);

      const material = new THREE.PointsMaterial({
        size: Math.max(radius * 0.002, 0.03),
        vertexColors: hasColor,
        color: hasColor ? undefined : 0x38bdf8,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);
      cloudObjRef.current = points;

      setStatus(`Loaded ${name}`);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not parse PLY point cloud');
      setStatus('Error loading PLY');
    }
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let frame = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x090d16);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.02, 20000);
    cameraRef.current = camera;
    camera.position.set(14, 9, 14);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.2;
    controls.maxDistance = 5000;

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    (async () => {
      let loadedReal = false;
      if (url) {
        try {
          // Explicit header, not just the URL's own ?ngrok-skip-browser-warning
          // query param — a plain fetch() we control should always send the
          // real header (see NGROK_HEADERS' doc comment in api/client.ts).
          const res = await fetch(url, { headers: NGROK_HEADERS });
          if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
          const buffer = await res.arrayBuffer();
          if (!disposed) {
            const rawName = url.split('/').pop() || 'pointcloud.ply';
            const cleanName = rawName.split('?')[0].split('#')[0] || 'pointcloud.ply';
            loadPlyBuffer(buffer, cleanName);
            loadedReal = true;
          }
        } catch (e) {
          if (!disposed) setErr(e instanceof Error ? e.message : 'Could not load point cloud');
        }
      }

      if (!loadedReal && !disposed) {
        const cloud = makeSemanticCloud();
        scene.add(cloud);
        cloudObjRef.current = cloud;
        camera.position.set(16, 10, 16);
        controls.update();
        setPointCount(5200);
        setStatus('Sample Semantic Point Cloud');
      }
    })();

    const tick = () => {
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotate;
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [autoRotate, url]);

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(14, 9, 14);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="viewer-wrap">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ply"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result instanceof ArrayBuffer) {
                loadPlyBuffer(ev.target.result, file.name);
              }
            };
            reader.readAsArrayBuffer(file);
          }
        }}
      />

      <div className="viewer-canvas" ref={mountRef} />

      {pointCount !== null && (
        <div className="viewer-stats-panel">
          <div className="viewer-stat-row">
            <span>FORMAT</span>
            <span className="viewer-stat-val" style={{ color: 'var(--signal)' }}>PLY</span>
          </div>
          <div className="viewer-stat-row">
            <span>POINTS</span>
            <span className="viewer-stat-val">{pointCount.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="viewer-toolbar">
        <button
          className={`viewer-tool-btn ${autoRotate ? 'active' : ''}`}
          title="Toggle Auto-Rotate"
          onClick={() => setAutoRotate((v) => !v)}>
          <IoSyncOutline size={18} />
        </button>
        <button className="viewer-tool-btn" title="Reset View" onClick={resetCamera}>
          <IoRefreshOutline size={18} />
        </button>
      </div>

      <div className="viewer-import-bar">
        <div className="viewer-status-chip">
          <IoEyeOutline size={16} color="var(--signal)" />
          {err ? (
            <span style={{ color: 'var(--red)' }}>{err}</span>
          ) : (
            <span>{status} · Drag to orbit</span>
          )}
        </div>
        <button className="viewer-upload-btn" onClick={() => fileInputRef.current?.click()}>
          <IoCloudUploadOutline size={16} /> Import PLY Cloud
        </button>
      </div>
    </div>
  );
}
