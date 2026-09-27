import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Bell,
  X,
  AlertTriangle,
  Package,
  CheckCircle2,
  Server,
  ShieldCheck,
  ChevronRight,
  Trash2,
  RotateCcw,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useConnection } from '../context/ConnectionContext';
import { useNotifications } from '../context/NotificationContext';
import { LowStockItem } from '../types';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  lowStockItems?: LowStockItem[];
  alertCount?: number;
  onNavigateInventory?: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  lowStockItems: propLowStockItems,
  alertCount: propAlertCount,
  onNavigateInventory,
}) => {
  const { colors, isDark } = useTheme();
  const { isOnline, latencyMs, networkInfo } = useConnection();
  const {
    lowStockItems: globalLowStockItems,
    alertCount: globalAlertCount,
    isDismissed,
    dismissAllNotifications,
    restoreNotifications,
  } = useNotifications();

  const items = propLowStockItems && propLowStockItems.length > 0 ? propLowStockItems : globalLowStockItems;
  const count = propAlertCount !== undefined ? propAlertCount : globalAlertCount;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.bellBox, { backgroundColor: colors.brand[50] }]}>
                <Bell size={18} color={colors.brand[600]} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Notification Center
                </Text>
                <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
                  {count > 0 ? `${count} active alerts` : 'All systems normal'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView contentContainerStyle={styles.scrollBody}>
            {/* System Health Status */}
            <View style={[styles.sectionCard, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }]}>
              <View style={styles.sectionHeader}>
                <Server size={14} color={isOnline ? colors.success : colors.danger} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Counter POS Connection
                </Text>
              </View>
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
                <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                  {isOnline
                    ? `Connected to ${networkInfo?.shop_name || 'Dolly POS'} (${latencyMs ?? 0}ms)`
                    : 'Offline • Check store Wi-Fi or Tunnel URL'}
                </Text>
              </View>
            </View>

            {/* Dismissed State Banner */}
            {isDismissed && items.length > 0 && (
              <View style={[styles.dismissedBanner, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5', borderColor: colors.success }]}>
                <View style={styles.dismissedLeft}>
                  <CheckCircle2 size={16} color={colors.success} />
                  <Text style={[styles.dismissedText, { color: colors.success }]}>
                    All alerts cleared ({items.length} items hidden)
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.restoreBtn, { borderColor: colors.success }]}
                  onPress={restoreNotifications}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={11} color={colors.success} />
                  <Text style={[styles.restoreBtnText, { color: colors.success }]}>Show</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Low Stock Alerts */}
            {items.length > 0 && !isDismissed ? (
              <View style={styles.alertSection}>
                <View style={styles.alertSectionHeader}>
                  <View style={styles.alertHeaderTitleBox}>
                    <AlertTriangle size={15} color={colors.danger} />
                    <Text style={[styles.alertSectionTitle, { color: colors.danger }]}>
                      Low Stock Alerts ({items.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.clearBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2' }]}
                    onPress={dismissAllNotifications}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={12} color={colors.danger} />
                    <Text style={[styles.clearBtnText, { color: colors.danger }]}>Clear All</Text>
                  </TouchableOpacity>
                </View>

                {items.map((item) => {
                  const isOut = item.stock <= 0;
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.stockItemCard,
                        {
                          backgroundColor: isDark ? colors.surfaceSubtle : '#ffffff',
                          borderColor: colors.cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.itemSub, { color: colors.textMuted }]}>
                          Barcode: {item.barcode || '—'} • Min Alert: {item.min_stock}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.qtyBadge,
                          { backgroundColor: isOut ? colors.dangerLight : colors.warningLight },
                        ]}
                      >
                        <Text
                          style={[
                            styles.qtyBadgeText,
                            { color: isOut ? colors.danger : colors.warning },
                          ]}
                        >
                          {isOut ? 'OUT OF STOCK' : `Stock: ${item.stock}`}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {onNavigateInventory && (
                  <TouchableOpacity
                    style={[styles.viewInventoryBtn, { backgroundColor: colors.brand[50], borderColor: colors.brand[200] }]}
                    onPress={() => {
                      onClose();
                      onNavigateInventory();
                    }}
                    activeOpacity={0.8}
                  >
                    <Package size={14} color={colors.brand[600]} />
                    <Text style={[styles.viewInventoryBtnText, { color: colors.brand[600] }]}>
                      View & Manage Products in Inventory
                    </Text>
                    <ChevronRight size={14} color={colors.brand[600]} />
                  </TouchableOpacity>
                )}
              </View>
            ) : items.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckCircle2 size={36} color={colors.success} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Pending Alerts</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  All catalog items are stocked above their minimum safety thresholds.
                </Text>
              </View>
            ) : null}

            {/* Backup Status Alert */}
            <View style={[styles.sectionCard, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, marginTop: 12 }]}>
              <View style={styles.sectionHeader}>
                <ShieldCheck size={14} color={colors.brand[600]} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Database Protection
                </Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                1-Click local mobile backups and scheduled disk snapshots are active.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  scrollBody: {
    padding: 16,
    gap: 12,
  },
  sectionCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  dismissedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dismissedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dismissedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  restoreBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  alertSection: {
    gap: 8,
  },
  alertSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  alertHeaderTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 10,
    marginTop: 2,
  },
  qtyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  qtyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  viewInventoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  viewInventoryBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
