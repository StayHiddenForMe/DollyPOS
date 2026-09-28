import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  api,
  DEFAULT_SERVER_URL,
  DEFAULT_HUB_URL,
  getServerUrl,
  setServerUrl as saveServerUrlToStorage,
  initializeApiConfig,
  getSavedBusinesses,
  saveBusinessesList,
} from '../services/api';
import { NetworkInfo, BusinessStore } from '../types';

interface ConnectionContextType {
  serverUrl: string;
  isOnline: boolean;
  isPosOnline: boolean;
  isChecking: boolean;
  networkInfo: NetworkInfo | null;
  latencyMs: number | null;
  lastChecked: Date | null;
  stores: BusinessStore[];
  activeStore: BusinessStore | null;
  updateServerUrl: (url: string) => Promise<boolean>;
  checkConnection: (targetUrl?: string) => Promise<boolean>;
  setLiveShopName: (name: string) => void;
  switchBusiness: (url: string, storeName?: string) => Promise<boolean>;
  addStoreByToken: (token: string, hubUrl?: string) => Promise<{ success: boolean; error?: string; store?: BusinessStore }>;
  switchStore: (storeId: string) => Promise<boolean>;
  removeStore: (storeId: string) => Promise<boolean>;
  refreshStores: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const ConnectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [serverUrl, setUrlState] = useState<string>(DEFAULT_SERVER_URL);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isPosOnline, setIsPosOnline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [stores, setStores] = useState<BusinessStore[]>([]);
  const [activeStore, setActiveStoreState] = useState<BusinessStore | null>(null);

  const isCheckingRef = useRef(false);

  // Load saved stores on startup
  const refreshStores = useCallback(async () => {
    try {
      const list = await getSavedBusinesses();
      setStores(list);
      const active = list.find((b) => b.is_active) || list[0] || null;
      setActiveStoreState(active);
    } catch (e) {
      console.warn('Failed to refresh stores:', e);
    }
  }, []);

  const checkConnection = async (targetUrl?: string): Promise<boolean> => {
    if (isCheckingRef.current) return isOnline;
    if (!activeStore && !targetUrl) {
      setIsOnline(false);
      setIsPosOnline(false);
      setIsChecking(false);
      return false;
    }
    isCheckingRef.current = true;
    setIsChecking(true);
    const start = Date.now();

    try {
      // 1. If active store has a Store Access Token, verify via 24/7 Cloud Hub
      if (activeStore && activeStore.token) {
        const hubRes = await api.checkStoreStatus(activeStore.token, activeStore.hub_url);
        const elapsed = Date.now() - start;
        setIsOnline(true);
        setIsPosOnline(Boolean(hubRes.is_pos_online));
        setLatencyMs(elapsed);
        setLastChecked(new Date());

        setNetworkInfo((prev) => ({
          shop_name: hubRes.shop_name || activeStore.name || 'Dolly POS Store',
          tagline: prev?.tagline || 'Store Access Token Connected',
          local_ip: prev?.local_ip || 'Cloud',
          port: prev?.port || 443,
          api_base_url: activeStore.hub_url || DEFAULT_HUB_URL,
          server_time: hubRes.last_seen_at || new Date().toISOString(),
          status: hubRes.is_pos_online ? 'ONLINE' : 'POS_OFFLINE',
        }));

        setIsChecking(false);
        isCheckingRef.current = false;
        return true;
      }

      // 2. Direct LAN connection fallback
      const url = targetUrl || serverUrl;
      const info = await api.checkNetworkInfo(url);
      const elapsed = Date.now() - start;
      setIsOnline(true);
      setIsPosOnline(true);
      setNetworkInfo(info);
      setLatencyMs(elapsed);
      setLastChecked(new Date());
      setIsChecking(false);
      isCheckingRef.current = false;
      return true;
    } catch (err) {
      setIsOnline(false);
      setIsPosOnline(false);
      setLatencyMs(null);
      setLastChecked(new Date());
      setIsChecking(false);
      isCheckingRef.current = false;
      return false;
    }
  };

  const updateServerUrl = async (newUrl: string): Promise<boolean> => {
    const clean = newUrl.trim().replace(/\/$/, '');
    await saveServerUrlToStorage(clean);
    setUrlState(clean);
    return await checkConnection(clean);
  };

  const setLiveShopName = useCallback((name: string) => {
    if (!name) return;
    setNetworkInfo((prev) => {
      if (prev && prev.shop_name === name) return prev;
      return prev ? { ...prev, shop_name: name } : null;
    });
  }, []);

  // Multi-Store: Add store using Store Access Token
  const addStoreByToken = async (
    token: string,
    hubUrl?: string
  ): Promise<{ success: boolean; error?: string; store?: BusinessStore }> => {
    try {
      const cleanToken = token.trim().toUpperCase();
      const verified = await api.pairStoreWithToken(cleanToken, hubUrl);

      const existingStores = await getSavedBusinesses();
      // Check if store with same token already exists
      const alreadyExists = existingStores.find((s) => s.token === cleanToken);
      if (alreadyExists) {
        // Activate it
        await switchStore(alreadyExists.id);
        return { success: true, store: alreadyExists };
      }

      const newStoreId = `store_${Date.now()}`;
      const newStore: BusinessStore = {
        id: newStoreId,
        name: verified.shop_name || `Store ${cleanToken}`,
        token: cleanToken,
        tagline: verified.tagline,
        address: verified.address,
        hub_url: hubUrl || DEFAULT_HUB_URL,
        is_active: true,
        is_pos_online: verified.is_pos_online,
        last_synced: verified.last_seen_at || undefined,
      };

      // Set other stores inactive
      const updatedList = existingStores.map((s) => ({ ...s, is_active: false }));
      updatedList.push(newStore);

      await saveBusinessesList(updatedList);
      setStores(updatedList);
      setActiveStoreState(newStore);
      setIsPosOnline(Boolean(verified.is_pos_online));
      setIsOnline(true);

      return { success: true, store: newStore };
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Could not verify Store Access Token.';
      return { success: false, error: msg };
    }
  };

  // Multi-Store: Switch active store
  const switchStore = async (storeId: string): Promise<boolean> => {
    try {
      const currentList = await getSavedBusinesses();
      const target = currentList.find((s) => s.id === storeId);
      if (!target) return false;

      const updated = currentList.map((s) => ({
        ...s,
        is_active: s.id === storeId,
      }));

      await saveBusinessesList(updated);
      setStores(updated);
      setActiveStoreState(target);

      // Trigger instant check for new store
      if (target.token) {
        api.checkStoreStatus(target.token, target.hub_url).then((statusRes) => {
          setIsPosOnline(Boolean(statusRes.is_pos_online));
          setIsOnline(true);
        }).catch(() => {
          setIsPosOnline(false);
        });
      }

      return true;
    } catch (e) {
      console.warn('Failed to switch store:', e);
      return false;
    }
  };

  // Multi-Store: Remove a store
  const removeStore = async (storeId: string): Promise<boolean> => {
    try {
      const currentList = await getSavedBusinesses();
      const filtered = currentList.filter((s) => s.id !== storeId);

      if (filtered.length === 0) {
        await saveBusinessesList([]);
        setStores([]);
        setActiveStoreState(null);
        setIsOnline(false);
        setIsPosOnline(false);
        return true;
      }

      // Ensure one store is marked active
      if (!filtered.some((s) => s.is_active)) {
        filtered[0].is_active = true;
      }

      await saveBusinessesList(filtered);
      setStores(filtered);
      const newActive = filtered.find((s) => s.is_active) || filtered[0];
      setActiveStoreState(newActive);
      return true;
    } catch (e) {
      console.warn('Failed to remove store:', e);
      return false;
    }
  };

  const switchBusiness = async (url: string, storeName?: string): Promise<boolean> => {
    const clean = url.trim().replace(/\/$/, '');
    setIsOnline(false);
    setNetworkInfo(null);
    setLatencyMs(null);
    setUrlState(clean);

    await saveServerUrlToStorage(clean);
    return await checkConnection(clean);
  };

  useEffect(() => {
    const init = async () => {
      const { serverUrl: savedUrl, activeStore: initialStore } = await initializeApiConfig();
      setUrlState(savedUrl);
      await refreshStores();
      await checkConnection(savedUrl);
    };
    init();
  }, [refreshStores]);

  // Calm, non-spammy heartbeat: 30s when online, 10s when offline
  useEffect(() => {
    const interval = isOnline ? 30000 : 10000;
    const timer = setInterval(() => {
      checkConnection();
    }, interval);
    return () => clearInterval(timer);
  }, [isOnline, serverUrl, activeStore]);

  // AppState change listener: verify connection when app returns to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkConnection();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [serverUrl, activeStore]);

  return (
    <ConnectionContext.Provider
      value={{
        serverUrl,
        isOnline,
        isPosOnline,
        isChecking,
        networkInfo,
        latencyMs,
        lastChecked,
        stores,
        activeStore,
        updateServerUrl,
        checkConnection,
        setLiveShopName,
        switchBusiness,
        addStoreByToken,
        switchStore,
        removeStore,
        refreshStores,
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
