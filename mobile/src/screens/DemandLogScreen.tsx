import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import {
  ClipboardList,
  Plus,
  Search,
  Phone,
  MessageCircle,
  Tag,
  Clock,
  CheckCircle2,
  Trash2,
  ChevronDown,
  X,
  AlertTriangle,
  RotateCw,
} from 'lucide-react-native';
import { Header } from '../components/Header';
import { useTheme } from '../context/ThemeContext';
import { useConnection } from '../context/ConnectionContext';
import { api } from '../services/api';
import { DemandItem } from '../types';

export const DemandLogScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { isOnline, activeStore } = useConnection();

  const [demands, setDemands] = useState<DemandItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_PROCUREMENT' | 'ORDERED_WITH_VENDOR' | 'FULFILLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State for logging new demand
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [itemDesc, setItemDesc] = useState<string>('');
  const [categoryName, setCategoryName] = useState<string>('Kids Wear');
  const [preferredSize, setPreferredSize] = useState<string>('');
  const [preferredColor, setPreferredColor] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [urgency, setUrgency] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [notes, setNotes] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const fetchDemands = useCallback(async () => {
    if (!isOnline) {
      setLoading(false);
      setIsRefreshing(false);
      return;
    }
    try {
      const res = await api.getDemands(statusFilter !== 'ALL' ? statusFilter : undefined);
      setDemands(res || []);
    } catch (err) {
      console.warn('Failed to load demands:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [isOnline, statusFilter, activeStore?.id]);

  useEffect(() => {
    fetchDemands();
  }, [fetchDemands]);

  // Auto-sync after 180s (3 min) if Demand Register is open continuously
  useEffect(() => {
    const timer = setInterval(() => {
      fetchDemands();
    }, 180000);
    return () => clearInterval(timer);
  }, [fetchDemands]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDemands();
  };

  const handleCreateDemand = async () => {
    if (!itemDesc.trim()) {
      Alert.alert('Required Field', 'Please enter what the customer asked for.');
      return;
    }

    try {
      setSubmitting(true);
      await api.createDemand({
        item_description: itemDesc.trim(),
        category_name: categoryName.trim() || undefined,
        preferred_size: preferredSize.trim() || undefined,
        preferred_color: preferredColor.trim() || undefined,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        urgency,
        notes: notes.trim() || undefined,
      });

      setModalVisible(false);
      showToast(`✓ Logged '${itemDesc.trim()}' to Demand Register`);

      // Reset form
      setItemDesc('');
      setPreferredSize('');
      setPreferredColor('');
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setUrgency('NORMAL');

      fetchDemands();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save demand request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: number, nextStatus: string) => {
    try {
      await api.updateDemandStatus(id, nextStatus);
      showToast(`Status updated to ${nextStatus.replace(/_/g, ' ')}`);
      fetchDemands();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleDelete = (id: number, desc: string) => {
    Alert.alert(
      'Remove Demand',
      `Delete '${desc}' from Demand Register?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteDemand(id);
              showToast('Demand log removed');
              fetchDemands();
            } catch (e: any) {
              Alert.alert('Error', 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const openWhatsApp = (phone?: string, item?: string) => {
    if (!phone) return;
    const clean = phone.replace(/\D/g, '');
    const num = clean.startsWith('91') && clean.length > 10 ? clean : `91${clean}`;
    const text = encodeURIComponent(`Hello! Regarding the ${item || 'item'} you requested at Dolly Toys & Kids Wear...`);
    Linking.openURL(`whatsapp://send?phone=${num}&text=${text}`).catch(() => {
      Linking.openURL(`https://wa.me/${num}?text=${text}`);
    });
  };

  const callPhone = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  // Search & tab status filter
  const filteredDemands = demands.filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.item_description.toLowerCase().includes(q) ||
      (d.customer_name && d.customer_name.toLowerCase().includes(q)) ||
      (d.preferred_size && d.preferred_size.toLowerCase().includes(q)) ||
      (d.preferred_color && d.preferred_color.toLowerCase().includes(q))
    );
  });

  const renderStatusBadge = (status: string) => {
    if (status === 'FULFILLED') {
      return (
        <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5', borderColor: '#10b981' }]}>
          <CheckCircle2 size={11} color="#10b981" />
          <Text style={[styles.statusPillText, { color: '#10b981' }]}>Stock Arrived</Text>
        </View>
      );
    }
    if (status === 'ORDERED_WITH_VENDOR') {
      return (
        <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#f5f3ff', borderColor: '#8b5cf6' }]}>
          <Clock size={11} color="#8b5cf6" />
          <Text style={[styles.statusPillText, { color: '#8b5cf6' }]}>Ordered</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fffbeb', borderColor: '#f59e0b' }]}>
        <Clock size={11} color="#f59e0b" />
        <Text style={[styles.statusPillText, { color: '#f59e0b' }]}>Pending Buy</Text>
      </View>
    );
  };

  const renderUrgencyBadge = (u: string) => {
    if (u === 'URGENT') {
      return (
        <View style={[styles.urgencyPill, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
          <Text style={[styles.urgencyPillText, { color: colors.danger }]}>🚨 Urgent</Text>
        </View>
      );
    }
    if (u === 'HIGH') {
      return (
        <View style={[styles.urgencyPill, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
          <Text style={[styles.urgencyPillText, { color: colors.warning }]}>High</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Header
        title="Demand Register"
        subtitle="Customer requests & market buying list"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Non-blocking Success Toast */}
      {toastMessage && (
        <View style={[styles.toastContainer, { backgroundColor: '#10b981' }]}>
          <CheckCircle2 size={16} color="#ffffff" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Controls Bar: Search & Action Button */}
      <View style={[styles.controlsCard, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
        <View style={styles.topControlRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }]}>
            <Search size={15} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search requested items or customer..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.brand[600] }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>+ Log</Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { key: 'ALL', label: 'All Requests' },
            { key: 'PENDING_PROCUREMENT', label: '⏳ Pending Buy' },
            { key: 'ORDERED_WITH_VENDOR', label: '📦 Ordered' },
            { key: 'FULFILLED', label: '✓ Stock Arrived' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterTab,
                statusFilter === tab.key
                  ? { backgroundColor: colors.brand[600], borderColor: colors.brand[600] }
                  : { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
              ]}
              onPress={() => setStatusFilter(tab.key as any)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  statusFilter === tab.key ? { color: '#ffffff', fontWeight: '800' } : { color: colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.brand[600]} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading customer demand register...</Text>
        </View>
      ) : filteredDemands.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ClipboardList size={44} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Demand Requests</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {searchQuery
              ? 'No requests match your search filter.'
              : 'Tap "+ Log" whenever a customer asks for an out-of-stock item!'}
          </Text>
          <TouchableOpacity
            style={[styles.emptyActionBtn, { backgroundColor: colors.brand[600] }]}
            onPress={() => setModalVisible(true)}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.emptyActionText}>Log Customer Demand</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredDemands}
          keyExtractor={(item, index) => `${item.id ?? 'd'}-${item.customer_phone || item.item_description || index}-${index}`}
          contentContainerStyle={styles.listContent}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <View style={[styles.demandCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.itemTitleBox}>
                  <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.item_description}</Text>
                  <View style={styles.chipsRow}>
                    {item.category_name ? (
                      <View style={[styles.chip, { backgroundColor: colors.surfaceSubtle }]}>
                        <Text style={[styles.chipText, { color: colors.textSecondary }]}>{item.category_name}</Text>
                      </View>
                    ) : null}
                    {item.preferred_size ? (
                      <View style={[styles.chip, { backgroundColor: colors.surfaceSubtle }]}>
                        <Text style={[styles.chipText, { color: colors.textSecondary }]}>Size: {item.preferred_size}</Text>
                      </View>
                    ) : null}
                    {item.preferred_color ? (
                      <View style={[styles.chip, { backgroundColor: colors.surfaceSubtle }]}>
                        <Text style={[styles.chipText, { color: colors.textSecondary }]}>{item.preferred_color}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.headerBadges}>
                  {item.request_count > 1 && (
                    <View style={[styles.countBadge, { backgroundColor: colors.brand[50] }]}>
                      <Text style={[styles.countBadgeText, { color: colors.brand[700] }]}>{item.request_count}x Asked</Text>
                    </View>
                  )}
                  {renderUrgencyBadge(item.urgency)}
                </View>
              </View>

              {/* Customer Info */}
              {(item.customer_name || item.customer_phone) && (
                <View style={[styles.customerRow, { borderTopColor: colors.cardBorder }]}>
                  <View style={styles.custLeft}>
                    <Text style={[styles.custName, { color: colors.textPrimary }]}>
                      {item.customer_name || 'Walk-in Customer'}
                    </Text>
                    {item.customer_phone && item.customer_phone !== 'N/A' && (
                      <Text style={[styles.custPhone, { color: colors.textMuted }]}>{item.customer_phone}</Text>
                    )}
                  </View>

                  {item.customer_phone && item.customer_phone !== 'N/A' && (
                    <View style={styles.custActions}>
                      <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7' }]}
                        onPress={() => openWhatsApp(item.customer_phone, item.item_description)}
                      >
                        <MessageCircle size={14} color="#10b981" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe' }]}
                        onPress={() => callPhone(item.customer_phone)}
                      >
                        <Phone size={14} color="#3b82f6" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Notes */}
              {item.notes ? (
                <View style={[styles.notesBox, { backgroundColor: colors.surfaceSubtle }]}>
                  <Text style={[styles.notesText, { color: colors.textSecondary }]}>"{item.notes}"</Text>
                </View>
              ) : null}

              {/* Card Footer: Status & Actions */}
              <View style={[styles.cardFooter, { borderTopColor: colors.cardBorder }]}>
                <View style={styles.footerLeft}>
                  {renderStatusBadge(item.status)}
                  <Text style={[styles.createdDate, { color: colors.textMuted }]}>{item.created_at}</Text>
                </View>

                <View style={styles.actionBtns}>
                  {item.status === 'PENDING_PROCUREMENT' && (
                    <TouchableOpacity
                      style={[styles.miniBtn, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#f5f3ff', borderColor: '#8b5cf6' }]}
                      onPress={() => handleUpdateStatus(item.id, 'ORDERED_WITH_VENDOR')}
                    >
                      <Text style={[styles.miniBtnText, { color: '#8b5cf6' }]}>Mark Ordered</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === 'ORDERED_WITH_VENDOR' && (
                    <TouchableOpacity
                      style={[styles.miniBtn, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5', borderColor: '#10b981' }]}
                      onPress={() => handleUpdateStatus(item.id, 'FULFILLED')}
                    >
                      <Text style={[styles.miniBtnText, { color: '#10b981' }]}>Mark Arrived</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.delBtn}
                    onPress={() => handleDelete(item.id, item.item_description)}
                  >
                    <Trash2 size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* MODAL: Log Customer Request */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.cardBorder }]}>
              <View style={styles.modalHeaderTitle}>
                <ClipboardList size={18} color={colors.brand[600]} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Log Customer Request</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Item Description */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                  What item did the customer ask for? *
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
                  placeholder="e.g. Size 28 Tuxedo Suit, Frozen Raincoat"
                  placeholderTextColor={colors.textMuted}
                  value={itemDesc}
                  onChangeText={setItemDesc}
                  autoFocus
                />
              </View>

              {/* Category & Size */}
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Category</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
                    placeholder="Boys Wear"
                    placeholderTextColor={colors.textMuted}
                    value={categoryName}
                    onChangeText={setCategoryName}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Size Needed</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
                    placeholder="Size 28 / 4-5Y"
                    placeholderTextColor={colors.textMuted}
                    value={preferredSize}
                    onChangeText={setPreferredSize}
                  />
                </View>
              </View>

              {/* Color & Urgency */}
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Preferred Color</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
                    placeholder="Black / Navy"
                    placeholderTextColor={colors.textMuted}
                    value={preferredColor}
                    onChangeText={setPreferredColor}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Urgency</Text>
                  <View style={styles.urgencyToggleRow}>
                    {(['NORMAL', 'HIGH', 'URGENT'] as const).map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[
                          styles.urgencyBtn,
                          urgency === u
                            ? { backgroundColor: colors.brand[600], borderColor: colors.brand[600] }
                            : { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
                        ]}
                        onPress={() => setUrgency(u)}
                      >
                        <Text
                          style={[
                            styles.urgencyBtnText,
                            urgency === u ? { color: '#ffffff', fontWeight: '800' } : { color: colors.textMuted },
                          ]}
                        >
                          {u === 'URGENT' ? '🚨' : u === 'HIGH' ? 'High' : 'Normal'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Customer Name & Phone */}
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Customer Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
                    placeholder="e.g. Rahul Sharma"
                    placeholderTextColor={colors.textMuted}
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Customer Mobile</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                  />
                </View>
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Notes / Specifications</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
                  placeholder="e.g. Customer needed for wedding on Friday"
                  placeholderTextColor={colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              {/* Submit Buttons */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.cardBorder }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.brand[600] }]}
                  onPress={handleCreateDemand}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Save Request</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  controlsCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  topControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    padding: 0,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  filterScroll: {
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
  demandCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    gap: 8,
  },
  itemTitleBox: {
    flex: 1,
    gap: 6,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  headerBadges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  urgencyPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  urgencyPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  custLeft: {
    flex: 1,
  },
  custName: {
    fontSize: 11,
    fontWeight: '700',
  },
  custPhone: {
    fontSize: 10,
    marginTop: 1,
  },
  custActions: {
    flexDirection: 'row',
    gap: 6,
  },
  contactBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesBox: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  createdDate: {
    fontSize: 10,
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  miniBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  delBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalScroll: {
    padding: 16,
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 12,
    fontWeight: '500',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  urgencyToggleRow: {
    flexDirection: 'row',
    gap: 4,
    height: 40,
    alignItems: 'center',
  },
  urgencyBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgencyBtnText: {
    fontSize: 11,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingBottom: 24,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
