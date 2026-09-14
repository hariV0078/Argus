const DEFAULT_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

let currentUrl = DEFAULT_URL.replace(/\/$/, '');

export function getDefaultBackendUrl() {
  return DEFAULT_URL.replace(/\/$/, '');
}

export function getBackendUrl() {
  return currentUrl;
}

export function setBackendUrlValue(url: string) {
  currentUrl = url.replace(/\/$/, '');
  return currentUrl;
}
