import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  api,
  DEFAULT_SERVER_URL,
  getServerUrl,
  setServerUrl as saveServerUrlToStorage,
  initializeApiConfig,
} from '../services/api';
import { NetworkInfo } from '../types';

interface ConnectionContextType {
  serverUrl: string;
  isOnline: boolean;
  isChecking: boolean;
  networkInfo: NetworkInfo | null;
  latencyMs: number | null;
  lastChecked: Date | null;
  updateServerUrl: (url: string) => Promise<boolean>;
  checkConnection: (targetUrl?: string) => Promise<boolean>;
  setLiveShopName: (name: string) => void;
  switchBusiness: (url: string, storeName?: string) => Promise<boolean>;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const ConnectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [serverUrl, setUrlState] = useState<string>(DEFAULT_SERVER_URL);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = async (targetUrl?: string): Promise<boolean> => {
    setIsChecking(true);
    const start = Date.now();
    try {
      const url = targetUrl || serverUrl;
      const info = await api.checkNetworkInfo(url);
      const elapsed = Date.now() - start;
      setIsOnline(true);
      setNetworkInfo(info);
      setLatencyMs(elapsed);
      setLastChecked(new Date());
      setIsChecking(false);
      return true;
    } catch (err) {
      setIsOnline(false);
      setNetworkInfo(null);
      setLatencyMs(null);
      setLastChecked(new Date());
      setIsChecking(false);
      return false;
    }
  };

  const updateServerUrl = async (newUrl: string): Promise<boolean> => {
    const clean = newUrl.trim().replace(/\/$/, '');
    await saveServerUrlToStorage(clean);
    setUrlState(clean);
    return await checkConnection(clean);
  };

  const setLiveShopName = (name: string) => {
    if (!name) return;
    setNetworkInfo((prev) => (prev ? { ...prev, shop_name: name } : null));
  };

  const switchBusiness = async (url: string, storeName?: string): Promise<boolean> => {
    const clean = url.trim().replace(/\/$/, '');
    // 1. Reset state to avoid mixing data
    setIsOnline(false);
    setNetworkInfo(null);
    setLatencyMs(null);
    setUrlState(clean);

    // 2. Persist new target URL
    await saveServerUrlToStorage(clean);

    // 3. Connect to the new business server
    const ok = await checkConnection(clean);
    return ok;
  };

  useEffect(() => {
    const init = async () => {
      const { serverUrl: savedUrl } = await initializeApiConfig();
      setUrlState(savedUrl);
      await checkConnection(savedUrl);
    };
    init();
  }, []);

  // Active heartbeat: 4s when offline for rapid reconnection, 12s when online
  useEffect(() => {
    const interval = isOnline ? 12000 : 4000;
    const timer = setInterval(() => {
      checkConnection();
    }, interval);
    return () => clearInterval(timer);
  }, [isOnline, serverUrl]);

  // AppState change listener: instantly verify connection when app returns to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkConnection();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [serverUrl]);

  return (
    <ConnectionContext.Provider
      value={{
        serverUrl,
        isOnline,
        isChecking,
        networkInfo,
        latencyMs,
        lastChecked,
        updateServerUrl,
        checkConnection,
        setLiveShopName,
        switchBusiness,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = (): ConnectionContextType => {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return ctx;
};
