import { create } from 'zustand';
import { clearSession, loadSession, saveSession } from '@/src/lib/session';
import { MOCK_USER } from '@/src/services/mockDb';

export const DUMMY_EMAIL = 'ashwinram28102005@ntro.com';
export const DUMMY_PASSWORD = 'Ashwin@28102005';

type AuthState = {
  hydrated: boolean;
  loggedIn: boolean;
  name: string;
  email: string;
  org: string;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  loggedIn: false,
  name: '',
  email: '',
  org: '',
  error: null,
  hydrate: async () => {
    try {
      if (get().hydrated && get().loggedIn) return;
      const session = await loadSession();
      if (session) {
        set({
          hydrated: true,
          loggedIn: true,
          name: session.name,
          email: session.email,
          org: session.org,
          error: null,
        });
        return;
      }
    } catch {
      /* keep going */
    }
    set({ hydrated: true });
  },
  login: async (email, password) => {
    const e = email.trim().toLowerCase();
    if (e !== DUMMY_EMAIL.toLowerCase() || password !== DUMMY_PASSWORD) {
      set({ error: 'Invalid credentials', loggedIn: false });
      return false;
    }
    const session = {
      loggedIn: true as const,
      name: MOCK_USER.name,
      email: MOCK_USER.email,
      org: MOCK_USER.org,
    };
    await saveSession(session);
    set({ ...session, hydrated: true, error: null });
    return true;
  },
  logout: async () => {
    await clearSession();
    set({ loggedIn: false, name: '', email: '', org: '', error: null, hydrated: true });
  },
  clearError: () => set({ error: null }),
}));
