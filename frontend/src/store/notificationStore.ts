import { create } from 'zustand';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  jobId?: string;
  read: boolean;
  createdAt: string;
};

const seed: AppNotification[] = [
  {
    id: 'n1',
    title: 'Campus Survey ready',
    body: '3D model is ready.',
    jobId: 'job_campus',
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n2',
    title: 'Highway Segment ready',
    body: 'Reconstruction complete.',
    jobId: 'job_highway',
    read: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'n3',
    title: 'Night Recon failed',
    body: 'Reconstruction failed. Retry from Jobs.',
    jobId: 'job_night',
    read: false,
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
  },
];

type NoteState = {
  items: AppNotification[];
  push: (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
};

export const useNotificationStore = create<NoteState>((set, get) => ({
  items: seed,
  push: (n) =>
    set({
      items: [
        {
          ...n,
          id: `n_${Date.now()}`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...get().items,
      ],
    }),
  markAllRead: () => set({ items: get().items.map((i) => ({ ...i, read: true })) }),
  markRead: (id) => set({ items: get().items.map((i) => (i.id === id ? { ...i, read: true } : i)) }),
}));
