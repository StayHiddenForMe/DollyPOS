import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  isOwner: () => boolean;
  isCashier: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Clean up any persistent legacy tokens from localStorage for store security
  if (typeof window !== 'undefined') {
    localStorage.removeItem('dolly_user');
    localStorage.removeItem('dolly_token');
  }

  const storedUser = typeof window !== 'undefined' ? sessionStorage.getItem('dolly_user') : null;
  const storedToken = typeof window !== 'undefined' ? sessionStorage.getItem('dolly_token') : null;

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken || null,
    isAuthenticated: !!storedToken,

    login: (user: User, token: string) => {
      sessionStorage.setItem('dolly_user', JSON.stringify(user));
      sessionStorage.setItem('dolly_token', token);
      set({ user, token, isAuthenticated: true });
    },

    logout: () => {
      sessionStorage.removeItem('dolly_user');
      sessionStorage.removeItem('dolly_token');
      set({ user: null, token: null, isAuthenticated: false });
    },

    isOwner: () => {
      const { user } = get();
      return user?.role === 'OWNER' || user?.role === 'ADMIN';
    },

    isCashier: () => {
      const { user } = get();
      return user?.role === 'CASHIER';
    }
  };
});
