// Thin localStorage wrappers — the web equivalent of the mobile app's
// AsyncStorage-backed session/server persistence. Every call is wrapped so a
// private-browsing tab or blocked storage never throws into caller code.

export function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore — storage full or blocked */
  }
}

export function clearKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
