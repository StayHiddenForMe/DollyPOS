import { create } from 'zustand';
import api from '../utils/api';

export type AdvisorTab = 'DEADSTOCK' | 'PRICING' | 'CUSTOMERS' | 'CATEGORIES' | 'SEASONAL';

interface AdvisorState {
  activeTab: AdvisorTab;
  deadStockDays: number;
  lastDeadStockDays: number | null;
  deadStock: any[];
  deadStockSummary: any;
  customerSegments: any;
  pricingSuggestions: any[];
  categoryMatrix: any[];
  categoryStockData: any;
  seasonalAdvisory: any;
  loading: boolean;
  
  // Category Matrix drill-down UI state
  selectedCategoryFilter: number | 'ALL';
  selectedSubcategoryFilter: number | 'ALL';
  productSearchQuery: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;

  // Actions
  setActiveTab: (tab: AdvisorTab) => void;
  setDeadStockDays: (days: number) => void;
  setSelectedCategoryFilter: (catId: number | 'ALL') => void;
  setSelectedSubcategoryFilter: (subcatId: number | 'ALL') => void;
  setProductSearchQuery: (query: string) => void;
  handleSortToggle: (col: string) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  fetchData: (tab?: AdvisorTab, force?: boolean) => Promise<void>;
  clearCache: () => void;
}

export const useAdvisorStore = create<AdvisorState>((set, get) => ({
  activeTab: 'DEADSTOCK',
  deadStockDays: 365,
  lastDeadStockDays: null,
  deadStock: [],
  deadStockSummary: null,
  customerSegments: null,
  pricingSuggestions: [],
  categoryMatrix: [],
  categoryStockData: null,
  seasonalAdvisory: null,
  loading: false,

  selectedCategoryFilter: 'ALL',
  selectedSubcategoryFilter: 'ALL',
  productSearchQuery: '',
  sortColumn: 'name',
  sortDirection: 'asc',
  currentPage: 1,
  pageSize: 50,

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    get().fetchData(tab, false);
  },

  setDeadStockDays: (days) => {
    set({ deadStockDays: days });
    get().fetchData('DEADSTOCK', true);
  },

  setSelectedCategoryFilter: (catId) => {
    set({
      selectedCategoryFilter: catId,
      selectedSubcategoryFilter: 'ALL',
      productSearchQuery: '',
      currentPage: 1
    });
  },

  setSelectedSubcategoryFilter: (subcatId) => {
    set({
      selectedSubcategoryFilter: subcatId,
      currentPage: 1
    });
  },

  setProductSearchQuery: (query) => {
    set({
      productSearchQuery: query,
      currentPage: 1
    });
  },

  handleSortToggle: (col) => {
    const { sortColumn, sortDirection } = get();
    if (sortColumn === col) {
      set({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortColumn: col, sortDirection: 'asc' });
    }
  },

  setCurrentPage: (page) => {
    set({ currentPage: Math.max(1, page) });
  },

  setPageSize: (size) => {
    set({ pageSize: size, currentPage: 1 });
  },

  fetchData: async (tabToFetch?: AdvisorTab, force = false) => {
    const state = get();
    const tab = tabToFetch || state.activeTab;

    // Check if we already have valid cached data in memory
    if (!force) {
      if (tab === 'DEADSTOCK' && state.deadStockSummary !== null && state.lastDeadStockDays === state.deadStockDays) return;
      if (tab === 'PRICING' && state.pricingSuggestions.length > 0) return;
      if (tab === 'CUSTOMERS' && state.customerSegments !== null) return;
      if (tab === 'CATEGORIES' && state.categoryStockData !== null && state.categoryMatrix.length > 0) return;
      if (tab === 'SEASONAL' && state.seasonalAdvisory !== null) return;
    }

    set({ loading: true });
    try {
      if (tab === 'DEADSTOCK') {
        const res = await api.get(`/ai/dead-stock?days=${state.deadStockDays}`);
        set({
          deadStock: res.data.items || [],
          deadStockSummary: res.data,
          lastDeadStockDays: state.deadStockDays
        });
      } else if (tab === 'PRICING') {
        const res = await api.get('/ai/pricing-suggestions');
        set({ pricingSuggestions: res.data || [] });
      } else if (tab === 'CUSTOMERS') {
        const res = await api.get('/ai/customer-segments');
        set({ customerSegments: res.data });
      } else if (tab === 'CATEGORIES') {
        const [matrixRes, stockRes] = await Promise.all([
          api.get('/ai/category-matrix'),
          api.get('/ai/category-stock-analytics')
        ]);
        set({
          categoryMatrix: matrixRes.data || [],
          categoryStockData: stockRes.data || null
        });
      } else if (tab === 'SEASONAL') {
        const res = await api.get('/ai/seasonal-advisory');
        set({ seasonalAdvisory: res.data });
      }
    } catch (e) {
      console.error('Failed to fetch Smart Advisor data', e);
    } finally {
      set({ loading: false });
    }
  },

  clearCache: () => {
    set({
      deadStock: [],
      deadStockSummary: null,
      customerSegments: null,
      pricingSuggestions: [],
      categoryMatrix: [],
      categoryStockData: null,
      seasonalAdvisory: null,
      lastDeadStockDays: null
    });
  }
}));
