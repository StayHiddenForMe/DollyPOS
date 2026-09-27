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
};

// Default fallback local LAN IP for Dolly POS shop laptop
export const DEFAULT_SERVER_URL = 'http://192.168.0.145:8000';

let cachedServerUrl: string = DEFAULT_SERVER_URL;
let cachedToken: string | null = null;

// Initialize from storage
export const initializeApiConfig = async (): Promise<{ serverUrl: string; token: string | null }> => {
  try {
    const savedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
    if (savedUrl && savedUrl.trim()) {
      cachedServerUrl = savedUrl.trim().replace(/\/$/, '');
    } else {
      cachedServerUrl = DEFAULT_SERVER_URL;
    }

    const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    cachedToken = savedToken;
  } catch (err) {
    console.warn('Failed to load API config from AsyncStorage:', err);
  }
  return { serverUrl: cachedServerUrl, token: cachedToken };
};

export const setServerUrl = async (url: string): Promise<void> => {
  const cleanUrl = url.trim().replace(/\/$/, '');
  cachedServerUrl = cleanUrl;
  await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, cleanUrl);
};

export const getServerUrl = (): string => {
  return cachedServerUrl;
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
      return JSON.parse(json);
    }
  } catch (e) {
    console.warn('Error reading saved businesses:', e);
  }
  return [
    {
      id: 'default',
      name: 'Main Store (Dolly Toys & Kids Wear)',
      url: cachedServerUrl,
      is_active: true,
    },
  ];
};

export const saveBusinessesList = async (businesses: BusinessStore[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
};

// Create dynamic axios instance
const getClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: `${cachedServerUrl}/api/v1`,
    timeout: 10000,
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
  // 1. Connection & Pairing Ping
  async checkNetworkInfo(targetUrl?: string): Promise<NetworkInfo> {
    const url = (targetUrl || cachedServerUrl).trim().replace(/\/$/, '');
    const res = await axios.get<NetworkInfo>(`${url}/api/v1/mobile/network-info`, {
      timeout: 6000,
    });
    return res.data;
  },

  // 2. Auth Login
  async login(username: string, password: string): Promise<{ access_token: string; token_type: string; user: any }> {
    const client = getClient();
    const res = await client.post('/auth/login', { username, password });
    return res.data;
  },

  // 3. Live Dashboard Overview (Range aware with profits)
  async getOverview(
    period: string = 'TODAY',
    startDate?: string,
    endDate?: string
  ): Promise<DashboardOverview> {
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

  // 7. Add Product directly from mobile
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
    const client = getClient();
    const res = await client.post('/mobile/inventory', data);
    return res.data;
  },

  // 8. Categories List
  async getCategories(): Promise<CategoryItem[]> {
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

  // 10. Customer Demand Log / Lost Demand API
  async getDemands(status?: string): Promise<DemandItem[]> {
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
    const client = getClient();
    const res = await client.post('/procurement/lost-demand', data);
    return res.data;
  },

  async updateDemandStatus(id: number, status: string): Promise<any> {
    const client = getClient();
    const res = await client.put(`/procurement/lost-demand/${id}/status`, { status });
    return res.data;
  },

  async deleteDemand(id: number): Promise<any> {
    const client = getClient();
    const res = await client.delete(`/procurement/lost-demand/${id}`);
    return res.data;
  },
};
