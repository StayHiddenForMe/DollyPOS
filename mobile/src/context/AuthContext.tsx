import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken, STORAGE_KEYS } from '../services/api';
import { UserProfile } from '../types';

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  useEffect(() => {
    const loadSavedAuth = async () => {
      try {
        const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const savedUserStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_INFO);

        if (savedToken) {
          setTokenState(savedToken);
          await setAuthToken(savedToken);
          if (savedUserStr) {
            setUserState(JSON.parse(savedUserStr));
          }
        }
      } catch (e) {
        console.warn('Failed to restore auth session:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSavedAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await api.login(username, password);
      const accessToken = res.access_token;
      const userProfile: UserProfile = res.user;

      setTokenState(accessToken);
      setUserState(userProfile);
      await setAuthToken(accessToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userProfile));

      return true;
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Login failed. Check server connection and credentials.';
      setError(msg);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    setTokenState(null);
    setUserState(null);
    await setAuthToken(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_INFO);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
