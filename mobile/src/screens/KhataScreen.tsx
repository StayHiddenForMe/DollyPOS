import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Search, MessageSquare, IndianRupee, Users, Phone } from 'lucide-react-native';
import { Header } from '../components/Header';
import { api } from '../services/api';
import { KhataCustomer, KhataResponse } from '../types';
import { formatINR } from '../utils/formatters';
import { colors } from '../theme/colors';

export const KhataScreen: React.FC = () => {
  const [data, setData] = useState<KhataResponse | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchKhata = useCallback(async (query?: string) => {
    try {
      const res = await api.getKhata(query);
      setData(res);
    } catch (err: any) {
      console.warn('Failed to fetch Khata:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchKhata();
  }, [fetchKhata]);

  const handleSearch = (text: string) => {
    setSearch(text);
    fetchKhata(text);
  };

  const handleWhatsAppReminder = async (customer: KhataCustomer) => {
    if (!customer.whatsapp_url) {
      Alert.alert('No Phone', 'This customer does not have a valid mobile number for WhatsApp.');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(customer.whatsapp_url);
      if (supported) {
        await Linking.openURL(customer.whatsapp_url);
      } else {
        await Linking.openURL(customer.whatsapp_url);
      }
    } catch {
      Alert.alert('WhatsApp Error', 'Could not open WhatsApp on this device.');
    }
  };

  const renderCustomerItem = ({ item }: { item: KhataCustomer }) => (
    <View style={styles.customerCard}>
      <View style={styles.cardHeader}>
        <View style={styles.nameBox}>
          <Text style={styles.customerName}>{item.name}</Text>
          <View style={styles.phoneRow}>
            <Phone size={12} color={colors.textMuted} />
            <Text style={styles.customerPhone}>{item.phone || 'No phone'}</Text>
          </View>
        </View>

        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Due Balance</Text>
          <Text style={styles.balanceVal}>{formatINR(item.balance)}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.waBtn, !item.clean_phone && styles.waBtnDisabled]}
          onPress={() => handleWhatsAppReminder(item)}
          disabled={!item.clean_phone}
          activeOpacity={0.8}
        >
          <MessageSquare size={15} color="#ffffff" />
          <Text style={styles.waBtnText}>Send WhatsApp Reminder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title="Customer Khata"
        subtitle="Outstanding Udhar & Reminders"
        onRefresh={() => {
          setRefreshing(true);
          fetchKhata(search);
        }}
        isRefreshing={refreshing}
      />

      {/* Summary KPI Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroLabel}>Total Outstanding Udhar</Text>
          <Text style={styles.heroAmount}>{formatINR(data?.total_outstanding || 0)}</Text>
        </View>
        <View style={styles.heroRight}>
          <View style={styles.countBadge}>
            <Users size={14} color={colors.danger} />
            <Text style={styles.countText}>{data?.total_customers || 0} Debtors</Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          value={search}
          onChangeText={handleSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.brand[600]} />
          <Text style={styles.loadingText}>Loading Khata records...</Text>
        </View>
      ) : (
        <FlatList
          data={data?.customers || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContent}
          onRefresh={() => {
            setRefreshing(true);
            fetchKhata(search);
          }}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <IndianRupee size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Outstanding Dues</Text>
              <Text style={styles.emptySub}>All customer khata accounts are settled!</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  heroBanner: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  heroLeft: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991b1b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.danger,
    marginTop: 2,
  },
  heroRight: {
    alignItems: 'flex-end',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
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
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 12,
  },
  customerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  nameBox: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  customerPhone: {
    fontSize: 12,
    color: colors.textMuted,
  },
  balanceBox: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  balanceVal: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.danger,
    marginTop: 2,
  },
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
    paddingTop: 12,
  },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366', // WhatsApp Brand Green
    borderRadius: 8,
    paddingVertical: 10,
  },
  waBtnDisabled: {
    backgroundColor: colors.cardBorder,
  },
  waBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
});
