import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
// @ts-ignore — three's examples/jsm has no bundled type declarations for this subpath
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createExpoRenderer } from '@/src/components/gl/createRenderer';
import { ModelViewer } from '@/src/components/viewer/ModelViewer';

// GLTFLoader does Safari/Firefox feature-detection via
// `navigator.userAgent.match(...)` (browser-only assumption, no defensive
// check) — React Native's minimal `navigator` global doesn't define
// `userAgent`, so parsing any real GLB throws "Cannot read property
// 'match' of undefined" the moment GLTFLoader is instantiated. Polyfill it
// once, module-level, before any GLTFLoader use. PLYLoader has no such
// dependency and doesn't need this.
if (typeof navigator === 'undefined') {
  // @ts-ignore — RN doesn't declare a full browser `Navigator` type
  global.navigator = { userAgent: 'ReactNative' };
} else if (!navigator.userAgent) {
  // @ts-ignore — same: userAgent isn't part of RN's navigator type
  navigator.userAgent = 'ReactNative';
}

type Props = {
  url?: string;
};

const SAMPLE_LAYERS = {
  buildings: true,
  roads: true,
  terrain: true,
  vegetation: true,
  dynamic: false,
};

export function GlbViewer({ url }: Props) {
  const yaw = useRef(0.85);
  // pitch is an orbit angle in radians above the horizontal plane, not a
  // fixed height — keeps the camera framing correct regardless of the
  // loaded model's real-world scale (which varies run to run).
  const pitch = useRef(0.42);
  const distance = useRef(22);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>(url ? 'loading' : 'ready');
  const [usingSample, setUsingSample] = useState(!url);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        yaw.current += g.dx * 0.005;
        pitch.current = Math.max(0.05, Math.min(1.4, pitch.current - g.dy * 0.005));
      },
    }),
  ).current;

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    try {
      const renderer = createExpoRenderer(gl);
      const width = Math.max(1, gl.drawingBufferWidth);
      const height = Math.max(1, gl.drawingBufferHeight);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0c1c18);
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 20000);

      // Real exported meshes carry vertex colors but no baked lighting —
      // the old fake scene used MeshBasicMaterial (unlit), so this was
      // never needed before; a real glTF's PBR material needs actual
      // light sources or it renders solid black.
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const sun = new THREE.DirectionalLight(0xffffff, 0.9);
      sun.position.set(8, 14, 6);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xffffff, 0.35);
      fill.position.set(-6, 4, -8);
      scene.add(fill);

      let loadedReal = false;
      if (url) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Download failed (${res.status})`);
          const buffer = await res.arrayBuffer();
          const gltf: any = await new Promise((resolve, reject) => {
            new GLTFLoader().parse(buffer, '', resolve, reject);
          });
          scene.add(gltf.scene);

          // Centre the model at the origin and pick an orbit distance from
          // its actual size — a Toledo-scale (hundreds of metres) survey
          // and a tabletop-scale test object need very different framing.
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          gltf.scene.position.sub(center);
          const radius = size.length() || 1;
          distance.current = Math.max(0.5, radius * 0.8);
          loadedReal = true;
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Could not load model');
        }
      }

      if (!loadedReal) {
        addSampleSite(scene);
        distance.current = 22;
        setUsingSample(true);
      }
      setStatus('ready');

      const tick = () => {
        yaw.current += loadedReal ? 0.0012 : 0.003;
        const r = distance.current;
        camera.position.set(
          r * Math.cos(yaw.current) * Math.cos(pitch.current),
          r * Math.sin(pitch.current),
          r * Math.sin(yaw.current) * Math.cos(pitch.current),
        );
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        gl.endFrameEXP();
        requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start 3D renderer');
    }
  };

  if (err) {
    return (
      <View style={styles.wrap}>
        <ModelViewer title="Sample output" scene="campus" layers={SAMPLE_LAYERS} />
        <Text style={styles.status}>{err} · showing sample instead</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} {...pan.panHandlers}>
      <GLView style={styles.gl} onContextCreate={onContextCreate} />
      <Text style={styles.status}>
        {status === 'loading'
          ? 'Downloading model…'
          : usingSample
            ? 'Sample 3D output · drag to orbit'
            : 'Drag to orbit'}
      </Text>
    </View>
  );
}

function mat(color: number) {
  return new THREE.MeshBasicMaterial({ color });
}

function addSampleSite(scene: THREE.Scene) {
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 0.35, 48), mat(0x2f6b4a));
  ground.position.y = -0.18;
  scene.add(ground);

  const road = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 30), mat(0x4b5563));
  scene.add(road);
  const road2 = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 2.4), mat(0x374151));
  scene.add(road2);

  const blocks = [
    [-7, 9, -5, 4, 4, 0x7dd3c0],
    [2, 12, -8, 3.4, 3.4, 0xf4d35e],
    [8, 6.4, 2, 5, 4, 0x93c5fd],
    [-9, 4.8, 6, 4, 5, 0xc4a35a],
    [6, 10, 8, 3, 3, 0xf97316],
    [-2, 3.2, 10, 3, 3.6, 0xa78bfa],
  ] as const;
  blocks.forEach(([x, h, z, w, d, color]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
  });

  for (let i = 0; i < 12; i += 1) {
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.6, 8), mat(0x22c55e));
    tree.position.set((i % 2 ? 1 : -1) * (11 + (i % 3)), 1.3, -13 + i * 2.1);
    scene.add(tree);
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 420, backgroundColor: '#0c1c18' },
  gl: { flex: 1, minHeight: 420, width: '100%' },
  status: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    color: '#E7F2EC',
    textAlign: 'center',
    fontSize: 13,
  },
});
