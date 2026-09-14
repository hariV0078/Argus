import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

export async function resolveSampleGlbUri(): Promise<string> {
  const asset = Asset.fromModule(require('../../assets/sample/model.glb'));
  await asset.downloadAsync();
  if (!asset.localUri && !asset.uri) {
    throw new Error('Sample GLB is missing from the app bundle.');
  }
  return asset.localUri || asset.uri;
}

export async function readUriBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(uri);
    if (res.ok) return res.arrayBuffer();
  } catch {
    /* file:// fetch can fail on Android */
  }
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
