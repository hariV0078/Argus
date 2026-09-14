import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    result = null;
    onloadend = null;
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, '..', 'assets', 'sample');
mkdirSync(outDir, { recursive: true });

const scene = new THREE.Scene();
const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(18, 18, 0.3, 48),
  new THREE.MeshStandardMaterial({ color: 0x16382c }),
);
ground.position.y = -0.15;
scene.add(ground);

scene.add(
  new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 28), new THREE.MeshStandardMaterial({ color: 0x2a2f3a })),
);

const palette = [0x64748b, 0x94a3b8, 0x7c8aa0, 0x5b6b82, 0xc4a35a];
const boxes = [
  [-7, 4.5, -5, 4, 9, 4],
  [2, 6, -8, 3.4, 12, 3.4],
  [8, 3.2, 2, 5, 6.4, 4],
  [-9, 2.4, 6, 4, 4.8, 5],
  [6, 5, 8, 3, 10, 3],
];
boxes.forEach(([x, y, z, w, h, d], i) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: palette[i % palette.length] }),
  );
  mesh.position.set(x, y / 2, z);
  scene.add(mesh);
});

for (let i = 0; i < 10; i += 1) {
  const tree = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x166534 }),
  );
  tree.position.set((i % 2 ? 1 : -1) * (10 + (i % 3)), 1.2, -12 + i * 2.2);
  scene.add(tree);
}

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, { binary: true });
const buffer = Buffer.from(glb);
const dest = join(outDir, 'model.glb');
writeFileSync(dest, buffer);
console.log(`Wrote ${dest} (${buffer.length} bytes)`);
