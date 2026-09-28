import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Search,
  Barcode,
  Package,
  AlertCircle,
  CheckCircle,
  Plus,
  X,
  Sparkles,
  Tag,
  DollarSign,
  Layers,
} from 'lucide-react-native';
import { Header } from '../components/Header';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useConnection } from '../context/ConnectionContext';
import { InventoryItem, InventoryResponse, CategoryItem } from '../types';
import { formatINR } from '../utils/formatters';
import { colors } from '../theme/colors';

export const InventoryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useTheme();
  const { activeStore } = useConnection();
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Add Product Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [newProdName, setNewProdName] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdCatId, setNewProdCatId] = useState<number | undefined>(undefined);
  const [newProdPurchase, setNewProdPurchase] = useState('');
  const [newProdSelling, setNewProdSelling] = useState('');
  const [newProdMRP, setNewProdMRP] = useState('');
  const [newProdStock, setNewProdStock] = useState('1');
  const [newProdAlert, setNewProdAlert] = useState('3');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInventory = useCallback(
    async (pageNum = 1, searchQuery = search, lowOnly = lowStockOnly, append = false) => {
      try {
        if (!append) setLoading(true);
        else setLoadingMore(true);

        const res = await api.getInventory(searchQuery, undefined, lowOnly, pageNum, 50);
        setData(res);
        if (append) {
          setProducts((prev) => [...prev, ...res.products]);
        } else {
          setProducts(res.products);
          if (pageNum === 1 && !searchQuery && !lowOnly) {
            const cacheKey = activeStore?.id ? `@dolly_pos_cached_inventory_${activeStore.id}` : '@dolly_pos_cached_inventory';
            AsyncStorage.setItem(cacheKey, JSON.stringify(res.products)).catch(() => {});
          }
        }
      } catch (err: any) {
        console.warn('Failed to fetch inventory:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [search, lowStockOnly, activeStore?.id]
  );

  useEffect(() => {
    fetchInventory(1, search, lowStockOnly, false);
  }, [lowStockOnly]);

  useEffect(() => {
    // 1. Instant Offline Load from store-specific cache
    const cacheKey = activeStore?.id ? `@dolly_pos_cached_inventory_${activeStore.id}` : '@dolly_pos_cached_inventory';
    AsyncStorage.getItem(cacheKey)
      .then((json) => {
        if (json) {
          const parsed = JSON.parse(json);
          if (parsed && Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
            setLoading(false);
          }
        } else {
          setProducts([]);
          setLoading(true);
        }
      })
      .catch(() => {});

    // Load categories for modal dropdown
    api.getCategories().then(setCategories).catch(() => {});
    fetchInventory(1, search, lowStockOnly, false);
  }, [activeStore?.id]);

  const handleSearch = (text: string) => {
    setSearch(text);
    setPage(1);
    fetchInventory(1, text, lowStockOnly, false);
  };

  const handleLoadMore = () => {
    if (data && data.has_more && !loadingMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchInventory(nextPage, search, lowStockOnly, true);
    }
  };

  const handleAutoGenerateBarcode = () => {
    const randomEAN = `890${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
    setNewProdBarcode(randomEAN);
  };

  const handleSaveProduct = async () => {
    if (!newProdName.trim()) {
      Alert.alert('Required', 'Please enter a product name');
      return;
    }
    if (!newProdSelling || isNaN(Number(newProdSelling))) {
      Alert.alert('Required', 'Please enter a valid selling price');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.addProduct({
        name: newProdName.trim(),
        barcode: newProdBarcode.trim() || undefined,
        category_id: newProdCatId,
        purchase_price: Number(newProdPurchase) || 0,
        selling_price: Number(newProdSelling),
        mrp: Number(newProdMRP) || Number(newProdSelling),
        stock_quantity: Number(newProdStock) || 0,
        min_stock_alert: Number(newProdAlert) || 3,
      });

      setShowAddModal(false);
      showToast(`✓ Done! '${newProdName.trim()}' saved to POS`);
      // Reset form
      setNewProdName('');
      setNewProdBarcode('');
      setNewProdPurchase('');
      setNewProdSelling('');
      setNewProdMRP('');
      setNewProdStock('1');
      // Refresh list
      fetchInventory(1, search, lowStockOnly, false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || err.message || 'Failed to add product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderProductItem = ({ item }: { item: InventoryItem }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.titleArea}>
          <Text style={styles.productName}>{item.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            {item.barcode && item.barcode !== '—' ? (
              <View style={styles.barcodeBadge}>
                <Barcode size={11} color={colors.textMuted} />
                <Text style={styles.barcodeText}>{item.barcode}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Stock Status Badge */}
        <View
          style={[
            styles.stockBadge,
            item.is_low_stock ? styles.stockLow : styles.stockOk,
          ]}
        >
          {item.is_low_stock ? (
            <AlertCircle size={13} color={colors.danger} />
          ) : (
            <CheckCircle size={13} color={colors.success} />
          )}
          <Text
            style={[
              styles.stockText,
              { color: item.is_low_stock ? colors.danger : colors.success },
            ]}
          >
            {item.current_stock} pcs
          </Text>
        </View>
      </View>

      <View style={styles.pricingRow}>
        <View>
          <Text style={styles.priceLabel}>Selling Price</Text>
          <Text style={styles.sellingPrice}>{formatINR(item.selling_price)}</Text>
        </View>

        {item.mrp && item.mrp > item.selling_price ? (
          <View style={styles.mrpBox}>
            <Text style={styles.priceLabel}>MRP</Text>
            <Text style={styles.mrpValue}>{formatINR(item.mrp)}</Text>
          </View>
        ) : null}

        {item.purchase_price > 0 ? (
          <View style={styles.mrpBox}>
            <Text style={styles.priceLabel}>Cost</Text>
            <Text style={styles.costValue}>{formatINR(item.purchase_price)}</Text>
          </View>
        ) : null}

        <View style={styles.minStockBox}>
          <Text style={styles.priceLabel}>Alert Level</Text>
          <Text style={styles.minStockValue}>&le; {item.min_stock} units</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Live Inventory"
        subtitle={`${data?.total_count || 0} Total Products`}
        onRefresh={() => {
          setRefreshing(true);
          setPage(1);
          fetchInventory(1, search, lowStockOnly, false);
        }}
        isRefreshing={refreshing}
      />

      {toastMessage && (
        <View style={styles.toastBanner}>
          <CheckCircle size={15} color="#ffffff" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchContainer}>
          <Search size={17} color={themeColors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.textPrimary }]}
            placeholder="Search by name, barcode, or code..."
            placeholderTextColor={themeColors.textMuted}
            value={search}
            onChangeText={handleSearch}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.filterChip, !lowStockOnly && styles.filterChipActive]}
            onPress={() => setLowStockOnly(false)}
          >
            <Text style={[styles.filterChipText, !lowStockOnly && styles.filterChipTextActive]}>
              All Catalog ({data?.total_count || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, lowStockOnly && styles.filterChipDangerActive]}
            onPress={() => setLowStockOnly(true)}
          >
            <AlertCircle size={12} color={lowStockOnly ? '#ffffff' : colors.danger} />
            <Text
              style={[
                styles.filterChipText,
                lowStockOnly && styles.filterChipTextActive,
                !lowStockOnly && { color: colors.danger },
              ]}
            >
              Low Stock Only
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.brand[600]} />
          <Text style={styles.loadingText}>Searching product catalog...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderProductItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 80, 100) },
          ]}
          onRefresh={() => {
            setRefreshing(true);
            setPage(1);
            fetchInventory(1, search, lowStockOnly, false);
          }}
          refreshing={refreshing}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.brand[600]} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Package size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Products Found</Text>
              <Text style={styles.emptySub}>Try searching with a different keyword or barcode.</Text>
            </View>
          }
        />
      )}

      {/* Floating "+ Add Product" Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom + 16, 24) }]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Plus size={20} color="#ffffff" />
        <Text style={styles.fabText}>Add Product</Text>
      </TouchableOpacity>

      {/* Modal: Add Product to Dolly POS */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add New Product</Text>
                <Text style={styles.modalSub}>Saved directly into Dolly POS database</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAddModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              {/* Product Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Product Name *</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. Remote Control Stunt Car"
                  placeholderTextColor={themeColors.textMuted}
                  value={newProdName}
                  onChangeText={setNewProdName}
                />
              </View>

              {/* Barcode with Auto-Generate */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Barcode (Optional)</Text>
                  <TouchableOpacity onPress={handleAutoGenerateBarcode} style={styles.autoBtn}>
                    <Sparkles size={12} color={colors.brand[600]} />
                    <Text style={styles.autoBtnText}>Auto-Generate</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.inputField}
                  placeholder="Scan or type barcode"
                  placeholderTextColor={themeColors.textMuted}
                  value={newProdBarcode}
                  onChangeText={setNewProdBarcode}
                />
              </View>

              {/* Category Picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Select Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.catChip,
                        newProdCatId === c.id && styles.catChipActive,
                      ]}
                      onPress={() => setNewProdCatId(newProdCatId === c.id ? undefined : c.id)}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          newProdCatId === c.id && styles.catChipTextActive,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Pricing Row: Purchase / Selling / MRP */}
              <View style={styles.rowInputs}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Cost Price (₹)</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="0"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    value={newProdPurchase}
                    onChangeText={setNewProdPurchase}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Selling Price (₹) *</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="0"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    value={newProdSelling}
                    onChangeText={setNewProdSelling}
                  />
                </View>
              </View>

              {/* MRP & Stock Row */}
              <View style={styles.rowInputs}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>MRP (₹)</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="0"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    value={newProdMRP}
                    onChangeText={setNewProdMRP}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Opening Stock</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="1"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    value={newProdStock}
                    onChangeText={setNewProdStock}
                  />
                </View>
              </View>

              {/* Alert Level */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Min Stock Alert Level</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="3"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={newProdAlert}
                  onChangeText={setNewProdAlert}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.saveProdBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleSaveProduct}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveProdBtnText}>Save Product to POS</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  filterSection: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.textPrimary,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
  },
  filterChipActive: {
    backgroundColor: colors.brand[600],
  },
  filterChipDangerActive: {
    backgroundColor: colors.danger,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleArea: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: colors.brand[50],
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand[600],
  },
  barcodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  barcodeText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.textSecondary,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockLow: {
    backgroundColor: '#fee2e2',
  },
  stockOk: {
    backgroundColor: '#ecfdf5',
  },
  stockText: {
    fontSize: 11,
    fontWeight: '800',
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
    paddingTop: 10,
  },
  priceLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  sellingPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  mrpBox: {
    alignItems: 'center',
  },
  mrpValue: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  costValue: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  minStockBox: {
    alignItems: 'flex-end',
  },
  minStockValue: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textMuted,
  },
  footerLoader: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: colors.brand[600],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 26,
    shadowColor: colors.brand[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: {
    padding: 20,
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  autoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  autoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand[600],
  },
  inputField: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSubtle,
  },
  catScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  catChipActive: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  catChipTextActive: {
    color: '#ffffff',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
    gap: 6,
  },
  saveProdBtn: {
    backgroundColor: colors.brand[600],
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveProdBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  toastBanner: {
    backgroundColor: '#059669', // Emerald success green
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
