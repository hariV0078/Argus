import { create } from 'zustand';
import { ReconstructionMode, SemanticLayer } from '@/src/types/reconstruction';

type SettingsState = {
  reconstructionMode: ReconstructionMode;
  removeCars: boolean;
  removePeople: boolean;
  removeOther: boolean;
  semanticLayers: SemanticLayer[];
  wifiOnlyUploads: boolean;
  cacheLabel: string;
  setMode: (reconstructionMode: ReconstructionMode) => void;
  setWifiOnly: (wifiOnlyUploads: boolean) => void;
  toggleLayer: (layer: SemanticLayer) => void;
  setFlag: (key: 'removeCars' | 'removePeople' | 'removeOther', value: boolean) => void;
  clearCache: () => void;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  reconstructionMode: 'balanced',
  removeCars: true,
  removePeople: true,
  removeOther: true,
  semanticLayers: ['building', 'road', 'vegetation', 'terrain'],
  wifiOnlyUploads: true,
  cacheLabel: '1.2 GB previews',
  setMode: (reconstructionMode) => set({ reconstructionMode }),
  setWifiOnly: (wifiOnlyUploads) => set({ wifiOnlyUploads }),
  toggleLayer: (layer) => {
    const has = get().semanticLayers.includes(layer);
    set({
      semanticLayers: has ? get().semanticLayers.filter((l) => l !== layer) : [...get().semanticLayers, layer],
    });
  },
  setFlag: (key, value) => set({ [key]: value }),
  clearCache: () => set({ cacheLabel: '0 B previews' }),
}));
