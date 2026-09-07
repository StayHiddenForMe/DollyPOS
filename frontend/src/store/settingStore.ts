import { create } from 'zustand';
import { StoreSettings } from '../types';
import api from '../utils/api';

interface SettingState {
  settings: StoreSettings | null;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
}

export const useSettingStore = create<SettingState>((set) => ({
  settings: null,
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/settings');
      set({ settings: res.data, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  updateSettings: async (newSettings: Partial<StoreSettings>) => {
    try {
      const res = await api.put('/settings', newSettings);
      set({ settings: res.data });
    } catch (e) {
      console.error('Failed to update settings', e);
    }
  }
}));
