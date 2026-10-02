import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FileSpreadsheet,
  FileText,
  Calendar,
  Layers,
  Receipt,
  TrendingDown,
  Filter,
  CreditCard,
  AlertTriangle,
  PackageCheck,
  IndianRupee,
  Info,
} from 'lucide-react-native';
import { Header } from '../components/Header';
import { api } from '../services/api';
import { exportReportToExcel } from '../services/excelService';
import { exportReportToPDF } from '../services/pdfService';
import { DatePickerModal } from '../components/DatePickerModal';
import { ReportResponse } from '../types';
import { formatINR } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';
import { useConnection } from '../context/ConnectionContext';

type ReportType = 'SALES' | 'PAYMENTS' | 'CATEGORIES' | 'EXPENSES' | 'PLANNER' | 'DAMAGED';
type PresetPeriod = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';

const formatDateYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ReportsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors: themeColors, isDark } = useTheme();
  const { activeStore } = useConnection();
  const todayStr = formatDateYMD(new Date());

  const [period, setPeriod] = useState<PresetPeriod>('TODAY');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reportType, setReportType] = useState<ReportType>('SALES');

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showCustomRange, setShowCustomRange] = useState(false);

  const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);

  const applyPreset = (preset: PresetPeriod) => {
    if (preset === 'CUSTOM') {
      setShowCustomRange(true);
      return;
    }
    setPeriod(preset);
    const now = new Date();
    setShowCustomRange(false);

    if (preset === 'TODAY') {
      const s = formatDateYMD(now);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const s = formatDateYMD(y);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === 'WEEK') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setStartDate(formatDateYMD(w));
      setEndDate(formatDateYMD(now));
    } else if (preset === 'MONTH') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateYMD(m));
      setEndDate(formatDateYMD(now));
    } else if (preset === 'YEAR') {
      const yr = new Date(now.getFullYear(), 0, 1);
      setStartDate(formatDateYMD(yr));
      setEndDate(formatDateYMD(now));
    }
  };

  const handleApplyCustomDates = (s: string, e: string) => {
    setStartDate(s);
    setEndDate(e);
    setPeriod('CUSTOM');
    setShowCustomRange(false);
  };

  const getReportCacheKey = useCallback(() => {
    const storePrefix = activeStore?.id ? `@dolly_pos_cached_report_${activeStore.id}` : '@dolly_pos_cached_report';
    return `${storePrefix}_${reportType}_${startDate}_${endDate}`;
  }, [activeStore?.id, reportType, startDate, endDate]);

  const fetchReports = useCallback(async () => {
    const cacheKey = getReportCacheKey();
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setReport(JSON.parse(cached));
        setLoading(false);
      } else {
        setLoading(true);
      }

      const res = await api.getReports(startDate, endDate, reportType);
      setReport(res);
      AsyncStorage.setItem(cacheKey, JSON.stringify(res)).catch(() => {});
    } catch (err: any) {
      console.warn('Failed to fetch reports:', err);
      const hasCached = await AsyncStorage.getItem(cacheKey);
      if (!hasCached) {
        Alert.alert('Offline Notice', err?.message || 'Could not reach POS server or Cloud Hub.');
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, reportType, activeStore?.id, getReportCacheKey]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Auto-sync after 180s (3 min) if Reports screen is open continuously
  useEffect(() => {
    const timer = setInterval(() => {
      fetchReports();
    }, 180000);
    return () => clearInterval(timer);
  }, [fetchReports]);

  const handleExportExcel = async () => {
    if (!report || report.rows.length === 0) {
      Alert.alert('No Data', 'No records found to export for the selected date range.');
      return;
    }
    setExportingExcel(true);
    try {
      let exportData = report;
      if (report.is_truncated) {
        exportData = await api.getReports(startDate, endDate, reportType, true);
      }
      await exportReportToExcel(exportData);
    } catch (e: any) {
      Alert.alert('Export Error', e?.message || 'Failed to export Excel file');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    if (!report || report.rows.length === 0) {
      Alert.alert('No Data', 'No records found to export for the selected date range.');
      return;
    }
    setExportingPdf(true);
    try {
      let exportData = report;
      if (report.is_truncated) {
        exportData = await api.getReports(startDate, endDate, reportType, true);
      }
      await exportReportToPDF(exportData);
    } catch (e: any) {
      Alert.alert('Export Error', e?.message || 'Failed to export PDF file');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Reports Studio"
        subtitle={reportType === 'DAMAGED' ? 'All-Time Damage Loss' : `${startDate} to ${endDate}`}
        onRefresh={fetchReports}
        isRefreshing={loading}
      />

      {/* Preset Range Filter Chips - Hidden for Damaged Goods */}
      {reportType !== 'DAMAGED' && (
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            <TouchableOpacity
              style={[styles.chip, period === 'TODAY' && styles.chipActive]}
              onPress={() => applyPreset('TODAY')}
            >
              <Text style={[styles.chipText, period === 'TODAY' && styles.chipTextActive]}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, period === 'YESTERDAY' && styles.chipActive]}
              onPress={() => applyPreset('YESTERDAY')}
            >
              <Text style={[styles.chipText, period === 'YESTERDAY' && styles.chipTextActive]}>Yesterday</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, period === 'WEEK' && styles.chipActive]}
              onPress={() => applyPreset('WEEK')}
            >
              <Text style={[styles.chipText, period === 'WEEK' && styles.chipTextActive]}>Last 7 Days</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, period === 'MONTH' && styles.chipActive]}
              onPress={() => applyPreset('MONTH')}
            >
              <Text style={[styles.chipText, period === 'MONTH' && styles.chipTextActive]}>This Month</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, period === 'YEAR' && styles.chipActive]}
              onPress={() => applyPreset('YEAR')}
            >
              <Text style={[styles.chipText, period === 'YEAR' && styles.chipTextActive]}>This Year</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, period === 'CUSTOM' && styles.chipActive]}
              onPress={() => setShowCustomRange(true)}
            >
              <Calendar size={13} color={period === 'CUSTOM' ? '#ffffff' : themeColors.textSecondary} />
              <Text style={[styles.chipText, period === 'CUSTOM' && styles.chipTextActive]}>Custom Range</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Custom Range Indicator Bar */}
      {reportType !== 'DAMAGED' && period === 'CUSTOM' && (
        <TouchableOpacity style={styles.customRangeBar} onPress={() => setShowCustomRange(true)} activeOpacity={0.8}>
          <Calendar size={14} color={themeColors.brand[600]} />
          <Text style={styles.customRangeDisplayText}>
            Active Custom Range: <Text style={{ fontWeight: '800', color: themeColors.brand[600] }}>{startDate} → {endDate}</Text> (Tap to change)
          </Text>
        </TouchableOpacity>
      )}

      {/* Interactive Date Picker Modal */}
      <DatePickerModal
        visible={showCustomRange}
        onClose={() => setShowCustomRange(false)}
        onApply={handleApplyCustomDates}
        initialStartDate={startDate}
        initialEndDate={endDate}
      />

      {/* 6 Report Type Selector Tabs: Sales Register, Payments, Categories, Expenses, Stock Planner, Damaged Goods */}
      <View style={styles.typeTabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeTabsScroll}>
          <TouchableOpacity
            style={[styles.typeTab, reportType === 'SALES' && styles.typeTabActive]}
            onPress={() => setReportType('SALES')}
          >
            <Receipt size={14} color={reportType === 'SALES' ? '#ffffff' : themeColors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'SALES' && styles.typeTabTextActive]}>
              Sales Register
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeTab, reportType === 'PAYMENTS' && styles.typeTabActive]}
            onPress={() => setReportType('PAYMENTS')}
          >
            <CreditCard size={14} color={reportType === 'PAYMENTS' ? '#ffffff' : themeColors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'PAYMENTS' && styles.typeTabTextActive]}>
              Payments
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeTab, reportType === 'CATEGORIES' && styles.typeTabActive]}
            onPress={() => setReportType('CATEGORIES')}
          >
            <Layers size={14} color={reportType === 'CATEGORIES' ? '#ffffff' : themeColors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'CATEGORIES' && styles.typeTabTextActive]}>
              Categories
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeTab, reportType === 'EXPENSES' && styles.typeTabActive]}
            onPress={() => setReportType('EXPENSES')}
          >
            <TrendingDown size={14} color={reportType === 'EXPENSES' ? '#ffffff' : themeColors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'EXPENSES' && styles.typeTabTextActive]}>
              Expenses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeTab, reportType === 'PLANNER' && styles.typeTabActive]}
            onPress={() => setReportType('PLANNER')}
          >
            <PackageCheck size={14} color={reportType === 'PLANNER' ? '#ffffff' : themeColors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'PLANNER' && styles.typeTabTextActive]}>
              Stock Planner
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeTab, reportType === 'DAMAGED' && styles.typeTabActive]}
            onPress={() => setReportType('DAMAGED')}
          >
            <AlertTriangle size={14} color={reportType === 'DAMAGED' ? '#ffffff' : themeColors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'DAMAGED' && styles.typeTabTextActive]}>
              Damaged Goods
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Summary Card */}
        {report && report.summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {reportType === 'SALES' && 'Period Sales Summary'}
              {reportType === 'PAYMENTS' && 'Collections by Channel'}
              {reportType === 'CATEGORIES' && 'Category Revenue Performance'}
              {reportType === 'EXPENSES' && 'Expense Total'}
              {reportType === 'DAMAGED' && 'Damaged Goods Valuation'}
              {reportType === 'PLANNER' && 'Critical Reorder Need'}
            </Text>

            <View style={styles.summaryGrid}>
              {reportType === 'SALES' && (
                <>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Total Bills</Text>
                    <Text style={styles.sumValue}>{report.summary.total_bills ?? 0}</Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Gross Sales</Text>
                    <Text style={styles.sumValue}>{formatINR(report.summary.total_gross)}</Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Net Revenue</Text>
                    <Text style={[styles.sumValue, { color: themeColors.brand[600] }]}>
                      {formatINR(report.summary.total_net)}
                    </Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Avg Daily Sales</Text>
                    <Text style={styles.sumValue}>{formatINR(report.summary.avg_daily_sales)}</Text>
                  </View>
                </>
              )}

              {reportType === 'PAYMENTS' && (
                <>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Total Collected</Text>
                    <Text style={[styles.sumValue, { color: themeColors.success }]}>
                      {formatINR(report.summary.total_collected)}
                    </Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Total Transactions</Text>
                    <Text style={styles.sumValue}>{report.summary.total_transactions ?? 0}</Text>
                  </View>
                </>
              )}

              {reportType === 'CATEGORIES' && (
                <>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Active Categories</Text>
                    <Text style={styles.sumValue}>{report.summary.total_categories ?? 0}</Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Total Department Revenue</Text>
                    <Text style={[styles.sumValue, { color: themeColors.brand[600] }]}>
                      {formatINR(report.summary.total_revenue)}
                    </Text>
                  </View>
                </>
              )}

              {reportType === 'EXPENSES' && (
                <>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Total Entries</Text>
                    <Text style={styles.sumValue}>{report.summary.total_entries ?? 0}</Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Total Expenses</Text>
                    <Text style={[styles.sumValue, { color: themeColors.danger }]}>
                      {formatINR(report.summary.total_expense)}
                    </Text>
                  </View>
                </>
              )}

              {reportType === 'DAMAGED' && (
                <>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Damaged Products</Text>
                    <Text style={styles.sumValue}>{report.summary.damaged_products_count ?? 0}</Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Damaged Units</Text>
                    <Text style={[styles.sumValue, { color: themeColors.danger }]}>
                      {report.summary.total_damaged_units ?? 0}
                    </Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Cost Value Loss</Text>
                    <Text style={[styles.sumValue, { color: themeColors.danger }]}>
                      {formatINR(report.summary.total_cost_loss)}
                    </Text>
                  </View>
                </>
              )}

              {reportType === 'PLANNER' && (
                <>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Critical Low Items</Text>
                    <Text style={[styles.sumValue, { color: themeColors.danger }]}>
                      {report.summary.critical_items_count ?? 0}
                    </Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Suggested Order Units</Text>
                    <Text style={[styles.sumValue, { color: themeColors.brand[600] }]}>
                      {report.summary.total_suggested_units ?? 0}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Data Table */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={themeColors.brand[600]} />
            <Text style={styles.loadingText}>Generating report preview...</Text>
          </View>
        ) : !report || report.rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Filter size={32} color={themeColors.textMuted} />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptySub}>No transactions found for this date range.</Text>
          </View>
        ) : (
          <View style={styles.tableCard}>
            {report.is_truncated && (
              <View style={styles.truncatedNotice}>
                <Info size={14} color="#0284c7" />
                <Text style={styles.truncatedText}>
                  Showing latest {report.rows.length} of {report.total_rows || (report.summary as any).total_bills || report.rows.length} bills. Tap Export Excel / PDF to download the full archive.
                </Text>
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  {reportType === 'DAMAGED' ? (
                    <>
                      <Text style={[styles.thText, { width: 170 }]}>Product Name</Text>
                      <Text style={[styles.thText, { width: 120 }]}>Barcode</Text>
                      <Text style={[styles.thText, { width: 95, textAlign: 'center' }]}>Damaged Qty</Text>
                      <Text style={[styles.thText, { width: 110, textAlign: 'right' }]}>Cost Price (₹)</Text>
                    </>
                  ) : reportType === 'PLANNER' ? (
                    <>
                      <Text style={[styles.thText, { width: 190 }]}>Product Name</Text>
                      <Text style={[styles.thText, { width: 100, textAlign: 'center' }]}>Stock Left</Text>
                      <Text style={[styles.thText, { width: 120, textAlign: 'center' }]}>Suggested Order</Text>
                    </>
                  ) : (
                    report.columns.map((col, idx) => (
                      <Text key={idx} style={[styles.thText, idx === 0 && { width: 120 }]}>
                        {col}
                      </Text>
                    ))
                  )}
                </View>

                {/* Table Rows */}
                {report.rows.map((row, rIdx) => (
                  <View
                    key={rIdx}
                    style={[
                      styles.tableRow,
                      rIdx % 2 === 1 && styles.tableRowZebra,
                    ]}
                  >
                    {reportType === 'SALES' && (
                      <>
                        <View style={{ width: 120 }}>
                          <Text style={[styles.tdText, styles.tdBold, { paddingHorizontal: 0 }]}>
                            {row.date_display || row.date}
                          </Text>
                          {row.time && (
                            <Text style={{ fontSize: 10, color: themeColors.textMuted }}>{row.time}</Text>
                          )}
                        </View>
                        <Text style={[styles.tdText, styles.tdBold, { width: 95 }]}>
                          {row.bill_number || row.bills || '—'}
                        </Text>
                        <Text style={[styles.tdText, { width: 110 }]} numberOfLines={1}>
                          {row.customer || 'Walk-in Customer'}
                        </Text>
                        <View style={{ width: 85, paddingHorizontal: 6 }}>
                          <View style={styles.modeBadge}>
                            <Text style={styles.modeBadgeText}>{row.payment_mode || 'CASH'}</Text>
                          </View>
                        </View>
                        <Text style={[styles.tdText, { width: 90, textAlign: 'right' }]}>
                          {formatINR(row.gross_amount)}
                        </Text>
                        <Text style={[styles.tdText, { width: 80, textAlign: 'right', color: themeColors.danger }]}>
                          -{formatINR(row.discount)}
                        </Text>
                        <Text style={[styles.tdText, { width: 75, textAlign: 'right' }]}>
                          {formatINR(row.tax)}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 105, textAlign: 'right', color: themeColors.textPrimary }]}>
                          {formatINR(row.net_amount)}
                        </Text>
                      </>
                    )}

                    {reportType === 'PAYMENTS' && (
                      <>
                        <Text style={[styles.tdText, styles.tdBold, { width: 140 }]}>
                          {row.mode}
                        </Text>
                        <Text style={[styles.tdText, { width: 90, textAlign: 'center' }]}>
                          {row.bills}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 120, textAlign: 'right' }]}>
                          {formatINR(row.amount)}
                        </Text>
                        <Text style={[styles.tdText, { width: 90, textAlign: 'right', color: themeColors.success, fontWeight: '700' }]}>
                          {row.share_pct}%
                        </Text>
                      </>
                    )}

                    {reportType === 'CATEGORIES' && (
                      <>
                        <Text style={[styles.tdText, styles.tdBold, { width: 150 }]}>
                          {row.category}
                        </Text>
                        <Text style={[styles.tdText, { width: 90, textAlign: 'center' }]}>
                          {row.units_sold}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 110, textAlign: 'right' }]}>
                          {formatINR(row.revenue)}
                        </Text>
                        <Text style={[styles.tdText, { width: 90, textAlign: 'right', color: themeColors.success, fontWeight: '700' }]}>
                          {row.share_pct}%
                        </Text>
                      </>
                    )}

                    {reportType === 'EXPENSES' && (
                      <>
                        <Text style={[styles.tdText, styles.tdBold, { width: 110 }]}>
                          {row.date}
                        </Text>
                        <Text style={[styles.tdText, { width: 110 }]}>
                          {row.category}
                        </Text>
                        <Text style={[styles.tdText, { width: 160 }]} numberOfLines={1}>
                          {row.description}
                        </Text>
                        <Text style={[styles.tdText, { width: 80, textAlign: 'center' }]}>
                          {row.payment_mode || 'CASH'}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 100, textAlign: 'right', color: themeColors.danger }]}>
                          {formatINR(row.amount)}
                        </Text>
                      </>
                    )}

                    {reportType === 'PLANNER' && (
                      <>
                        <Text style={[styles.tdText, styles.tdBold, { width: 190 }]} numberOfLines={1}>
                          {row.product_name}
                        </Text>
                        <Text
                          style={[
                            styles.tdText,
                            styles.tdBold,
                            {
                              width: 100,
                              textAlign: 'center',
                              color: (row.current_stock ?? row.stock ?? 0) <= 0 ? themeColors.danger : themeColors.textPrimary,
                            },
                          ]}
                        >
                          {row.current_stock ?? row.stock ?? 0}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 120, textAlign: 'center', color: themeColors.brand[600] }]}>
                          {row.suggested_order ?? 0} units
                        </Text>
                      </>
                    )}

                    {reportType === 'DAMAGED' && (
                      <>
                        <Text style={[styles.tdText, styles.tdBold, { width: 170 }]} numberOfLines={1}>
                          {row.product_name}
                        </Text>
                        <Text style={[styles.tdText, { width: 120, fontFamily: 'monospace' }]}>
                          {row.barcode || '—'}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 95, textAlign: 'center', color: themeColors.danger }]}>
                          {row.damaged_units ?? row.damaged_quantity ?? 0}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 110, textAlign: 'right', color: themeColors.textPrimary }]}>
                          {formatINR(row.cost_price ?? row.purchase_price ?? 0)}
                        </Text>
                      </>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* 1-Click Export Footer Action Bar */}
      <View style={[styles.exportFooter, { paddingBottom: 12 + insets.bottom }]}>
        <TouchableOpacity
          style={[styles.exportBtn, styles.excelBtn]}
          onPress={handleExportExcel}
          disabled={exportingExcel || !report || report.rows.length === 0}
          activeOpacity={0.8}
        >
          {exportingExcel ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <FileSpreadsheet size={16} color="#ffffff" />
          )}
          <Text style={styles.exportBtnText}>Export Excel (.xlsx)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtn, styles.pdfBtn]}
          onPress={handleExportPDF}
          disabled={exportingPdf || !report || report.rows.length === 0}
          activeOpacity={0.8}
        >
          {exportingPdf ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <FileText size={16} color="#ffffff" />
          )}
          <Text style={styles.exportBtnText}>Export PDF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (themeColors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.bg,
    },
    filterBar: {
      backgroundColor: themeColors.card,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.cardBorder,
      paddingVertical: 10,
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
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: themeColors.surfaceSubtle,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    chipActive: {
      backgroundColor: themeColors.brand[600],
      borderColor: themeColors.brand[600],
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
    chipTextActive: {
      color: '#ffffff',
      fontWeight: '700',
    },
    customRangeBar: {
      backgroundColor: themeColors.card,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.cardBorder,
      paddingHorizontal: 16,
      paddingVertical: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    customRangeDisplayText: {
      fontSize: 11,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    typeTabsWrapper: {
      backgroundColor: themeColors.card,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.cardBorder,
      paddingVertical: 8,
    },
    typeTabsScroll: {
      paddingHorizontal: 16,
      flexDirection: 'row',
      gap: 8,
    },
    typeTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: themeColors.surfaceSubtle,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    typeTabActive: {
      backgroundColor: themeColors.brand[600],
      borderColor: themeColors.brand[600],
    },
    typeTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
    typeTabTextActive: {
      color: '#ffffff',
      fontWeight: '700',
    },
    scrollContent: {
      padding: 16,
    },
    summaryCard: {
      backgroundColor: themeColors.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      marginBottom: 14,
    },
    summaryTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.textPrimary,
      marginBottom: 12,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    sumMetric: {
      width: '47%',
    },
    sumLabel: {
      fontSize: 11,
      color: themeColors.textMuted,
      fontWeight: '600',
    },
    sumValue: {
      fontSize: 18,
      fontWeight: '800',
      color: themeColors.textPrimary,
      marginTop: 2,
    },
    tableCard: {
      backgroundColor: themeColors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      overflow: 'hidden',
    },
    truncatedNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#f0f9ff',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.cardBorder,
    },
    truncatedText: {
      flex: 1,
      fontSize: 11,
      color: isDark ? '#38bdf8' : '#0369a1',
      fontWeight: '600',
      lineHeight: 15,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: themeColors.surfaceSubtle,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.cardBorder,
    },
    thText: {
      fontSize: 11,
      fontWeight: '700',
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
      paddingHorizontal: 6,
      width: 95,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? themeColors.cardBorder : themeColors.surfaceSubtle,
      alignItems: 'center',
    },
    tableRowZebra: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#fafafa',
    },
    tdText: {
      fontSize: 12,
      color: themeColors.textSecondary,
      paddingHorizontal: 6,
      width: 95,
    },
    tdBold: {
      fontWeight: '700',
      color: themeColors.textPrimary,
    },
    modeBadge: {
      backgroundColor: isDark ? 'rgba(225, 29, 72, 0.15)' : themeColors.brand[50],
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      alignItems: 'center',
    },
    modeBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: themeColors.brand[600],
    },
    loadingBox: {
      padding: 40,
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
    },
    exportFooter: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: themeColors.card,
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: themeColors.cardBorder,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 6,
    },
    exportBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
    },
    excelBtn: {
      backgroundColor: '#059669',
    },
    pdfBtn: {
      backgroundColor: themeColors.brand[600],
    },
    exportBtnText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
  });
