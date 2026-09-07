import { create } from 'zustand';
import { CartItem, Product, PaymentMode } from '../types';
import { playBeepSuccess } from '../utils/formatters';

export interface CartSession {
  id: string; // e.g. "cart-1", "cart-2"
  tabName: string; // "Cart 1", "Rahul", etc.
  items: CartItem[];
  customerPhone: string;
  customerName: string;
  discountAmount: number;
  discountType: 'FLAT' | 'PERCENT';
  isGiftReceipt: boolean;
  notes: string;
}

interface BillingState {
  tabs: CartSession[];
  activeTabId: string;
  
  // Computed values for active tab
  activeItems: () => CartItem[];
  subtotal: () => number;
  discountVal: () => number;
  taxAmount: () => number;
  grandTotal: () => number;
  
  // Actions
  addItem: (product: Product | any, quantity?: number) => void;
  addUnlistedItem: (name: string, price: number, quantity?: number) => void;
  updateQuantity: (cartItemId: string, newQty: number) => void;
  updateItemPrice: (cartItemId: string, newPrice: number) => void;
  updateItemDiscount: (cartItemId: string, discount: number) => void;
  removeItem: (cartItemId: string) => void;
  clearActiveCart: () => void;
  
  setCustomer: (name: string, phone: string) => void;
  setBillDiscount: (amount: number, type: 'FLAT' | 'PERCENT') => void;
  toggleGiftReceipt: () => void;
  setNotes: (notes: string) => void;

  // Tabs / Multi-Cart Management
  addTab: () => void;
  switchTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
}

const initialCart: CartSession = {
  id: 'cart-1',
  tabName: 'Bill 1',
  items: [],
  customerPhone: '',
  customerName: '',
  discountAmount: 0,
  discountType: 'FLAT',
  isGiftReceipt: false,
  notes: '',
};

export const useBillingStore = create<BillingState>((set, get) => ({
  tabs: [initialCart],
  activeTabId: 'cart-1',

  activeItems: () => {
    const active = get().tabs.find(t => t.id === get().activeTabId);
    return active ? active.items : [];
  },

  subtotal: () => {
    const items = get().activeItems();
    return items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  },

  discountVal: () => {
    const active = get().tabs.find(t => t.id === get().activeTabId);
    if (!active) return 0;
    const sub = get().subtotal();
    const itemDiscounts = active.items.reduce((sum, i) => sum + (i.discount_amount * i.quantity), 0);
    
    let billDiscount = 0;
    if (active.discountType === 'PERCENT') {
      billDiscount = (sub * (active.discountAmount / 100));
    } else {
      billDiscount = active.discountAmount;
    }
    return itemDiscounts + billDiscount;
  },

  taxAmount: () => {
    const items = get().activeItems();
    return items.reduce((sum, item) => sum + (item.tax_amount * item.quantity), 0);
  },

  grandTotal: () => {
    const sub = get().subtotal();
    const disc = get().discountVal();
    const tax = get().taxAmount();
    const total = Math.max(0, sub - disc + tax);
    return Math.round(total); // Cashier standard round off
  },

  addItem: (product: Product | any, quantity = 1) => {
    playBeepSuccess();
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const currentTab = state.tabs[activeIndex];
      const existingItemIndex = currentTab.items.findIndex(
        i => (i.product_id && i.product_id === product.id) || (i.barcode && i.barcode === product.barcode)
      );

      let newItems = [...currentTab.items];
      if (existingItemIndex > -1) {
        // Increment quantity
        const existing = newItems[existingItemIndex];
        const newQty = existing.quantity + quantity;
        newItems[existingItemIndex] = {
          ...existing,
          quantity: newQty,
          total_price: (existing.unit_price - existing.discount_amount) * newQty
        };
      } else {
        // Add new item row
        const taxVal = (product.selling_price * (product.gst_percent || 0)) / 100;
        const newItem: CartItem = {
          cart_item_id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          product_id: product.id,
          item_name: product.name,
          barcode: product.barcode,
          sku: product.sku,
          size: product.size,
          color: product.color,
          quantity: quantity,
          unit_price: product.selling_price,
          cost_price: product.purchase_price || 0,
          discount_amount: 0,
          tax_percent: product.gst_percent || 0,
          tax_amount: taxVal,
          total_price: product.selling_price * quantity,
          is_unlisted: false,
          max_stock: product.stock_quantity
        };
        newItems.unshift(newItem); // Place most recently scanned item at the top
      }

      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = { ...currentTab, items: newItems };
      return { tabs: updatedTabs };
    });
  },

  addUnlistedItem: (name: string, price: number, quantity = 1) => {
    playBeepSuccess();
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const currentTab = state.tabs[activeIndex];
      const newItem: CartItem = {
        cart_item_id: `unlisted-${Date.now()}`,
        item_name: name || 'Custom Item',
        quantity: quantity,
        unit_price: price,
        cost_price: 0,
        discount_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        total_price: price * quantity,
        is_unlisted: true
      };

      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = { ...currentTab, items: [newItem, ...currentTab.items] };
      return { tabs: updatedTabs };
    });
  },

  updateQuantity: (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      get().removeItem(cartItemId);
      return;
    }
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const currentTab = state.tabs[activeIndex];
      const updatedItems = currentTab.items.map(item => {
        if (item.cart_item_id === cartItemId) {
          return {
            ...item,
            quantity: newQty,
            total_price: (item.unit_price - item.discount_amount) * newQty
          };
        }
        return item;
      });

      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = { ...currentTab, items: updatedItems };
      return { tabs: updatedTabs };
    });
  },

  updateItemPrice: (cartItemId: string, newPrice: number) => {
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const currentTab = state.tabs[activeIndex];
      const updatedItems = currentTab.items.map(item => {
        if (item.cart_item_id === cartItemId) {
          return {
            ...item,
            unit_price: Math.max(0, newPrice),
            total_price: (Math.max(0, newPrice) - item.discount_amount) * item.quantity
          };
        }
        return item;
      });

      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = { ...currentTab, items: updatedItems };
      return { tabs: updatedTabs };
    });
  },

  updateItemDiscount: (cartItemId: string, discount: number) => {
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const currentTab = state.tabs[activeIndex];
      const updatedItems = currentTab.items.map(item => {
        if (item.cart_item_id === cartItemId) {
          const validDisc = Math.min(item.unit_price, Math.max(0, discount));
          return {
            ...item,
            discount_amount: validDisc,
            total_price: (item.unit_price - validDisc) * item.quantity
          };
        }
        return item;
      });

      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = { ...currentTab, items: updatedItems };
      return { tabs: updatedTabs };
    });
  },

  removeItem: (cartItemId: string) => {
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const currentTab = state.tabs[activeIndex];
      const filtered = currentTab.items.filter(i => i.cart_item_id !== cartItemId);

      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = { ...currentTab, items: filtered };
      return { tabs: updatedTabs };
    });
  },

  clearActiveCart: () => {
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const defaultTabName = `Bill ${activeIndex + 1}`;
      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = {
        ...state.tabs[activeIndex],
        tabName: defaultTabName,
        items: [],
        customerName: '',
        customerPhone: '',
        discountAmount: 0,
        notes: '',
        isGiftReceipt: false
      };
      return { tabs: updatedTabs };
    });
  },

  setCustomer: (name: string, phone: string) => {
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const defaultTabName = `Bill ${activeIndex + 1}`;
      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = {
        ...state.tabs[activeIndex],
        customerName: name,
        customerPhone: phone,
        tabName: name && name.trim() ? `${name.trim().substring(0, 12)}` : defaultTabName
      };
      return { tabs: updatedTabs };
    });
  },

  setBillDiscount: (amount: number, type: 'FLAT' | 'PERCENT') => {
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = {
        ...state.tabs[activeIndex],
        discountAmount: Math.max(0, amount),
        discountType: type
      };
      return { tabs: updatedTabs };
    });
  },

  toggleGiftReceipt: () => {
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = {
        ...state.tabs[activeIndex],
        isGiftReceipt: !state.tabs[activeIndex].isGiftReceipt
      };
      return { tabs: updatedTabs };
    });
  },

  setNotes: (notes: string) => {
    set(state => {
      const activeIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (activeIndex === -1) return state;

      const updatedTabs = [...state.tabs];
      updatedTabs[activeIndex] = {
        ...state.tabs[activeIndex],
        notes
      };
      return { tabs: updatedTabs };
    });
  },

  addTab: () => {
    set(state => {
      const newId = `cart-${Date.now()}`;
      const newTab: CartSession = {
        id: newId,
        tabName: `Bill ${state.tabs.length + 1}`,
        items: [],
        customerPhone: '',
        customerName: '',
        discountAmount: 0,
        discountType: 'FLAT',
        isGiftReceipt: false,
        notes: ''
      };
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newId
      };
    });
  },

  switchTab: (tabId: string) => {
    set({ activeTabId: tabId });
  },

  closeTab: (tabId: string) => {
    set(state => {
      if (state.tabs.length <= 1) {
        // Just clear the single tab
        return {
          tabs: [initialCart],
          activeTabId: 'cart-1'
        };
      }
      const filtered = state.tabs.filter(t => t.id !== tabId);
      const nextActiveId = state.activeTabId === tabId ? filtered[0].id : state.activeTabId;
      return {
        tabs: filtered,
        activeTabId: nextActiveId
      };
    });
  }
}));
