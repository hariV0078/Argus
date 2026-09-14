export type Session = {
  loggedIn: true;
  name: string;
  email: string;
  org: string;
};

const KEY = 'argus.session.v1';
const FILE = 'argus-session.json';

declare global {
  // Survives Fast Refresh of other modules in the same JS runtime.
  var __ARGUS_SESSION: Session | null | undefined;
}

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
    /* Expo Go may not expose the native module */
  }
}

async function asyncDel() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem(KEY);
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

async function fileDel() {
  try {
    const uri = fileUri();
    if (!uri) return;
    const FS = require('expo-file-system/legacy') as {
      deleteAsync: (u: string, opts?: { idempotent?: boolean }) => Promise<void>;
    };
    await FS.deleteAsync(uri, { idempotent: true });
  } catch {
    /* ignore */
  }
}

function parse(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Session;
    if (data?.loggedIn && data.email && data.name) return data;
  } catch {
    /* ignore */
  }
  return null;
}

export async function loadSession(): Promise<Session | null> {
  if (globalThis.__ARGUS_SESSION) return globalThis.__ARGUS_SESSION;
  const session = parse((await asyncGet()) ?? (await fileGet()));
  globalThis.__ARGUS_SESSION = session;
  return session;
}

export async function saveSession(session: Session) {
  globalThis.__ARGUS_SESSION = session;
  const raw = JSON.stringify(session);
  await Promise.all([asyncSet(raw), fileSet(raw)]);
}

export async function clearSession() {
  globalThis.__ARGUS_SESSION = null;
  await Promise.all([asyncDel(), fileDel()]);
}
