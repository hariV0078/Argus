async function asyncGet(key: string): Promise<string | null> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function asyncSet(key: string, value: string) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function fileUri(name: string): string | null {
  try {
    const FS = require('expo-file-system/legacy') as { documentDirectory: string | null };
    return FS.documentDirectory ? `${FS.documentDirectory}${name}` : null;
  } catch {
    return null;
  }
}

async function fileGet(name: string): Promise<string | null> {
  try {
    const uri = fileUri(name);
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

async function fileSet(name: string, value: string) {
  try {
    const uri = fileUri(name);
    if (!uri) return;
    const FS = require('expo-file-system/legacy') as {
      writeAsStringAsync: (u: string, v: string) => Promise<void>;
    };
    await FS.writeAsStringAsync(uri, value);
  } catch {
    /* ignore */
  }
}

export async function loadJson<T>(key: string, file: string): Promise<T | null> {
  const raw = (await asyncGet(key)) ?? (await fileGet(file));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveJson(key: string, file: string, value: unknown) {
  const raw = JSON.stringify(value);
  await Promise.all([asyncSet(key, raw), fileSet(file, raw)]);
}
