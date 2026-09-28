import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TrendingUp,
  Receipt,
  ShoppingBag,
  IndianRupee,
  Clock,
  Sparkles,
  Calendar,
  WifiOff,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Header } from '../components/Header';
import { MetricCard } from '../components/MetricCard';
import { PaymentSplitBar } from '../components/PaymentSplitBar';
import { HourlyVelocityBar } from '../components/HourlyVelocityBar';
import { api } from '../services/api';
import { useConnection } from '../context/ConnectionContext';
import { useTheme } from '../context/ThemeContext';
import { DashboardOverview } from '../types';
import { formatINR } from '../utils/formatters';

interface OverviewScreenProps {
  navigation: any;
}

type PeriodType = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';

const formatDateYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { setLiveShopName, checkConnection } = useConnection();

  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineSnapshot, setIsOfflineSnapshot] = useState(false);
  const [offlineTimestamp, setOfflineTimestamp] = useState<string | null>(null);

  const todayStr = formatDateYMD(new Date());
  const [period, setPeriod] = useState<PeriodType>('TODAY');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [showCustomRange, setShowCustomRange] = useState(false);

  // 1. Instant Offline Cache Load (Runs in 0ms on startup even if laptop is OFF)
  useEffect(() => {
    const loadCachedSnapshot = async () => {
      try {
        const cachedJson = await AsyncStorage.getItem('@dolly_pos_cached_overview');
        const cachedTime = await AsyncStorage.getItem('@dolly_pos_cached_overview_time');
        if (cachedJson) {
          const parsed = JSON.parse(cachedJson);
          setData(parsed);
          setIsOfflineSnapshot(true);
          setOfflineTimestamp(cachedTime);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load cached overview snapshot:', err);
      }
    };
    loadCachedSnapshot();
  }, []);

  const isFetchingRef = useRef(false);

  const fetchOverview = useCallback(
    async (p: PeriodType, s?: string, e?: string) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        setError(null);
        const res = await api.getOverview(
          p,
          p === 'CUSTOM' ? s : undefined,
          p === 'CUSTOM' ? e : undefined
        );
        setData(res);
        setIsOfflineSnapshot(false);
        if (res.shop_name) {
          setLiveShopName(res.shop_name);
        }
        if (p === 'TODAY') {
          AsyncStorage.setItem('@dolly_pos_cached_overview', JSON.stringify(res)).catch(() => {});
          const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
          AsyncStorage.setItem('@dolly_pos_cached_overview_time', timeLabel).catch(() => {});
          setOfflineTimestamp(timeLabel);
        }
      } catch (err: any) {
        console.warn('Failed to load overview:', err);
        setIsOfflineSnapshot(true);
        setError(
          err?.response?.status === 503
            ? 'POS Server is temporarily unavailable or tunnel is reconnecting. Pull down to refresh.'
            : err?.message || 'Could not connect to Dolly POS server.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        isFetchingRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    fetchOverview(period, startDate, endDate);
  }, [period, startDate, endDate, fetchOverview]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    checkConnection();
    fetchOverview(period, startDate, endDate);
  }, [fetchOverview, period, startDate, endDate, checkConnection]);

  const handleSelectPeriod = (newPeriod: PeriodType) => {
    if (newPeriod === period) return;
    setPeriod(newPeriod);
    const now = new Date();

    if (newPeriod === 'TODAY') {
      const s = formatDateYMD(now);
      setStartDate(s);
      setEndDate(s);
      setShowCustomRange(false);
    } else if (newPeriod === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const s = formatDateYMD(y);
      setStartDate(s);
      setEndDate(s);
      setShowCustomRange(false);
    } else if (newPeriod === 'WEEK') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setStartDate(formatDateYMD(w));
      setEndDate(formatDateYMD(now));
      setShowCustomRange(false);
    } else if (newPeriod === 'MONTH') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateYMD(m));
      setEndDate(formatDateYMD(now));
      setShowCustomRange(false);
    } else if (newPeriod === 'YEAR') {
      const yr = new Date(now.getFullYear(), 0, 1);
      setStartDate(formatDateYMD(yr));
      setEndDate(formatDateYMD(now));
      setShowCustomRange(false);
    } else if (newPeriod === 'CUSTOM') {
      setShowCustomRange(true);
    }
  };

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      fetchOverview('CUSTOM', startDate, endDate);
    }
  };

  if (loading && !data) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.brand[600]} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Syncing store pulse...
        </Text>
      </View>
    );
  }

  const sales = data?.sales;
  const isProfitPositive = (sales?.net_profit ?? 0) >= 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Header
        title="Live Pulse"
        subtitle={data?.date_str || undefined}
        storeName={data?.shop_name}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
        alertCount={data?.low_stock_count || 0}
        lowStockItems={data?.low_stock_items}
        onNavigateInventory={() => navigation.navigate('Inventory')}
      />

      {/* Date Range Selection Chips */}
      <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
              period === 'TODAY' && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
            ]}
            onPress={() => handleSelectPeriod('TODAY')}
          >
            <Text
              style={[
                styles.chipText,
                { color: colors.textSecondary },
                period === 'TODAY' && styles.chipTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
              period === 'YESTERDAY' && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
            ]}
            onPress={() => handleSelectPeriod('YESTERDAY')}
          >
            <Text
              style={[
                styles.chipText,
                { color: colors.textSecondary },
                period === 'YESTERDAY' && styles.chipTextActive,
              ]}
            >
              Yesterday
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
              period === 'WEEK' && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
            ]}
            onPress={() => handleSelectPeriod('WEEK')}
          >
            <Text
              style={[
                styles.chipText,
                { color: colors.textSecondary },
                period === 'WEEK' && styles.chipTextActive,
              ]}
            >
              Last 7 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
              period === 'MONTH' && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
            ]}
            onPress={() => handleSelectPeriod('MONTH')}
          >
            <Text
              style={[
                styles.chipText,
                { color: colors.textSecondary },
                period === 'MONTH' && styles.chipTextActive,
              ]}
            >
              This Month
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
              period === 'YEAR' && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
            ]}
            onPress={() => handleSelectPeriod('YEAR')}
          >
            <Text
              style={[
                styles.chipText,
                { color: colors.textSecondary },
                period === 'YEAR' && styles.chipTextActive,
              ]}
            >
              This Year
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
              period === 'CUSTOM' && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
            ]}
            onPress={() => handleSelectPeriod('CUSTOM')}
          >
            <Calendar size={12} color={period === 'CUSTOM' ? '#ffffff' : colors.textSecondary} />
            <Text
              style={[
                styles.chipText,
                { color: colors.textSecondary },
                period === 'CUSTOM' && styles.chipTextActive,
              ]}
            >
              Custom
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Custom Date Input Panel */}
      {showCustomRange && (
        <View style={[styles.customDateBox, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
          <View style={styles.dateField}>
            <Text style={[styles.dateLabel, { color: colors.textMuted }]}>From (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.dateInput, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-09-01"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.dateField}>
            <Text style={[styles.dateLabel, { color: colors.textMuted }]}>To (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.dateInput, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-09-27"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.brand[600] }]} onPress={handleApplyCustom}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 40) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.brand[600]]}
          />
        }
      >
        {isOfflineSnapshot && (
          <View style={[styles.offlineBanner, { backgroundColor: isDark ? 'rgba(234, 179, 8, 0.15)' : '#fefce8', borderColor: '#eab308' }]}>
            <WifiOff size={14} color="#eab308" />
            <Text style={[styles.offlineBannerText, { color: isDark ? '#fef08a' : '#854d0e' }]}>
              Offline Snapshot • Showing last synced store pulse {offlineTimestamp ? `(${offlineTimestamp})` : ''}. Laptop Dolly POS is currently offline.
            </Text>
          </View>
        )}

        {error && !isOfflineSnapshot ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
            <Text style={[styles.errorBannerText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {/* Hero Revenue Card */}
        <MetricCard
          title={`NET REVENUE (${period})`}
          value={formatINR(sales?.net_sales)}
          subtitle={`${sales?.bill_count || 0} Bills • Avg ${formatINR(sales?.average_bill)} / bill`}
          variant="primary"
          icon={<TrendingUp size={20} color="#ffffff" />}
          style={styles.heroCard}
        />

        {/* Profitability Banner */}
        <View style={[styles.profitBanner, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.profitHeader}>
            <Sparkles size={16} color={colors.brand[600]} />
            <Text style={[styles.profitTitle, { color: colors.textPrimary }]}>
              Profit & Margins ({period})
            </Text>
          </View>
          <View style={styles.profitGrid}>
            <View style={styles.profitItem}>
              <Text style={[styles.profitLabel, { color: colors.textMuted }]}>Gross Profit</Text>
              <Text style={[styles.profitVal, { color: colors.success }]}>
                {formatINR(sales?.gross_profit)}
              </Text>
              <Text style={[styles.profitSub, { color: colors.textSecondary }]}>
                Margin: {sales?.margin_percent || 0}%
              </Text>
            </View>
            <View style={styles.profitItem}>
              <Text style={[styles.profitLabel, { color: colors.textMuted }]}>Net Take-Home</Text>
              <Text
                style={[
                  styles.profitVal,
                  { color: isProfitPositive ? colors.success : colors.danger },
                ]}
              >
                {formatINR(sales?.net_profit)}
              </Text>
              <Text style={[styles.profitSub, { color: colors.textSecondary }]}>
                After {formatINR(data?.period_expenses)} exp
              </Text>
            </View>
            <View style={styles.profitItem}>
              <Text style={[styles.profitLabel, { color: colors.textMuted }]}>Product Cost (COGS)</Text>
              <Text style={[styles.profitVal, { color: colors.textPrimary }]}>
                {formatINR(sales?.total_cogs)}
              </Text>
              <Text style={[styles.profitSub, { color: colors.textSecondary }]}>Total purchase value</Text>
            </View>
          </View>
        </View>

        {/* Financial Metrics Grid (Khata removed as requested) */}
        <View style={styles.metricsGrid}>
          <MetricCard
            title="Gross Billing"
            value={formatINR(sales?.gross_sales)}
            icon={<Receipt size={16} color={colors.textSecondary} />}
            style={styles.halfCard}
          />
          <MetricCard
            title="Discounts Given"
            value={formatINR(sales?.total_discount)}
            icon={<IndianRupee size={16} color={colors.danger} />}
            variant="danger"
            style={styles.halfCard}
          />
          <MetricCard
            title="Period Expenses"
            value={formatINR(data?.period_expenses)}
            icon={<Clock size={16} color={colors.warning} />}
            variant="warning"
            style={styles.halfCard}
          />
          <MetricCard
            title="Tax Collected"
            value={formatINR(sales?.total_tax)}
            icon={<IndianRupee size={16} color={colors.brand[600]} />}
            style={styles.halfCard}
          />
        </View>

        {/* Payment Breakdown Bar */}
        {data?.payment_breakdown && (
          <View style={styles.sectionMargin}>
            <PaymentSplitBar
              breakdown={data.payment_breakdown}
              period={period}
              periodLabel={data.date_str}
            />
          </View>
        )}

        {/* Hourly Sales Velocity Chart (If Today or Yesterday) */}
        {data?.hourly_velocity && (period === 'TODAY' || period === 'YESTERDAY') && (
          <View style={styles.sectionMargin}>
            <HourlyVelocityBar data={data.hourly_velocity} />
          </View>
        )}

        {/* Top Products In This Period */}
        {data?.top_products && data.top_products.length > 0 && (
          <View style={[styles.sectionMargin, styles.topProductsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.topProductHeader}>
              <ShoppingBag size={18} color={colors.brand[600]} />
              <Text style={[styles.topProductTitle, { color: colors.textPrimary }]}>
                Top Selling Items ({period})
              </Text>
            </View>

            {data.top_products.map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.productRow,
                  idx < data.top_products.length - 1 && [styles.borderBottom, { borderBottomColor: colors.cardBorder }],
                ]}
              >
                <View style={[styles.rankBadge, { backgroundColor: colors.surfaceSubtle }]}>
                  <Text style={[styles.rankText, { color: colors.textPrimary }]}>#{idx + 1}</Text>
                </View>
                <View style={styles.productDetails}>
                  <Text style={[styles.productName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <Text style={[styles.productQty, { color: colors.textMuted }]}>{item.quantity} units sold</Text>
                </View>
                <Text style={[styles.productRev, { color: colors.brand[600] }]}>{formatINR(item.revenue)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.lastUpdatedRow}>
          <Text style={[styles.lastUpdatedText, { color: colors.textMuted }]}>
            Updated at {data?.last_updated || 'Just now'} • Real-time non-blocking
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  filterBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  customDateBox: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderBottomWidth: 1,
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
  },
  applyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  applyBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  offlineBanner: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineBannerText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  heroCard: {
    width: '100%',
  },
  profitBanner: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  profitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  profitTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  profitGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profitItem: {
    flex: 1,
  },
  profitLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  profitVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  profitSub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  halfCard: {
    width: '48%',
  },
  sectionMargin: {
    marginTop: 2,
  },
  topProductsCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  topProductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  topProductTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  borderBottom: {
    borderBottomWidth: 1,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 10,
    fontWeight: '800',
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
  },
  productQty: {
    fontSize: 11,
    marginTop: 1,
  },
  productRev: {
    fontSize: 13,
    fontWeight: '800',
  },
  lastUpdatedRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  lastUpdatedText: {
    fontSize: 11,
  },
});
