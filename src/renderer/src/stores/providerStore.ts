import { create } from 'zustand';
import { ProviderConfig } from '../../../shared/types';

interface ProviderState {
  providers: ProviderConfig[];
  activeProvider: ProviderConfig | null;
  isModalOpen: boolean;
  isLoading: boolean;

  openModal: () => void;
  closeModal: () => void;
  fetchProviders: () => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;
  updateProvider: (updated: ProviderConfig) => Promise<void>;
  addCustomProvider: (newProv: Omit<ProviderConfig, 'id' | 'isActive'>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setModelForProvider: (providerId: string, model: string) => Promise<void>;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  activeProvider: null,
  isModalOpen: false,
  isLoading: false,

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),

  fetchProviders: async () => {
    if (!window.whis?.getProviders) return;
    set({ isLoading: true });
    try {
      const list = await window.whis.getProviders();
      const active = list.find((p) => p.isActive) || list[0] || null;
      set({ providers: list, activeProvider: active, isLoading: false });
    } catch (e) {
      console.error('Failed to load providers:', e);
      set({ isLoading: false });
    }
  },

  setActiveProvider: async (id: string) => {
    if (!window.whis?.setActiveProvider) return;
    try {
      await window.whis.setActiveProvider(id);
      const updated = get().providers.map((p) => ({
        ...p,
        isActive: p.id === id
      }));
      const active = updated.find((p) => p.isActive) || null;
      set({ providers: updated, activeProvider: active });
    } catch (e) {
      console.error('Failed to set active provider:', e);
    }
  },

  updateProvider: async (updated: ProviderConfig) => {
    if (!window.whis?.saveProviders) return;
    const current = get().providers;
    const nextList = current.map((p) => (p.id === updated.id ? updated : p));
    try {
      await window.whis.saveProviders(nextList);
      const active = nextList.find((p) => p.isActive) || null;
      set({ providers: nextList, activeProvider: active });
    } catch (e) {
      console.error('Failed to save provider:', e);
    }
  },

  addCustomProvider: async (newProv) => {
    if (!window.whis?.saveProviders) return;
    const id = `prov-custom-${Date.now()}`;
    const fullProv: ProviderConfig = {
      ...newProv,
      id,
      isActive: false
    };
    const nextList = [...get().providers, fullProv];
    try {
      await window.whis.saveProviders(nextList);
      set({ providers: nextList });
    } catch (e) {
      console.error('Failed to add custom provider:', e);
    }
  },

  deleteProvider: async (id: string) => {
    if (!window.whis?.saveProviders) return;
    const current = get().providers;
    if (current.length <= 1) return; // Keep at least one provider
    const nextList = current.filter((p) => p.id !== id);
    if (!nextList.some((p) => p.isActive)) {
      nextList[0].isActive = true;
    }
    try {
      await window.whis.saveProviders(nextList);
      const active = nextList.find((p) => p.isActive) || null;
      set({ providers: nextList, activeProvider: active });
    } catch (e) {
      console.error('Failed to delete provider:', e);
    }
  },

  setModelForProvider: async (providerId: string, model: string) => {
    const prov = get().providers.find((p) => p.id === providerId);
    if (!prov) return;
    await get().updateProvider({
      ...prov,
      selectedModel: model
    });
  }
}));
