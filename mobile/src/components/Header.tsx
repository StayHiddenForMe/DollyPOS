import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw, Wifi, WifiOff, Bell, Laptop } from 'lucide-react-native';
import { useConnection } from '../context/ConnectionContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { NotificationModal } from './NotificationModal';
import { LowStockItem } from '../types';

interface HeaderProps {
  title: string;
  subtitle?: string;
  storeName?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  alertCount?: number;
  lowStockItems?: LowStockItem[];
  onNotificationPress?: () => void;
  onNavigateInventory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  storeName,
  onRefresh,
  isRefreshing = false,
  alertCount,
  lowStockItems,
  onNotificationPress,
  onNavigateInventory,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { isOnline, latencyMs, networkInfo, checkConnection } = useConnection();
  const { alertCount: globalAlertCount, lowStockItems: globalLowStockItems } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  const effectiveAlertCount = alertCount !== undefined ? alertCount : globalAlertCount;
  const effectiveLowStockItems = lowStockItems !== undefined ? lowStockItems : globalLowStockItems;

  const displayStoreName = storeName || networkInfo?.shop_name || 'Dolly POS';

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      setShowNotifications(true);
    }
  };

  return (
    <>
      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 14),
            backgroundColor: colors.card,
            borderBottomColor: colors.cardBorder,
          },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.titleContainer}>
            <Text style={[styles.storeName, { color: colors.brand[600] }]} numberOfLines={1}>
              {displayStoreName}
            </Text>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            {/* Laptop POS Connection Status Badge */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => checkConnection()}
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isOnline
                    ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                    : (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fff1f2'),
                  borderColor: isOnline ? '#10b981' : '#f43f5e',
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isOnline ? '#10b981' : '#f43f5e' },
                ]}
              />
              <Laptop size={11} color={isOnline ? '#10b981' : '#f43f5e'} />
              <Text
                style={[
                  styles.statusText,
                  {
                    color: isOnline
                      ? (isDark ? '#6ee7b7' : '#047857')
                      : (isDark ? '#fda4af' : '#be123c'),
                  },
                ]}
              >
                {isOnline ? 'Laptop Online' : 'Laptop Offline'}
              </Text>
            </TouchableOpacity>

            {/* Notification Bell Icon */}
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }]}
              onPress={handleNotificationPress}
              activeOpacity={0.7}
            >
              <Bell size={18} color={colors.textSecondary} />
              {effectiveAlertCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.badgeText}>
                    {effectiveAlertCount > 9 ? '9+' : effectiveAlertCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Quick Refresh Icon */}
            {onRefresh && (
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }]}
                onPress={onRefresh}
                disabled={isRefreshing}
                activeOpacity={0.7}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={colors.brand[600]} />
                ) : (
                  <RefreshCw size={17} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Notifications Modal Center */}
      <NotificationModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        lowStockItems={effectiveLowStockItems}
        alertCount={effectiveAlertCount}
        onNavigateInventory={onNavigateInventory}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    paddingRight: 8,
  },
  storeName: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});
