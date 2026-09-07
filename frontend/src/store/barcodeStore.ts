import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '../types';

export interface BatchQueueItem {
  product: Product;
  copies: number;
}

interface BarcodeStoreState {
  queue: BatchQueueItem[];
  addToQueue: (product: Product, copies?: number) => void;
  updateCopies: (productId: number, copies: number) => void;
  removeFromQueue: (productId: number) => void;
  clearQueue: () => void;
}

export const useBarcodeStore = create<BarcodeStoreState>()(
  persist(
    (set) => ({
      queue: [],

      addToQueue: (product: Product, copies: number = 1) => {
        set((state) => {
          const existing = state.queue.find((item) => item.product.id === product.id);
          if (existing) {
            return {
              queue: state.queue.map((item) =>
                item.product.id === product.id
                  ? { ...item, copies: item.copies + copies }
                  : item
              )
            };
          }
          return {
            queue: [{ product, copies }, ...state.queue]
          };
        });
      },

      updateCopies: (productId: number, copies: number) => {
        set((state) => ({
          queue: state.queue.map((item) =>
            item.product.id === productId ? { ...item, copies: Math.max(1, copies) } : item
          )
        }));
      },

      removeFromQueue: (productId: number) => {
        set((state) => ({
          queue: state.queue.filter((item) => item.product.id !== productId)
        }));
      },

      clearQueue: () => {
        set({ queue: [] });
      }
    }),
    {
      name: 'dolly_pos_barcode_queue'
    }
  )
);
