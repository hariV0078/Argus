import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
// @ts-ignore — three's examples/jsm has no bundled type declarations for this subpath
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { createExpoRenderer } from '@/src/components/gl/createRenderer';
import { LABEL_COLORS } from '@/src/constants/labelColors';

type Props = {
  url?: string;
};

export function PlyViewer({ url }: Props) {
  const yaw = useRef(0.8);
  const distance = useRef(16);
  const [status, setStatus] = useState<'loading' | 'ready'>(url ? 'loading' : 'ready');
  const [err, setErr] = useState<string | null>(null);
  const [usingSample, setUsingSample] = useState(!url);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        yaw.current += g.dx * 0.004;
      },
    }),
  ).current;

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    const renderer = createExpoRenderer(gl);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x081210);
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.02, 20000);
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));

    let loadedReal = false;
    if (url) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const buffer = await res.arrayBuffer();
        const geometry = new PLYLoader().parse(buffer);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const center = box.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
        const size = box.getSize(new THREE.Vector3());
        const radius = size.length() || 1;
        distance.current = Math.max(0.5, radius * 0.9);

        const hasColor = !!geometry.getAttribute('color');
        const material = new THREE.PointsMaterial({
          size: Math.max(radius * 0.0015, 0.02),
          vertexColors: hasColor,
          color: hasColor ? undefined : 0x7dd3c0,
        });
        scene.add(new THREE.Points(geometry, material));
        loadedReal = true;
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not load point cloud');
      }
    }

    if (!loadedReal) {
      scene.add(makeSemanticCloud());
      distance.current = 16;
      setUsingSample(true);
    }
    setStatus('ready');

    const animate = () => {
      requestAnimationFrame(animate);
      yaw.current += loadedReal ? 0.0012 : 0.003;
      const r = distance.current;
      camera.position.set(Math.cos(yaw.current) * r, r * 0.45, Math.sin(yaw.current) * r);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  return (
    <View style={styles.wrap} {...pan.panHandlers}>
      <GLView style={styles.gl} onContextCreate={onContextCreate} />
      <Text style={styles.status}>
        {status === 'loading'
          ? 'Downloading point cloud…'
          : err
            ? `${err} · showing sample instead`
            : usingSample
              ? 'Sample point cloud · drag to orbit'
              : 'Drag to orbit'}
      </Text>
    </View>
  );
}

function makeSemanticCloud() {
  const count = 4200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = LABEL_COLORS.map((hex) => new THREE.Color(hex));

  for (let i = 0; i < count; i += 1) {
    const label = i % 6;
    const x = (Math.random() - 0.5) * 22;
    const z = (Math.random() - 0.5) * 22;
    const y =
      label === 1 ? Math.random() * 8 : label === 3 ? 0.4 + Math.random() * 2 : Math.random() * 0.6;
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
  const material = new THREE.PointsMaterial({ vertexColors: true, size: 0.08 });
  return new THREE.Points(geometry, material);
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 300, backgroundColor: '#081210' },
  gl: { flex: 1 },
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
