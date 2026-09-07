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
  const storedUser = localStorage.getItem('dolly_user');
  const storedToken = localStorage.getItem('dolly_token');

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken || null,
    isAuthenticated: !!storedToken,

    login: (user: User, token: string) => {
      localStorage.setItem('dolly_user', JSON.stringify(user));
      localStorage.setItem('dolly_token', token);
      set({ user, token, isAuthenticated: true });
    },

    logout: () => {
      localStorage.removeItem('dolly_user');
      localStorage.removeItem('dolly_token');
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
