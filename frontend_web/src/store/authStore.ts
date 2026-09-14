import { create } from 'zustand';
import { clearKey, loadJSON, saveJSON } from '../lib/persist';

export const DUMMY_EMAIL = 'ashwinram28102005@ntro.com';
export const DUMMY_PASSWORD = 'Ashwin@28102005';

const SESSION_KEY = 'argus.session';

type Session = { name: string; email: string; org: string };

type AuthState = {
  hydrated: boolean;
  loggedIn: boolean;
  name: string;
  email: string;
  org: string;
  error: string | null;
  hydrate: () => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  loggedIn: false,
  name: '',
  email: '',
  org: '',
  error: null,
  hydrate: () => {
    const session = loadJSON<Session>(SESSION_KEY);
    if (session) {
      set({ hydrated: true, loggedIn: true, ...session, error: null });
      return;
    }
    set({ hydrated: true });
  },
  login: (email, password) => {
    const e = email.trim().toLowerCase();
    if (e !== DUMMY_EMAIL.toLowerCase() || password !== DUMMY_PASSWORD) {
      set({ error: 'Invalid credentials', loggedIn: false });
      return false;
    }
    const session: Session = { name: 'Ashwin Ram', email: DUMMY_EMAIL, org: 'NTRO' };
    saveJSON(SESSION_KEY, session);
    set({ ...session, loggedIn: true, hydrated: true, error: null });
    return true;
  },
  logout: () => {
    clearKey(SESSION_KEY);
    set({ loggedIn: false, name: '', email: '', org: '', error: null, hydrated: true });
  },
  clearError: () => set({ error: null }),
}));
