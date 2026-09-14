import { ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';

function ensureContextAttributes(gl: ExpoWebGLRenderingContext) {
  if (typeof gl.getContextAttributes === 'function' && gl.getContextAttributes()) {
    return;
  }
  gl.getContextAttributes = () => ({
    alpha: false,
    antialias: false,
    depth: true,
    failIfMajorPerformanceCaveat: false,
    powerPreference: 'default',
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
    desynchronized: false,
    xrCompatible: false,
  });
}

/** Expo Go's gl object is still `instanceof WebGLRenderingContext`. Three r163+ throws on that. */
function asWebGL2Context(gl: ExpoWebGLRenderingContext): ExpoWebGLRenderingContext {
  ensureContextAttributes(gl);
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const value = Reflect.get(gl as object, prop);
        return typeof value === 'function' ? value.bind(gl) : value;
      },
      set(_target, prop, value) {
        Reflect.set(gl as object, prop, value);
        return true;
      },
      has(_target, prop) {
        return Reflect.has(gl as object, prop);
      },
    },
  ) as ExpoWebGLRenderingContext;
}

export function createExpoRenderer(gl: ExpoWebGLRenderingContext) {
  const context = asWebGL2Context(gl);
  const canvas = {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    clientWidth: gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
    style: {},
    addEventListener() {},
    removeEventListener() {},
    getContext: () => context,
  };

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas as never,
    context: context as never,
  });
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
  renderer.setClearColor('#081210');

  // three's WebGLProgram runs a first-use shader-error check that calls
  // `gl.getProgramInfoLog(program).trim()` / `getShaderInfoLog(...).trim()`.
  // Real WebGL always returns a string (possibly empty) from those; expo-gl's
  // shim returns `undefined`, so `.trim()` throws "Cannot read property
  // 'trim' of undefined" on the very first draw call of any shader. The
  // check is a debug-only diagnostic (three still throws its own real link
  // errors independently), so disable it rather than work around expo-gl.
  renderer.debug.checkShaderErrors = false;

  return renderer;
}
