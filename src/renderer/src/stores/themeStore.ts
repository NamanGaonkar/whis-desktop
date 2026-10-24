import { create } from 'zustand';
import { AppTheme } from '../../../shared/types';

interface ThemeState {
  theme: 'light' | 'dark';
  initTheme: () => Promise<void>;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',

  initTheme: async () => {
    try {
      if (window.whis?.getTheme) {
        const saved = await window.whis.getTheme();
        const activeTheme = saved === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', activeTheme);
        set({ theme: activeTheme });
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
    if (window.whis?.setTheme) {
      window.whis.setTheme(next);
    }
  },

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
    if (window.whis?.setTheme) {
      window.whis.setTheme(theme);
    }
  }
}));
