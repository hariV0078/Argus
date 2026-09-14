declare module 'three';
declare module 'three/examples/jsm/loaders/GLTFLoader.js';
declare module 'three/examples/jsm/loaders/PLYLoader.js';
declare module '*.glb' {
  const asset: number;
  export default asset;
}
