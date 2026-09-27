import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LowStockItem } from '../types';
import { api } from '../services/api';
import { useConnection } from './ConnectionContext';

interface NotificationContextType {
  lowStockItems: LowStockItem[];
  alertCount: number;
  isDismissed: boolean;
  isLoading: boolean;
  refreshNotifications: () => Promise<void>;
  dismissAllNotifications: () => Promise<void>;
  restoreNotifications: () => Promise<void>;
}

const NOTIFICATIONS_DISMISSED_KEY = '@dolly_pos_notifications_dismissed';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isOnline } = useConnection();
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load dismissal state
  useEffect(() => {
    const loadDismissedState = async () => {
      try {
        const val = await AsyncStorage.getItem(NOTIFICATIONS_DISMISSED_KEY);
        if (val === 'true') {
          setIsDismissed(true);
        }
      } catch (e) {
        console.warn('Failed to load notification dismissal state:', e);
      }
    };
    loadDismissedState();
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!isOnline) return;
    try {
      setIsLoading(true);
      const overview = await api.getOverview('TODAY');
      if (overview?.low_stock_items) {
        setLowStockItems(overview.low_stock_items);
      }
    } catch (e) {
      // Quiet fail if offline or temporary network jitter
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  // Initial load and periodic refresh every 45s when online
  useEffect(() => {
    if (isOnline) {
      refreshNotifications();
      const interval = setInterval(refreshNotifications, 45000);
      return () => clearInterval(interval);
    }
  }, [isOnline, refreshNotifications]);

  const dismissAllNotifications = async () => {
    setIsDismissed(true);
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_DISMISSED_KEY, 'true');
    } catch (e) {
      console.warn('Failed to save dismissal:', e);
    }
  };

  const restoreNotifications = async () => {
    setIsDismissed(false);
    try {
      await AsyncStorage.removeItem(NOTIFICATIONS_DISMISSED_KEY);
    } catch (e) {
      console.warn('Failed to clear dismissal:', e);
    }
  };

  const alertCount = isDismissed ? 0 : lowStockItems.length;

  return (
    <NotificationContext.Provider
      value={{
        lowStockItems,
        alertCount,
        isDismissed,
        isLoading,
        refreshNotifications,
        dismissAllNotifications,
        restoreNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
