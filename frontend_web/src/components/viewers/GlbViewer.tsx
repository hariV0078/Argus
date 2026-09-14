import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  IoCloudUploadOutline,
  IoEyeOutline,
  IoGridOutline,
  IoRefreshOutline,
  IoSyncOutline,
  IoSquareOutline,
  IoFlashOutline,
} from 'react-icons/io5';
import { NGROK_HEADERS } from '../../api/client';
import './viewers.css';

export interface ModelStats {
  vertices: number;
  faces: number;
  format: string;
  sizeX: string;
  sizeY: string;
  sizeZ: string;
}

function addSampleSite(scene: THREE.Scene) {
  const mat = (color: number) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      metalness: 0.2,
    });

  const groundGroup = new THREE.Group();

  // Ground base
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 0.4, 64), mat(0x111a2e));
  ground.position.y = -0.2;
  groundGroup.add(ground);

  // Grid lines on ground
  const grid = new THREE.GridHelper(40, 40, 0x38bdf8, 0x1e293b);
  grid.position.y = 0.01;
  groundGroup.add(grid);

  // Roads
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 36), mat(0x1e293b));
  r1.position.y = 0.02;
  groundGroup.add(r1);

  const r2 = new THREE.Mesh(new THREE.BoxGeometry(36, 0.06, 2.8), mat(0x1e293b));
  r2.position.y = 0.03;
  groundGroup.add(r2);

  // Futuristic city / survey block structures
  const blocks = [
    [-8, 10, -6, 4.5, 4.5, 0x38bdf8],
    [3, 14, -9, 3.8, 3.8, 0x60a5fa],
    [9, 8, 3, 5.2, 4.5, 0x2563eb],
    [-10, 6, 7, 4.2, 5.2, 0x1d4ed8],
    [7, 12, 9, 3.5, 3.5, 0x3b82f6],
    [-2, 4.5, 11, 3.2, 3.8, 0x0ea5e9],
  ] as const;

  blocks.forEach(([x, h, z, w, d, color]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, h / 2, z);
    groundGroup.add(mesh);
  });

  // Trees / vegetation markers
  for (let i = 0; i < 14; i += 1) {
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.8, 8), mat(0x34d399));
    tree.position.set((i % 2 ? 1 : -1) * (12 + (i % 3)), 1.4, -14 + i * 2.2);
    groundGroup.add(tree);
  }

  scene.add(groundGroup);
  return groundGroup;
}

export function GlbViewer({ url, initialFileName }: { url?: string; initialFileName?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<string>(url ? 'Downloading model…' : 'Sample 3D Scene');
  const [err, setErr] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stats, setStats] = useState<ModelStats | null>(null);

  // Interactive Toggles
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [flatShading, setFlatShading] = useState(false);

  // References to Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const currentObjectRef = useRef<THREE.Object3D | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Apply visual options to current loaded object
  const applyMaterialOptions = useCallback((obj: THREE.Object3D, isWireframe: boolean, isFlat: boolean) => {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const updateMat = (mat: THREE.Material) => {
          if ('wireframe' in mat) (mat as THREE.MeshStandardMaterial).wireframe = isWireframe;
          if ('flatShading' in mat) (mat as THREE.MeshStandardMaterial).flatShading = isFlat;
          mat.needsUpdate = true;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(updateMat);
        } else if (mesh.material) {
          updateMat(mesh.material);
        }
      }
    });
  }, []);

  // Compute object telemetry & statistics
  const computeStats = (obj: THREE.Object3D, formatName: string): ModelStats => {
    let vertices = 0;
    let faces = 0;
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());

    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const geom = (child as THREE.Mesh).geometry;
        if (geom) {
          if (geom.attributes.position) {
            vertices += geom.attributes.position.count;
          }
          if (geom.index) {
            faces += geom.index.count / 3;
          } else if (geom.attributes.position) {
            faces += geom.attributes.position.count / 3;
          }
        }
      }
    });

    return {
      vertices: Math.round(vertices),
      faces: Math.round(faces),
      format: formatName.toUpperCase(),
      sizeX: size.x.toFixed(2),
      sizeY: size.y.toFixed(2),
      sizeZ: size.z.toFixed(2),
    };
  };

  // Helper to dispose Three.js geometry and materials
  const disposeObject = (obj: THREE.Object3D) => {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
  };

  // Load model buffer into Three.js scene
  const loadBufferIntoScene = useCallback(
    (buffer: ArrayBuffer, fileName: string) => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!scene || !camera || !controls) return;

      // Clear previous model if exists
      if (currentObjectRef.current) {
        scene.remove(currentObjectRef.current);
        disposeObject(currentObjectRef.current);
        currentObjectRef.current = null;
      }

      // Sanitize filename to strip query parameters (e.g. ?ngrok-skip-browser-warning=true) and hash
      const cleanFileName = (fileName || '').split('?')[0].split('#')[0] || 'model.glb';
      const ext = cleanFileName.split('.').pop()?.toLowerCase() || 'glb';
      const basePath = url ? url.substring(0, url.lastIndexOf('/') + 1) : '';

      setStatus(`Parsing ${cleanFileName}…`);
      setErr(null);

      const onParsed = (object3d: THREE.Object3D, formatLabel: string) => {
        scene.add(object3d);
        currentObjectRef.current = object3d;

        // Center and scale object
        const box = new THREE.Box3().setFromObject(object3d);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        object3d.position.sub(center);

        const radius = size.length() || 1;
        const dist = Math.max(1, radius * 0.85);
        camera.position.set(dist * 0.7, dist * 0.5, dist * 0.7);
        controls.target.set(0, 0, 0);
        controls.update();

        applyMaterialOptions(object3d, wireframe, flatShading);
        const computed = computeStats(object3d, formatLabel);
        setStats(computed);
        setStatus(`Loaded ${cleanFileName}`);
      };

      try {
        if (ext === 'obj') {
          const text = new TextDecoder().decode(buffer);
          const obj = new OBJLoader().parse(text);
          onParsed(obj, 'OBJ');
        } else if (ext === 'stl') {
          const geom = new STLLoader().parse(buffer);
          const mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4, metalness: 0.5 });
          const mesh = new THREE.Mesh(geom, mat);
          onParsed(mesh, 'STL');
        } else if (ext === 'ply') {
          const geom = new PLYLoader().parse(buffer);
          const hasColor = !!geom.getAttribute('color');
          const mat = new THREE.MeshStandardMaterial({
            color: hasColor ? undefined : 0x38bdf8,
            vertexColors: hasColor,
            roughness: 0.5,
          });
          const mesh = new THREE.Mesh(geom, mat);
          onParsed(mesh, 'PLY');
        } else {
          // Default: GLTF/GLB
          new GLTFLoader().parse(
            buffer,
            basePath,
            (gltf) => {
              onParsed(gltf.scene, 'GLTF/GLB');
            },
            (err) => {
              console.error('GLTF parse error', err);
              const msg =
                err instanceof Error
                  ? err.message
                  : typeof err === 'string'
                  ? err
                  : err && typeof err === 'object' && 'message' in err
                  ? String((err as { message: unknown }).message)
                  : 'Invalid format or corrupted file';
              setErr(`Failed to parse 3D GLB/GLTF model: ${msg}`);
              setStatus('Error parsing model');
            }
          );
        }
      } catch (e) {
        console.error(e);
        setErr(e instanceof Error ? e.message : 'Failed to import 3D model');
        setStatus('Import error');
      }
    },
    [applyMaterialOptions, flatShading, url, wireframe]
  );

  // Handle local file selection or drag and drop
  const handleFileImport = (file: File) => {
    const reader = new FileReader();
    setStatus(`Reading ${file.name}…`);
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        loadBufferIntoScene(e.target.result, file.name);
      }
    };
    reader.onerror = () => {
      setErr('Could not read file from disk');
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let frame = 0;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x090d16);

    // Grid helper
    const gridHelper = new THREE.GridHelper(30, 30, 0x38bdf8, 0x1e293b);
    gridHelperRef.current = gridHelper;
    scene.add(gridHelper);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 20000);
    cameraRef.current = camera;
    camera.position.set(18, 14, 18);

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.2;
    controls.maxDistance = 5000;

    // Lighting setup
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));

    const sun = new THREE.DirectionalLight(0x38bdf8, 1.2);
    sun.position.set(12, 18, 10);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x60a5fa, 0.5);
    fill.position.set(-10, 6, -10);
    scene.add(fill);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(0, -10, 10);
    scene.add(keyLight);

    // Responsive resize handler
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

    // Load initial URL model or sample scene
    (async () => {
      let loadedReal = false;
      if (url) {
        try {
          setStatus('Downloading model…');
          // Explicit header, not just the URL's own ?ngrok-skip-browser-warning
          // query param — a plain fetch() we control should always send the
          // real header (see NGROK_HEADERS' doc comment in api/client.ts).
          const res = await fetch(url, { headers: NGROK_HEADERS });
          if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
          const buffer = await res.arrayBuffer();
          if (!disposed) {
            loadBufferIntoScene(buffer, initialFileName || url);
            loadedReal = true;
          }
        } catch (e) {
          if (!disposed) {
            setErr(e instanceof Error ? e.message : 'Could not fetch 3D model file');
          }
        }
      }

      if (!loadedReal && !disposed) {
        const sampleGroup = addSampleSite(scene);
        currentObjectRef.current = sampleGroup;
        camera.position.set(22, 16, 22);
        controls.update();
        setStatus('Sample 3D Output Scene');
        setStats({
          vertices: 4850,
          faces: 3200,
          format: 'SAMPLE',
          sizeX: '36.00',
          sizeY: '14.00',
          sizeZ: '36.00',
        });
      }
    })();

    // Animation Loop
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
  }, [autoRotate, initialFileName, loadBufferIntoScene, url]);

  // Effect for interactive controls state updates
  useEffect(() => {
    if (currentObjectRef.current) {
      applyMaterialOptions(currentObjectRef.current, wireframe, flatShading);
    }
  }, [wireframe, flatShading, applyMaterialOptions]);

  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current && currentObjectRef.current) {
      const box = new THREE.Box3().setFromObject(currentObjectRef.current);
      const size = box.getSize(new THREE.Vector3());
      const radius = size.length() || 1;
      const dist = Math.max(1, radius * 0.85);
      cameraRef.current.position.set(dist * 0.7, dist * 0.5, dist * 0.7);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div
      className="viewer-wrap"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) {
          handleFileImport(e.dataTransfer.files[0]);
        }
      }}>
      {/* Hidden file input for custom 3D model import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,.obj,.stl,.ply"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFileImport(e.target.files[0]);
          }
        }}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="viewer-drop-overlay">
          <IoCloudUploadOutline size={48} />
          <div style={{ fontWeight: 700, fontSize: 18 }}>Drop 3D Mesh File Here</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Supports .GLB, .GLTF, .OBJ, .STL, .PLY</div>
        </div>
      )}

      {/* 3D Canvas Mounting Area */}
      <div className="viewer-canvas" ref={mountRef} />

      {/* Model Statistics & Telemetry Overlay */}
      {stats && (
        <div className="viewer-stats-panel">
          <div className="viewer-stat-row">
            <span>FORMAT</span>
            <span className="viewer-stat-val" style={{ color: 'var(--signal)' }}>{stats.format}</span>
          </div>
          <div className="viewer-stat-row">
            <span>VERTICES</span>
            <span className="viewer-stat-val">{stats.vertices.toLocaleString()}</span>
          </div>
          <div className="viewer-stat-row">
            <span>FACES</span>
            <span className="viewer-stat-val">{stats.faces.toLocaleString()}</span>
          </div>
          <div className="viewer-stat-row">
            <span>BOUNDS</span>
            <span className="viewer-stat-val">{stats.sizeX}m × {stats.sizeY}m × {stats.sizeZ}m</span>
          </div>
        </div>
      )}

      {/* Interactive Floating Viewer Controls Toolbar */}
      <div className="viewer-toolbar">
        <button
          className={`viewer-tool-btn ${wireframe ? 'active' : ''}`}
          title="Toggle Wireframe"
          onClick={() => setWireframe((v) => !v)}>
          <IoGridOutline size={18} />
        </button>
        <button
          className={`viewer-tool-btn ${showGrid ? 'active' : ''}`}
          title="Toggle Grid"
          onClick={() => setShowGrid((v) => !v)}>
          <IoSquareOutline size={18} />
        </button>
        <button
          className={`viewer-tool-btn ${flatShading ? 'active' : ''}`}
          title="Toggle Flat Shading"
          onClick={() => setFlatShading((v) => !v)}>
          <IoFlashOutline size={18} />
        </button>
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

      {/* Import & Status Bar */}
      <div className="viewer-import-bar">
        <div className="viewer-status-chip">
          <IoEyeOutline size={16} color="var(--signal)" />
          {err ? (
            <span style={{ color: 'var(--red)' }}>{err}</span>
          ) : (
            <span>{status} · Drag to orbit, scroll to zoom</span>
          )}
        </div>
        <button className="viewer-upload-btn" onClick={() => fileInputRef.current?.click()}>
          <IoCloudUploadOutline size={16} /> Import 3D Mesh
        </button>
      </div>
    </div>
  );
}
