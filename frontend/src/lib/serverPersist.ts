const KEY = 'argus.server.v1';
const FILE = 'argus-server.json';

type Saved = { url: string; epsg: number };

async function asyncGet(): Promise<string | null> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

async function asyncSet(value: string) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(KEY, value);
  } catch {
    /* ignore */
  }
}

function fileUri(): string | null {
  try {
    const FS = require('expo-file-system/legacy') as { documentDirectory: string | null };
    return FS.documentDirectory ? `${FS.documentDirectory}${FILE}` : null;
  } catch {
    return null;
  }
}

async function fileGet(): Promise<string | null> {
  try {
    const uri = fileUri();
    if (!uri) return null;
    const FS = require('expo-file-system/legacy') as {
      getInfoAsync: (u: string) => Promise<{ exists: boolean }>;
      readAsStringAsync: (u: string) => Promise<string>;
    };
    const info = await FS.getInfoAsync(uri);
    if (!info.exists) return null;
    return await FS.readAsStringAsync(uri);
  } catch {
    return null;
  }
}

async function fileSet(value: string) {
  try {
    const uri = fileUri();
    if (!uri) return;
    const FS = require('expo-file-system/legacy') as {
      writeAsStringAsync: (u: string, v: string) => Promise<void>;
    };
    await FS.writeAsStringAsync(uri, value);
  } catch {
    /* ignore */
  }
}

export async function loadServerConfig(): Promise<Saved | null> {
  const raw = (await asyncGet()) ?? (await fileGet());
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Saved;
    if (data?.url) return data;
  } catch {
    /* ignore */
  }
  return null;
}

export async function saveServerConfig(saved: Saved) {
  const raw = JSON.stringify(saved);
  await Promise.all([asyncSet(raw), fileSet(raw)]);
}
