import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  DashboardOverview,
  ReportResponse,
  KhataResponse,
  InventoryResponse,
  CategoryItem,
  NetworkInfo,
  BusinessStore,
  DemandItem,
} from '../types';

export const STORAGE_KEYS = {
  SERVER_URL: '@dolly_pos_server_url',
  AUTH_TOKEN: '@dolly_pos_auth_token',
  USER_INFO: '@dolly_pos_user_info',
  BUSINESSES: '@dolly_pos_saved_businesses',
  ACTIVE_THEME: '@dolly_pos_theme_mode',
  CLOUD_HUB_URL: '@dolly_pos_cloud_hub_url',
  ACTIVE_STORE_ID: '@dolly_pos_active_store_id',
};

// Default Cloud Hub Gateway (Render Free Tier / Public Gateway)
export const DEFAULT_HUB_URL = 'https://dollypos-hub.onrender.com';
// Default fallback local LAN IP for Dolly POS shop laptop
export const DEFAULT_SERVER_URL = 'http://192.168.0.145:8000';

let cachedServerUrl: string = DEFAULT_SERVER_URL;
let cachedHubUrl: string = DEFAULT_HUB_URL;
let cachedToken: string | null = null;
let cachedActiveStore: BusinessStore | null = null;

// Initialize from storage
export const initializeApiConfig = async (): Promise<{
  serverUrl: string;
  token: string | null;
  activeStore: BusinessStore | null;
}> => {
  try {
    const savedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
    if (savedUrl && savedUrl.trim()) {
      cachedServerUrl = savedUrl.trim().replace(/\/$/, '');
    } else {
      cachedServerUrl = DEFAULT_SERVER_URL;
    }

    const savedHub = await AsyncStorage.getItem(STORAGE_KEYS.CLOUD_HUB_URL);
    if (savedHub && savedHub.trim()) {
      cachedHubUrl = savedHub.trim().replace(/\/$/, '');
    } else {
      cachedHubUrl = DEFAULT_HUB_URL;
    }

    const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    cachedToken = savedToken;

    // Load active store
    const businesses = await getSavedBusinesses();
    const active = businesses.find((b) => b.is_active) || businesses[0] || null;
    cachedActiveStore = active;
  } catch (err) {
    console.warn('Failed to load API config from AsyncStorage:', err);
  }
  return { serverUrl: cachedServerUrl, token: cachedToken, activeStore: cachedActiveStore };
};

export const normalizeServerUrl = (url: string): string => {
  let clean = url.trim().replace(/\/$/, '');
  if (!clean) return DEFAULT_SERVER_URL;
  if (clean.startsWith('DLY-')) {
    const parts = clean.replace('DLY-', '').split('-');
    if (parts.length === 5) {
      return `http://${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}:${parts[4]}`;
    }
  }
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `http://${clean}`;
  }
  // If IP address without port is provided (e.g. 192.168.0.145), append :8000
  const hostPart = clean.replace(/^https?:\/\//, '');
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostPart)) {
    clean = `${clean}:8000`;
  }
  return clean;
};

export const setServerUrl = async (url: string): Promise<void> => {
  const cleanUrl = normalizeServerUrl(url);
  cachedServerUrl = cleanUrl;
  await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, cleanUrl);
};

export const getServerUrl = (): string => {
  return cachedServerUrl;
};

export const getCloudHubUrl = (): string => {
  return cachedHubUrl;
};

export const setCloudHubUrl = async (url: string): Promise<void> => {
  const clean = url.trim().replace(/\/$/, '');
  cachedHubUrl = clean;
  await AsyncStorage.setItem(STORAGE_KEYS.CLOUD_HUB_URL, clean);
};

export const setAuthToken = async (token: string | null): Promise<void> => {
  cachedToken = token;
  if (token) {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }
};

export const getAuthToken = (): string | null => {
  return cachedToken;
};

// Multi-business store list helpers
export const getSavedBusinesses = async (): Promise<BusinessStore[]> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.BUSINESSES);
    if (json) {
      const parsed: BusinessStore[] = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out legacy dummy placeholder so newly installed or updated app starts clean
        const clean = parsed.filter(
          (b) => b.token !== 'DLY-STR1-MAIN' && b.id !== 'default'
        );
        if (clean.length > 0) {
          return clean;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading saved businesses:', e);
  }
  return [];
};

export const saveBusinessesList = async (businesses: BusinessStore[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
  const active = businesses.find((b) => b.is_active) || businesses[0] || null;
  cachedActiveStore = active;
  if (active?.hub_url) {
    cachedHubUrl = active.hub_url;
  }
};

export const getActiveStore = (): BusinessStore | null => {
  return cachedActiveStore;
};

// Create dynamic axios instance
const getClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: `${cachedServerUrl}/api/v1`,
    timeout: 8000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  instance.interceptors.request.use(async (config) => {
    if (cachedToken) {
      config.headers.Authorization = `Bearer ${cachedToken}`;
    }
    return config;
  });

  return instance;
};

// API Methods
export const api = {
  // 1. Connection & Pairing Ping (LAN or Direct)
  async checkNetworkInfo(targetUrl?: string): Promise<NetworkInfo> {
    const url = (targetUrl || cachedServerUrl).trim().replace(/\/$/, '');
    const res = await axios.get<NetworkInfo>(`${url}/api/v1/mobile/network-info`, {
      timeout: 5000,
    });
    return res.data;
  },

  // 1b. Pair Store with Access Token via 24/7 Cloud Hub
  async pairStoreWithToken(token: string, hubUrl?: string): Promise<{
    store_token: string;
    shop_name: string;
    tagline?: string;
    address?: string;
    mobile?: string;
    is_pos_online: boolean;
    last_seen_at?: string;
  }> {
    const hub = (hubUrl || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
    const cleanToken = token.trim().toUpperCase();
    const res = await axios.post(`${hub}/api/v1/hub/pair`, {
      store_token: cleanToken,
    }, { timeout: 20000 });
    return res.data;
  },

  // 1c. Quick Heartbeat Check via Cloud Hub for Store Token
  async checkStoreStatus(token: string, hubUrl?: string): Promise<{
    store_token: string;
    shop_name: string;
    is_pos_online: boolean;
    last_seen_at?: string;
  }> {
    const hub = (hubUrl || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
    const cleanToken = token.trim().toUpperCase();
    const res = await axios.get(`${hub}/api/v1/hub/stores/${encodeURIComponent(cleanToken)}/status`, {
      timeout: 15000,
    });
    return res.data;
  },

  // 2. Auth Login
  async login(username: string, password: string): Promise<{ access_token: string; token_type: string; user: any }> {
    const client = getClient();
    const res = await client.post('/auth/login', { username, password });
    return res.data;
  },

  // 3. Live Dashboard Overview (Range aware with profits, 24/7 Cloud Hub support)
  async getOverview(
    period: string = 'TODAY',
    startDate?: string,
    endDate?: string
  ): Promise<DashboardOverview> {
    // Check if active store is connected via Cloud Hub Token
    if (cachedActiveStore && cachedActiveStore.token) {
      const hub = (cachedActiveStore.hub_url || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
      try {
        const res = await axios.get<DashboardOverview>(
          `${hub}/api/v1/hub/stores/${encodeURIComponent(cachedActiveStore.token)}/overview`,
          {
            params: {
              period,
              start_date: startDate || undefined,
              end_date: endDate || undefined,
            },
            timeout: 20000,
          }
        );
        return res.data;
      } catch (hubErr) {
        // Fallback to direct local LAN if available
        if (cachedServerUrl && cachedServerUrl !== DEFAULT_SERVER_URL) {
          const client = getClient();
          const res = await client.get<DashboardOverview>('/mobile/overview', {
            params: {
              period,
              start_date: startDate || undefined,
              end_date: endDate || undefined,
            },
          });
          return res.data;
        }
        throw hubErr;
      }
    }

    // Standard direct LAN connection
    const client = getClient();
    const res = await client.get<DashboardOverview>('/mobile/overview', {
      params: {
        period,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      },
    });
    return res.data;
  },

  // 4. Reports Studio (6 Report Types)
  async getReports(
    startDate: string,
    endDate: string,
    reportType: string = 'SALES'
  ): Promise<ReportResponse> {
    if (cachedActiveStore && cachedActiveStore.token) {
      const hub = (cachedActiveStore.hub_url || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
      try {
        const res = await axios.get<ReportResponse>(
          `${hub}/api/v1/hub/stores/${encodeURIComponent(cachedActiveStore.token)}/reports`,
          {
            params: {
              start_date: startDate,
              end_date: endDate,
              report_type: reportType,
            },
            timeout: 20000,
          }
        );
        return res.data;
      } catch (hubErr) {
        if (cachedServerUrl && cachedServerUrl !== DEFAULT_SERVER_URL) {
          const client = getClient();
          const res = await client.get<ReportResponse>('/mobile/reports', {
            params: {
              start_date: startDate,
              end_date: endDate,
              report_type: reportType,
            },
          });
          return res.data;
        }
        throw hubErr;
      }
    }
    const client = getClient();
    const res = await client.get<ReportResponse>('/mobile/reports', {
      params: {
        start_date: startDate,
        end_date: endDate,
        report_type: reportType,
      },
    });
    return res.data;
  },

  // 5. Customer Khata
  async getKhata(search?: string): Promise<KhataResponse> {
    if (cachedActiveStore && cachedActiveStore.token) {
      const hub = (cachedActiveStore.hub_url || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
      try {
        const res = await axios.get<KhataResponse>(
          `${hub}/api/v1/hub/stores/${encodeURIComponent(cachedActiveStore.token)}/khata`,
          {
            params: { search: search || undefined },
            timeout: 20000,
          }
        );
        return res.data;
      } catch (hubErr) {
        if (cachedServerUrl && cachedServerUrl !== DEFAULT_SERVER_URL) {
          const client = getClient();
          const res = await client.get<KhataResponse>('/mobile/customers/khata', {
            params: { search: search || undefined },
          });
          return res.data;
        }
        throw hubErr;
      }
    }
    const client = getClient();
    const res = await client.get<KhataResponse>('/mobile/customers/khata', {
      params: { search: search || undefined },
    });
    return res.data;
  },

  // 6. Real-time Inventory Lookup with pagination
  async getInventory(
    search?: string,
    categoryId?: number,
    lowStockOnly: boolean = false,
    page: number = 1,
    limit: number = 50
  ): Promise<InventoryResponse> {
    if (cachedActiveStore && cachedActiveStore.token) {
      const hub = (cachedActiveStore.hub_url || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
      try {
        const res = await axios.get<InventoryResponse>(
          `${hub}/api/v1/hub/stores/${encodeURIComponent(cachedActiveStore.token)}/inventory`,
          {
            params: {
              search: search || undefined,
              category_id: categoryId || undefined,
              low_stock_only: lowStockOnly || undefined,
              page,
              limit,
            },
            timeout: 20000,
          }
        );
        return res.data;
      } catch (hubErr) {
        if (cachedServerUrl && cachedServerUrl !== DEFAULT_SERVER_URL) {
          const client = getClient();
          const res = await client.get<InventoryResponse>('/mobile/inventory', {
            params: {
              search: search || undefined,
              category_id: categoryId || undefined,
              low_stock_only: lowStockOnly || undefined,
              page,
              limit,
            },
          });
          return res.data;
        }
        throw hubErr;
      }
    }
    const client = getClient();
    const res = await client.get<InventoryResponse>('/mobile/inventory', {
      params: {
        search: search || undefined,
        category_id: categoryId || undefined,
        low_stock_only: lowStockOnly || undefined,
        page,
        limit,
      },
    });
    return res.data;
  },

  // 7. Add Product directly from mobile (Cloud Hub & Direct LAN)
  async addProduct(data: {
    name: string;
    barcode?: string;
    category_id?: number;
    purchase_price: number;
    selling_price: number;
    mrp?: number;
    stock_quantity: number;
    min_stock_alert: number;
  }): Promise<any> {
    if (cachedActiveStore && cachedActiveStore.token) {
      const hub = (cachedActiveStore.hub_url || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
      try {
        const res = await axios.post(
          `${hub}/api/v1/hub/stores/${encodeURIComponent(cachedActiveStore.token)}/inventory`,
          data,
          { timeout: 15000 }
        );
        return res.data;
      } catch (hubErr) {
        if (cachedServerUrl && cachedServerUrl !== DEFAULT_SERVER_URL) {
          const client = getClient();
          const res = await client.post('/mobile/inventory', data);
          return res.data;
        }
        throw hubErr;
      }
    }
    const client = getClient();
    const res = await client.post('/mobile/inventory', data);
    return res.data;
  },

  // 8. Categories List
  async getCategories(): Promise<CategoryItem[]> {
    if (cachedActiveStore && cachedActiveStore.token) {
      const hub = (cachedActiveStore.hub_url || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
      try {
        const res = await axios.get<CategoryItem[]>(
          `${hub}/api/v1/hub/stores/${encodeURIComponent(cachedActiveStore.token)}/categories`,
          { timeout: 20000 }
        );
        return res.data || [];
      } catch (hubErr) {
        if (cachedServerUrl && cachedServerUrl !== DEFAULT_SERVER_URL) {
          const client = getClient();
          const res = await client.get<CategoryItem[]>('/mobile/categories');
          return res.data;
        }
        throw hubErr;
      }
    }
    const client = getClient();
    const res = await client.get<CategoryItem[]>('/mobile/categories');
    return res.data;
  },

  // 9. 1-Click Database Backup Download to Phone
  async downloadFullBackup(): Promise<string> {
    const url = `${cachedServerUrl}/api/v1/mobile/backup-download`;
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const filename = `DollyPOS_Database_Backup_${timestamp}.json`;
    const targetUri = `${FileSystem.cacheDirectory}${filename}`;

    const downloadRes = await FileSystem.downloadAsync(url, targetUri, {
      headers: cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {},
    });

    if (downloadRes.status !== 200) {
      throw new Error(`Server returned HTTP ${downloadRes.status} while generating backup`);
    }

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(downloadRes.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Save Dolly POS Database Backup',
        UTI: 'public.json',
      });
    }
    return downloadRes.uri;
  },

  // 10. Customer Demand Log / Lost Demand API (Cloud Hub & Local Sync)
  async getDemands(status?: string): Promise<DemandItem[]> {
    if (cachedActiveStore && cachedActiveStore.token) {
      const hub = (cachedActiveStore.hub_url || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
      try {
        const res = await axios.get(`${hub}/api/v1/hub/stores/${encodeURIComponent(cachedActiveStore.token)}/demands`, {
          params: { status: status || undefined },
          timeout: 10000,
        });
        return res.data?.demands || [];
      } catch (e) {
        // Fallback to local client if available
      }
    }
    const client = getClient();
    const res = await client.get<DemandItem[]>('/procurement/lost-demand', {
      params: { status: status || undefined },
    });
    return res.data;
  },

  async createDemand(data: {
    item_description: string;
    category_name?: string;
    preferred_size?: string;
    preferred_color?: string;
    customer_name?: string;
    customer_phone?: string;
    urgency?: 'NORMAL' | 'HIGH' | 'URGENT';
    notes?: string;
  }): Promise<any> {
    if (cachedActiveStore && cachedActiveStore.token) {
      const hub = (cachedActiveStore.hub_url || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
      try {
        const res = await axios.post(`${hub}/api/v1/hub/stores/${encodeURIComponent(cachedActiveStore.token)}/demands`, data, {
          timeout: 10000,
        });
        return res.data;
      } catch (e) {
        // Fallback to local client if available
      }
    }
    const client = getClient();
    const res = await client.post('/procurement/lost-demand', data);
    return res.data;
  },

  async updateDemandStatus(id: number, status: string): Promise<any> {
    if (cachedActiveStore && cachedActiveStore.token) {
      const hub = (cachedActiveStore.hub_url || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
      try {
        const res = await axios.put(
          `${hub}/api/v1/hub/stores/${encodeURIComponent(cachedActiveStore.token)}/demands/${id}/status`,
          { status },
          { timeout: 10000 }
        );
        return res.data;
      } catch (e) {
        // Fallback to local client if available
      }
    }
    const client = getClient();
    const res = await client.put(`/procurement/lost-demand/${id}/status`, { status });
    return res.data;
  },

  async deleteDemand(id: number): Promise<any> {
    if (cachedActiveStore && cachedActiveStore.token) {
      const hub = (cachedActiveStore.hub_url || cachedHubUrl || DEFAULT_HUB_URL).trim().replace(/\/$/, '');
      try {
        const res = await axios.delete(
          `${hub}/api/v1/hub/stores/${encodeURIComponent(cachedActiveStore.token)}/demands/${id}`,
          { timeout: 10000 }
        );
        return res.data;
      } catch (e) {
        // Fallback to local client if available
      }
    }
    const client = getClient();
    const res = await client.delete(`/procurement/lost-demand/${id}`);
    return res.data;
  },
};
