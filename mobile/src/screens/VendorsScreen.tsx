import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import {
  Truck,
  Phone,
  Building2,
  CreditCard,
  Copy,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  X,
  Wallet,
  History,
  Edit3,
  ExternalLink,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react-native';
import { Header } from '../components/Header';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useConnection } from '../context/ConnectionContext';
import { Vendor, VendorLedgerEntry } from '../types';
import { formatINR } from '../utils/formatters';

type FilterTab = 'ALL' | 'PENDING' | 'SETTLED';

export const VendorsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useTheme();
  const { activeStore } = useConnection();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [totalDues, setTotalDues] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Vendor Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);
  const [addName, setAddName] = useState<string>('');
  const [addPhone, setAddPhone] = useState<string>('');
  const [addCompany, setAddCompany] = useState<string>('');
  const [addAltPhone, setAddAltPhone] = useState<string>('');
  const [addEmail, setAddEmail] = useState<string>('');
  const [addGstin, setAddGstin] = useState<string>('');
  const [addCity, setAddCity] = useState<string>('');
  const [addBankName, setAddBankName] = useState<string>('');
  const [addAccountNo, setAddAccountNo] = useState<string>('');
  const [addIfsc, setAddIfsc] = useState<string>('');
  const [addHolderName, setAddHolderName] = useState<string>('');
  const [addUpiId, setAddUpiId] = useState<string>('');
  const [addOpeningDue, setAddOpeningDue] = useState<string>('');
  const [addNotes, setAddNotes] = useState<string>('');

  // Payment Recording Modal
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedVendorForPayment, setSelectedVendorForPayment] = useState<Vendor | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Ledger Modal
  const [showLedgerModal, setShowLedgerModal] = useState<boolean>(false);
  const [selectedVendorForLedger, setSelectedVendorForLedger] = useState<Vendor | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<VendorLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState<boolean>(false);

  // Edit Vendor Modal
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const vendorSearchTimeoutRef = useRef<any>(null);

  const fetchVendors = useCallback(
    async (searchQuery = '') => {
      try {
        const res = await api.getVendors(searchQuery);
        setVendors(res.vendors || []);
        setTotalDues(res.total_dues || 0);

        if (!searchQuery) {
          const cacheKey = activeStore?.id
            ? `@dolly_pos_cached_vendors_${activeStore.id}`
            : '@dolly_pos_cached_vendors';
          AsyncStorage.setItem(cacheKey, JSON.stringify(res.vendors || [])).catch(() => {});
        }
      } catch (err: any) {
        console.warn('Failed to fetch vendors:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeStore?.id]
  );

  useEffect(() => {
    // Load cached vendors first
    const cacheKey = activeStore?.id
      ? `@dolly_pos_cached_vendors_${activeStore.id}`
      : '@dolly_pos_cached_vendors';
    AsyncStorage.getItem(cacheKey).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setVendors(parsed);
            const sum = parsed.reduce((acc, v) => acc + (parseFloat(v.outstanding_due) || 0), 0);
            setTotalDues(sum);
            setLoading(false);
          }
        } catch {}
      }
    });

    fetchVendors('');
  }, [fetchVendors]);

  // Auto-sync after 180s (3 min) if Vendors screen is open continuously
  useEffect(() => {
    const timer = setInterval(() => {
      fetchVendors(search.trim());
    }, 180000);
    return () => clearInterval(timer);
  }, [fetchVendors, search]);

  useEffect(() => {
    return () => {
      if (vendorSearchTimeoutRef.current) {
        clearTimeout(vendorSearchTimeoutRef.current);
      }
    };
  }, []);

  const handleSearch = (text: string) => {
    setSearch(text);
    if (vendorSearchTimeoutRef.current) {
      clearTimeout(vendorSearchTimeoutRef.current);
    }
    vendorSearchTimeoutRef.current = setTimeout(() => {
      fetchVendors(text.trim());
    }, 350);
  };

  const handleCopy = async (textToCopy: string, label: string) => {
    if (!textToCopy) return;
    await Clipboard.setStringAsync(textToCopy);
    showToast(`Copied ${label}!`);
  };

  const handlePayViaUPI = async (vendor: Vendor) => {
    if (!vendor.vendor_upi_id || !vendor.vendor_upi_id.trim()) {
      Alert.alert(
        'No UPI ID Found',
        `No UPI ID is saved for "${vendor.name}".\n\nWould you like to edit this vendor and add their UPI ID?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add UPI ID',
            onPress: () => {
              setEditVendor({ ...vendor });
              setShowEditModal(true);
            },
          },
        ]
      );
      return;
    }

    const cleanUpi = vendor.vendor_upi_id.trim();
    const cleanName = encodeURIComponent(vendor.name.trim());
    const dueAmount = vendor.outstanding_due > 0 ? vendor.outstanding_due.toFixed(2) : '';
    const upiUrl = `upi://pay?pa=${cleanUpi}&pn=${cleanName}${dueAmount ? `&am=${dueAmount}` : ''}&cu=INR`;

    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
      } else {
        await Linking.openURL(upiUrl);
      }
    } catch {
      await Clipboard.setStringAsync(cleanUpi);
      Alert.alert(
        'UPI Payment',
        `We copied "${cleanUpi}" to your clipboard.\n\nOpen Google Pay, PhonePe, or Paytm and paste the UPI ID to pay ₹${dueAmount || '0'}.`
      );
    }
  };

  const handleOpenPaymentModal = (vendor: Vendor) => {
    setSelectedVendorForPayment(vendor);
    setPaymentAmount(vendor.outstanding_due > 0 ? String(vendor.outstanding_due) : '');
    setPaymentMode('UPI');
    setPaymentRef('');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedVendorForPayment) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than ₹0.');
      return;
    }

    try {
      setIsSubmittingPayment(true);
      await api.recordVendorPayment(selectedVendorForPayment.id, {
        amount: amt,
        payment_mode: paymentMode,
        reference_no: paymentRef.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
        vendor_name: selectedVendorForPayment.name,
        vendor_phone: selectedVendorForPayment.phone,
      });

      // Optimistically update vendor card and total dues immediately
      const targetId = selectedVendorForPayment.id;
      const targetPhone = (selectedVendorForPayment.phone || '').trim();
      const targetName = (selectedVendorForPayment.name || '').trim().toLowerCase();

      setVendors((prevVendors) =>
        prevVendors.map((v) => {
          const matchId = v.id === targetId;
          const matchPhone = targetPhone && (v.phone || '').trim() === targetPhone;
          const matchName = targetName && (v.name || '').trim().toLowerCase() === targetName;
          if (matchId || matchPhone || matchName) {
            const currentDue = parseFloat(String(v.outstanding_due)) || 0;
            return {
              ...v,
              outstanding_due: Math.round((currentDue - amt) * 100) / 100,
            };
          }
          return v;
        })
      );
      setTotalDues((prev) => Math.round((prev - amt) * 100) / 100);

      showToast(`Recorded payment of ₹${amt.toLocaleString('en-IN')}!`);
      setShowPaymentModal(false);
      fetchVendors();
    } catch (err: any) {
      Alert.alert('Payment Error', err?.response?.data?.detail || err.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleOpenLedgerModal = async (vendor: Vendor) => {
    setSelectedVendorForLedger(vendor);
    setShowLedgerModal(true);
    setLoadingLedger(true);
    try {
      const entries = await api.getVendorLedger(vendor.id);
      setLedgerEntries(entries);
    } catch (err) {
      console.warn('Failed to fetch ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleSaveAddVendor = async () => {
    if (!addName.trim()) {
      Alert.alert('Validation Error', 'Vendor Name is required.');
      return;
    }
    if (!addPhone.trim()) {
      Alert.alert('Validation Error', 'Phone Number is required.');
      return;
    }

    try {
      setIsSubmittingAdd(true);
      await api.createVendor({
        name: addName.trim(),
        phone: addPhone.trim(),
        company_name: addCompany.trim() || undefined,
        alt_phone: addAltPhone.trim() || undefined,
        email: addEmail.trim() || undefined,
        gstin: addGstin.trim() || undefined,
        city: addCity.trim() || undefined,
        bank_name: addBankName.trim() || undefined,
        bank_account_no: addAccountNo.trim() || undefined,
        bank_ifsc: addIfsc.trim() || undefined,
        bank_holder_name: addHolderName.trim() || undefined,
        vendor_upi_id: addUpiId.trim() || undefined,
        opening_due: parseFloat(addOpeningDue) || 0,
        notes: addNotes.trim() || undefined,
      });

      showToast(`Added vendor "${addName}"!`);
      setShowAddModal(false);
      // Reset form
      setAddName('');
      setAddPhone('');
      setAddCompany('');
      setAddAltPhone('');
      setAddEmail('');
      setAddGstin('');
      setAddCity('');
      setAddBankName('');
      setAddAccountNo('');
      setAddIfsc('');
      setAddHolderName('');
      setAddUpiId('');
      setAddOpeningDue('');
      setAddNotes('');

      fetchVendors();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || err.message || 'Failed to create vendor');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleSaveEditVendor = async () => {
    if (!editVendor) return;
    if (!editVendor.name?.trim()) {
      Alert.alert('Validation Error', 'Vendor Name is required.');
      return;
    }
    if (!editVendor.phone?.trim()) {
      Alert.alert('Validation Error', 'Phone Number is required.');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      await api.updateVendor(editVendor.id, {
        name: editVendor.name.trim(),
        phone: editVendor.phone.trim(),
        company_name: editVendor.company_name?.trim() || undefined,
        alt_phone: editVendor.alt_phone?.trim() || undefined,
        email: editVendor.email?.trim() || undefined,
        gstin: editVendor.gstin?.trim() || undefined,
        city: editVendor.city?.trim() || undefined,
        bank_name: editVendor.bank_name?.trim() || undefined,
        bank_account_no: editVendor.bank_account_no?.trim() || undefined,
        bank_ifsc: editVendor.bank_ifsc?.trim() || undefined,
        bank_holder_name: editVendor.bank_holder_name?.trim() || undefined,
        vendor_upi_id: editVendor.vendor_upi_id?.trim() || undefined,
      });

      showToast('Vendor details updated!');
      setShowEditModal(false);
      fetchVendors();
    } catch (err: any) {
      Alert.alert('Update Error', err?.response?.data?.detail || err.message || 'Failed to update vendor');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Filter vendors based on statusFilter
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const due = parseFloat(String(v.outstanding_due)) || 0;
      if (filterTab === 'PENDING') return due > 0;
      if (filterTab === 'SETTLED') return due <= 0;
      return true;
    });
  }, [vendors, filterTab]);

  const pendingCount = useMemo(
    () => vendors.filter((v) => (parseFloat(String(v.outstanding_due)) || 0) > 0).length,
    [vendors]
  );
  const settledCount = useMemo(
    () => vendors.filter((v) => (parseFloat(String(v.outstanding_due)) || 0) <= 0).length,
    [vendors]
  );

  const renderVendorItem = ({ item }: { item: Vendor }) => {
    const due = parseFloat(String(item.outstanding_due)) || 0;
    const hasBank = !!(item.bank_name || item.bank_account_no || item.bank_ifsc);
    const hasUpi = !!(item.vendor_upi_id && item.vendor_upi_id.trim());

    return (
      <View style={styles.card}>
        {/* Header Row */}
        <View style={styles.cardTop}>
          <View style={styles.vendorInfo}>
            <Text style={styles.vendorName}>{item.name}</Text>
            {item.company_name ? (
              <View style={styles.companyRow}>
                <Building2 size={12} color={themeColors.textMuted} />
                <Text style={styles.companyText}>{item.company_name}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.phoneRow}
              onPress={() => item.phone && Linking.openURL(`tel:${item.phone}`)}
              activeOpacity={0.7}
            >
              <Phone size={12} color={themeColors.brand[600]} />
              <Text style={styles.phoneText}>{item.phone}</Text>
            </TouchableOpacity>
          </View>

          {/* Dues Badge */}
          <View
            style={[
              styles.duesBadge,
              due > 0 ? styles.duesPending : due < 0 ? styles.duesAdvance : styles.duesSettled,
            ]}
          >
            <Text
              style={[
                styles.duesLabel,
                due > 0 ? styles.duesPendingText : due < 0 ? styles.duesAdvanceText : styles.duesSettledText,
              ]}
            >
              {due > 0 ? 'Pending Dues' : due < 0 ? 'Advance Paid' : 'Settled'}
            </Text>
            <Text
              style={[
                styles.duesAmount,
                due > 0 ? styles.duesPendingAmount : due < 0 ? styles.duesAdvanceAmount : styles.duesSettledAmount,
              ]}
            >
              {due < 0 ? formatINR(Math.abs(due)) : formatINR(due)}
            </Text>
          </View>
        </View>

        {/* Banking & UPI Details Accordion / Card */}
        {(hasBank || hasUpi) && (
          <View style={styles.bankCard}>
            {hasUpi && (
              <View style={styles.upiRow}>
                <View style={styles.upiLabelGroup}>
                  <Wallet size={13} color={themeColors.brand[600]} />
                  <Text style={styles.upiLabel}>UPI ID:</Text>
                  <Text style={styles.upiValue}>{item.vendor_upi_id}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => handleCopy(item.vendor_upi_id!, 'UPI ID')}
                  activeOpacity={0.7}
                >
                  <Copy size={12} color={themeColors.brand[600]} />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
            )}

            {hasBank && (
              <View style={styles.bankDetailsBox}>
                <View style={styles.bankHeaderRow}>
                  <CreditCard size={13} color={themeColors.textSecondary} />
                  <Text style={styles.bankTitle}>{item.bank_name || 'Bank Account'}</Text>
                </View>

                {item.bank_account_no && (
                  <View style={styles.bankFieldRow}>
                    <Text style={styles.bankFieldLabel}>A/C No:</Text>
                    <Text style={styles.bankFieldValue}>{item.bank_account_no}</Text>
                    <TouchableOpacity
                      onPress={() => handleCopy(item.bank_account_no!, 'Account Number')}
                      style={styles.miniCopy}
                    >
                      <Copy size={11} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  </View>
                )}

                {item.bank_ifsc && (
                  <View style={styles.bankFieldRow}>
                    <Text style={styles.bankFieldLabel}>IFSC:</Text>
                    <Text style={[styles.bankFieldValue, { fontFamily: 'monospace' }]}>{item.bank_ifsc}</Text>
                    <TouchableOpacity
                      onPress={() => handleCopy(item.bank_ifsc!, 'IFSC Code')}
                      style={styles.miniCopy}
                    >
                      <Copy size={11} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  </View>
                )}

                {item.bank_holder_name && (
                  <View style={styles.bankFieldRow}>
                    <Text style={styles.bankFieldLabel}>Beneficiary:</Text>
                    <Text style={styles.bankFieldValue}>{item.bank_holder_name}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          {/* ⚡ 1-Tap Pay via UPI */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.upiPayBtn]}
            onPress={() => handlePayViaUPI(item)}
            activeOpacity={0.8}
          >
            <ArrowUpRight size={14} color="#ffffff" />
            <Text style={styles.upiPayText}>Pay via UPI</Text>
          </TouchableOpacity>

          {/* Record Payment */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.recordPaymentBtn]}
            onPress={() => handleOpenPaymentModal(item)}
            activeOpacity={0.8}
          >
            <Wallet size={13} color={themeColors.textPrimary} />
            <Text style={styles.recordPaymentText}>Record Payment</Text>
          </TouchableOpacity>

          {/* Ledger History */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.ledgerBtn]}
            onPress={() => handleOpenLedgerModal(item)}
            activeOpacity={0.8}
          >
            <History size={13} color={themeColors.textSecondary} />
            <Text style={styles.ledgerText}>Ledger</Text>
          </TouchableOpacity>

          {/* Edit Vendor */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => {
              setEditVendor({ ...item });
              setShowEditModal(true);
            }}
            activeOpacity={0.8}
          >
            <Edit3 size={13} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Vendors & Dues"
        subtitle={`${vendors.length} Vendors • Total Dues: ${formatINR(totalDues)}`}
        onRefresh={() => {
          setRefreshing(true);
          fetchVendors();
        }}
        isRefreshing={refreshing}
      />

      {toastMessage && (
        <View style={styles.toastBanner}>
          <CheckCircle size={15} color="#ffffff" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Dues KPI Banner */}
      <View style={styles.kpiCard}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>Total Vendors</Text>
          <Text style={styles.kpiValue}>{vendors.length}</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>Outstanding Dues</Text>
          <Text style={[styles.kpiValue, { color: totalDues > 0 ? themeColors.danger : themeColors.success }]}>
            {formatINR(totalDues)}
          </Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>Settled (₹0)</Text>
          <Text style={[styles.kpiValue, { color: themeColors.success }]}>{settledCount}</Text>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchContainer}>
          <Search size={16} color={themeColors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by vendor, code, phone..."
            placeholderTextColor={themeColors.textMuted}
            value={search}
            onChangeText={handleSearch}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterTab === 'ALL' && styles.filterChipActive]}
            onPress={() => setFilterTab('ALL')}
          >
            <Text style={[styles.filterChipText, filterTab === 'ALL' && styles.filterChipTextActive]}>
              All ({vendors.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterTab === 'PENDING' && styles.filterChipDangerActive]}
            onPress={() => setFilterTab('PENDING')}
          >
            <AlertCircle size={12} color={filterTab === 'PENDING' ? '#ffffff' : themeColors.danger} />
            <Text
              style={[
                styles.filterChipText,
                filterTab === 'PENDING' && styles.filterChipTextActive,
                filterTab !== 'PENDING' && { color: themeColors.danger },
              ]}
            >
              Pending Dues ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterTab === 'SETTLED' && styles.filterChipSuccessActive]}
            onPress={() => setFilterTab('SETTLED')}
          >
            <CheckCircle size={12} color={filterTab === 'SETTLED' ? '#ffffff' : themeColors.success} />
            <Text
              style={[
                styles.filterChipText,
                filterTab === 'SETTLED' && styles.filterChipTextActive,
                filterTab !== 'SETTLED' && { color: themeColors.success },
              ]}
            >
              Settled ({settledCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Vendor List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={themeColors.brand[600]} />
          <Text style={styles.loadingText}>Loading vendor directory...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredVendors}
          keyExtractor={(item, index) => `${item.id ?? 'v'}-${item.phone || item.name || index}-${index}`}
          renderItem={renderVendorItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 80, 100) },
          ]}
          onRefresh={() => {
            setRefreshing(true);
            fetchVendors();
          }}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Truck size={36} color={themeColors.textMuted} />
              <Text style={styles.emptyTitle}>No Vendors Found</Text>
              <Text style={styles.emptySub}>
                {search ? 'Try searching with another keyword.' : 'Tap "+ Add Vendor" below to create your first vendor.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating "+ Add Vendor" Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: Math.max(insets.bottom + 16, 24) }]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Plus size={20} color="#ffffff" />
        <Text style={styles.fabText}>Add Vendor</Text>
      </TouchableOpacity>

      {/* Modal: Record Payment */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Record Vendor Payment</Text>
                <Text style={styles.modalSub}>
                  {selectedVendorForPayment?.name} • Due: {formatINR(selectedVendorForPayment?.outstanding_due || 0)}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowPaymentModal(false)}>
                <X size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Payment Amount (₹) *</Text>
                <TextInput
                  style={[styles.inputField, { fontSize: 18, fontWeight: '800' }]}
                  placeholder="0.00"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  autoFocus
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Payment Mode</Text>
                <View style={styles.modeChipsRow}>
                  {['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE'].map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.modeChip, paymentMode === mode && styles.modeChipActive]}
                      onPress={() => setPaymentMode(mode)}
                    >
                      <Text style={[styles.modeChipText, paymentMode === mode && styles.modeChipTextActive]}>
                        {mode.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Reference No / UTR / Cheque No</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. UPI Ref 429381928371"
                  placeholderTextColor={themeColors.textMuted}
                  value={paymentRef}
                  onChangeText={setPaymentRef}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Notes / Remarks</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. Paid for Surat shipment parcel"
                  placeholderTextColor={themeColors.textMuted}
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, isSubmittingPayment && styles.btnDisabled]}
                onPress={handleSubmitPayment}
                disabled={isSubmittingPayment}
                activeOpacity={0.85}
              >
                {isSubmittingPayment ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Confirm & Record Payment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: View Ledger History */}
      <Modal visible={showLedgerModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '80%', paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Ledger History</Text>
                <Text style={styles.modalSub}>{selectedVendorForLedger?.name}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLedgerModal(false)}>
                <X size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingLedger ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={themeColors.brand[600]} />
                <Text style={{ marginTop: 10, color: themeColors.textMuted, fontSize: 12 }}>
                  Loading ledger transactions...
                </Text>
              </View>
            ) : ledgerEntries.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <History size={36} color={themeColors.textMuted} />
                <Text style={[styles.emptyTitle, { marginTop: 10 }]}>No Ledger Entries</Text>
                <Text style={styles.emptySub}>No purchase bills or payments logged yet.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
                {ledgerEntries.map((e, idx) => (
                  <View key={idx} style={styles.ledgerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ledgerType}>{e.entry_type.replace('_', ' ')}</Text>
                      <Text style={styles.ledgerDate}>{e.created_at || '—'}</Text>
                      {e.reference_no && <Text style={styles.ledgerRef}>Ref: {e.reference_no}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {e.debit_amount > 0 ? (
                        <Text style={[styles.ledgerAmount, { color: themeColors.success }]}>
                          - {formatINR(e.debit_amount)} (Paid)
                        </Text>
                      ) : (
                        <Text style={[styles.ledgerAmount, { color: themeColors.danger }]}>
                          + {formatINR(e.credit_amount)} (Bill)
                        </Text>
                      )}
                      <Text style={styles.ledgerBalance}>Balance: {formatINR(e.balance_after)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Add New Vendor */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add New Vendor</Text>
                <Text style={styles.modalSub}>Syncs directly to Dolly POS laptop & Cloud Hub</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAddModal(false)}>
                <X size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Vendor / Contact Name *</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. Ramesh Bhai Surat"
                  placeholderTextColor={themeColors.textMuted}
                  value={addName}
                  onChangeText={setAddName}
                />
              </View>

              <View style={styles.rowInputs}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="10-digit mobile"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="phone-pad"
                    value={addPhone}
                    onChangeText={setAddPhone}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Company / Agency</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="e.g. Dolly Textiles"
                    placeholderTextColor={themeColors.textMuted}
                    value={addCompany}
                    onChangeText={setAddCompany}
                  />
                </View>
              </View>

              {/* UPI ID */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>UPI ID (For 1-Tap Mobile Payment)</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. vendor@okaxis / 9876543210@upi"
                  placeholderTextColor={themeColors.textMuted}
                  value={addUpiId}
                  onChangeText={setAddUpiId}
                  autoCapitalize="none"
                />
              </View>

              {/* Bank Details */}
              <View style={styles.sectionHeaderBox}>
                <CreditCard size={14} color={themeColors.brand[600]} />
                <Text style={styles.sectionHeaderText}>Bank Account Details (Optional)</Text>
              </View>

              <View style={styles.rowInputs}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Bank Name</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="e.g. HDFC / SBI"
                    placeholderTextColor={themeColors.textMuted}
                    value={addBankName}
                    onChangeText={setAddBankName}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Account Number</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="A/C Number"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="numeric"
                    value={addAccountNo}
                    onChangeText={setAddAccountNo}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>IFSC Code</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="e.g. HDFC0001234"
                    placeholderTextColor={themeColors.textMuted}
                    autoCapitalize="characters"
                    value={addIfsc}
                    onChangeText={setAddIfsc}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Beneficiary Name</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Account Holder"
                    placeholderTextColor={themeColors.textMuted}
                    value={addHolderName}
                    onChangeText={setAddHolderName}
                  />
                </View>
              </View>

              {/* Opening Balance */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Opening Outstanding Dues (₹)</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="0.00"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={addOpeningDue}
                  onChangeText={setAddOpeningDue}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, isSubmittingAdd && styles.btnDisabled]}
                onPress={handleSaveAddVendor}
                disabled={isSubmittingAdd}
                activeOpacity={0.85}
              >
                {isSubmittingAdd ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Vendor</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Edit Vendor Details */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Vendor Details</Text>
                <Text style={styles.modalSub}>Update phone, bank details, and UPI ID</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowEditModal(false)}>
                <X size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Vendor Name *</Text>
                <TextInput
                  style={styles.inputField}
                  value={editVendor?.name || ''}
                  onChangeText={(val) => setEditVendor((prev) => prev ? { ...prev, name: val } : null)}
                  placeholderTextColor={themeColors.textMuted}
                />
              </View>

              <View style={styles.rowInputs}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Phone *</Text>
                  <TextInput
                    style={styles.inputField}
                    value={editVendor?.phone || ''}
                    onChangeText={(val) => setEditVendor((prev) => prev ? { ...prev, phone: val } : null)}
                    keyboardType="phone-pad"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Company Name</Text>
                  <TextInput
                    style={styles.inputField}
                    value={editVendor?.company_name || ''}
                    onChangeText={(val) => setEditVendor((prev) => prev ? { ...prev, company_name: val } : null)}
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>UPI ID (For 1-Tap Mobile Payment)</Text>
                <TextInput
                  style={styles.inputField}
                  value={editVendor?.vendor_upi_id || ''}
                  onChangeText={(val) => setEditVendor((prev) => prev ? { ...prev, vendor_upi_id: val } : null)}
                  placeholder="e.g. 9876543210@upi"
                  placeholderTextColor={themeColors.textMuted}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.sectionHeaderBox}>
                <CreditCard size={14} color={themeColors.brand[600]} />
                <Text style={styles.sectionHeaderText}>Bank Account Details</Text>
              </View>

              <View style={styles.rowInputs}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Bank Name</Text>
                  <TextInput
                    style={styles.inputField}
                    value={editVendor?.bank_name || ''}
                    onChangeText={(val) => setEditVendor((prev) => prev ? { ...prev, bank_name: val } : null)}
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Account Number</Text>
                  <TextInput
                    style={styles.inputField}
                    value={editVendor?.bank_account_no || ''}
                    onChangeText={(val) => setEditVendor((prev) => prev ? { ...prev, bank_account_no: val } : null)}
                    keyboardType="numeric"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>IFSC Code</Text>
                  <TextInput
                    style={styles.inputField}
                    value={editVendor?.bank_ifsc || ''}
                    onChangeText={(val) => setEditVendor((prev) => prev ? { ...prev, bank_ifsc: val } : null)}
                    autoCapitalize="characters"
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldLabel}>Beneficiary Name</Text>
                  <TextInput
                    style={styles.inputField}
                    value={editVendor?.bank_holder_name || ''}
                    onChangeText={(val) => setEditVendor((prev) => prev ? { ...prev, bank_holder_name: val } : null)}
                    placeholderTextColor={themeColors.textMuted}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, isSubmittingEdit && styles.btnDisabled]}
                onPress={handleSaveEditVendor}
                disabled={isSubmittingEdit}
                activeOpacity={0.85}
              >
                {isSubmittingEdit ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Update Vendor Details</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const createStyles = (themeColors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.bg,
    },
    toastBanner: {
      backgroundColor: '#059669',
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
    kpiCard: {
      backgroundColor: themeColors.card,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    kpiItem: {
      alignItems: 'center',
      flex: 1,
    },
    kpiLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: themeColors.textMuted,
      textTransform: 'uppercase',
    },
    kpiValue: {
      fontSize: 16,
      fontWeight: '800',
      color: themeColors.textPrimary,
      marginTop: 2,
    },
    kpiDivider: {
      width: 1,
      height: 26,
      backgroundColor: themeColors.cardBorder,
    },
    filterSection: {
      backgroundColor: themeColors.card,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.cardBorder,
      paddingBottom: 8,
      marginTop: 10,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surfaceSubtle,
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 9,
      fontSize: 13,
      color: themeColors.textPrimary,
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
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: themeColors.surfaceSubtle,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    filterChipActive: {
      backgroundColor: themeColors.brand[600],
      borderColor: themeColors.brand[600],
    },
    filterChipDangerActive: {
      backgroundColor: themeColors.danger,
      borderColor: themeColors.danger,
    },
    filterChipSuccessActive: {
      backgroundColor: themeColors.success,
      borderColor: themeColors.success,
    },
    filterChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: themeColors.textSecondary,
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
      backgroundColor: themeColors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    vendorInfo: {
      flex: 1,
      marginRight: 8,
    },
    vendorName: {
      fontSize: 15,
      fontWeight: '800',
      color: themeColors.textPrimary,
    },
    companyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    companyText: {
      fontSize: 11,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    phoneText: {
      fontSize: 11,
      color: themeColors.brand[600],
      fontWeight: '700',
    },
    duesBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      alignItems: 'flex-end',
    },
    duesPending: {
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
    },
    duesSettled: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
    },
    duesLabel: {
      fontSize: 9,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    duesPendingText: {
      color: themeColors.danger,
    },
    duesSettledText: {
      color: themeColors.success,
    },
    duesAmount: {
      fontSize: 15,
      fontWeight: '800',
      marginTop: 2,
    },
    duesPendingAmount: {
      color: themeColors.danger,
    },
    duesSettledAmount: {
      color: themeColors.success,
    },
    duesAdvance: {
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
    },
    duesAdvanceText: {
      color: isDark ? '#60a5fa' : '#2563eb',
    },
    duesAdvanceAmount: {
      color: isDark ? '#60a5fa' : '#2563eb',
    },
    bankCard: {
      backgroundColor: themeColors.surfaceSubtle,
      borderRadius: 10,
      padding: 10,
      marginTop: 10,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    upiRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 6,
    },
    upiLabelGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flex: 1,
    },
    upiLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: themeColors.textSecondary,
    },
    upiValue: {
      fontSize: 12,
      fontWeight: '700',
      color: themeColors.brand[600],
      flex: 1,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: isDark ? 'rgba(225, 29, 72, 0.15)' : themeColors.brand[50],
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    copyBtnText: {
      fontSize: 10,
      fontWeight: '700',
      color: themeColors.brand[600],
    },
    bankDetailsBox: {
      borderTopWidth: 1,
      borderTopColor: themeColors.cardBorder,
      paddingTop: 6,
      marginTop: 4,
      gap: 3,
    },
    bankHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 3,
    },
    bankTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: themeColors.textPrimary,
    },
    bankFieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    bankFieldLabel: {
      fontSize: 10,
      color: themeColors.textMuted,
      fontWeight: '600',
      width: 75,
    },
    bankFieldValue: {
      fontSize: 11,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
    miniCopy: {
      padding: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: themeColors.cardBorder,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    upiPayBtn: {
      backgroundColor: '#059669', // Emerald Green for Payment
      flex: 1.2,
    },
    upiPayText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },
    recordPaymentBtn: {
      backgroundColor: themeColors.surfaceSubtle,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      flex: 1.4,
    },
    recordPaymentText: {
      color: themeColors.textPrimary,
      fontSize: 11,
      fontWeight: '700',
    },
    ledgerBtn: {
      backgroundColor: themeColors.surfaceSubtle,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      paddingHorizontal: 9,
    },
    ledgerText: {
      color: themeColors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    editBtn: {
      backgroundColor: themeColors.surfaceSubtle,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      paddingHorizontal: 8,
    },
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 10,
      fontSize: 12,
      color: themeColors.textMuted,
    },
    emptyBox: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      marginTop: 20,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.textPrimary,
      marginTop: 10,
    },
    emptySub: {
      fontSize: 12,
      color: themeColors.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    fab: {
      position: 'absolute',
      right: 20,
      backgroundColor: themeColors.brand[600],
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderRadius: 26,
      shadowColor: themeColors.brand[600],
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
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: themeColors.card,
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
      borderBottomColor: themeColors.cardBorder,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: themeColors.textPrimary,
    },
    modalSub: {
      fontSize: 11,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: themeColors.surfaceSubtle,
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
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
    },
    inputField: {
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: themeColors.textPrimary,
      backgroundColor: themeColors.surfaceSubtle,
    },
    rowInputs: {
      flexDirection: 'row',
      gap: 12,
    },
    halfField: {
      flex: 1,
      gap: 6,
    },
    sectionHeaderBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: themeColors.cardBorder,
    },
    sectionHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: themeColors.brand[600],
    },
    modeChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    modeChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: themeColors.surfaceSubtle,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    modeChipActive: {
      backgroundColor: themeColors.brand[600],
      borderColor: themeColors.brand[600],
    },
    modeChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: themeColors.textSecondary,
    },
    modeChipTextActive: {
      color: '#ffffff',
    },
    saveBtn: {
      backgroundColor: themeColors.brand[600],
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    saveBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },
    ledgerRow: {
      backgroundColor: themeColors.surfaceSubtle,
      borderRadius: 10,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    ledgerType: {
      fontSize: 13,
      fontWeight: '800',
      color: themeColors.textPrimary,
    },
    ledgerDate: {
      fontSize: 10,
      color: themeColors.textMuted,
      marginTop: 2,
    },
    ledgerRef: {
      fontSize: 10,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    ledgerAmount: {
      fontSize: 14,
      fontWeight: '800',
    },
    ledgerBalance: {
      fontSize: 10,
      color: themeColors.textMuted,
      marginTop: 2,
    },
  });
