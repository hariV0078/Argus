// Default comes from a Vite env var (see .env.example) — pre-fills the
// Backend URL field at build time. It can always be overridden at runtime
// from the Home screen, same as the mobile app.
const DEFAULT_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

let currentUrl = DEFAULT_URL;

export function getDefaultBackendUrl() {
  return DEFAULT_URL;
}

export function getBackendUrl() {
  return currentUrl;
}

export function setBackendUrlValue(url: string) {
  currentUrl = url.replace(/\/$/, '');
  return currentUrl;
}
