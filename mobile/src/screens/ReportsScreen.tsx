import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
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
} from 'lucide-react-native';
import { Header } from '../components/Header';
import { api } from '../services/api';
import { exportReportToExcel } from '../services/excelService';
import { exportReportToPDF } from '../services/pdfService';
import { ReportResponse } from '../types';
import { formatINR } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';

type ReportType = 'SALES' | 'PAYMENTS' | 'CATEGORIES' | 'EXPENSES' | 'DAMAGED' | 'PLANNER';
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

  const applyPreset = (preset: PresetPeriod) => {
    setPeriod(preset);
    const now = new Date();

    if (preset === 'TODAY') {
      const s = formatDateYMD(now);
      setStartDate(s);
      setEndDate(s);
      setShowCustomRange(false);
    } else if (preset === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const s = formatDateYMD(y);
      setStartDate(s);
      setEndDate(s);
      setShowCustomRange(false);
    } else if (preset === 'WEEK') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setStartDate(formatDateYMD(w));
      setEndDate(formatDateYMD(now));
      setShowCustomRange(false);
    } else if (preset === 'MONTH') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateYMD(m));
      setEndDate(formatDateYMD(now));
      setShowCustomRange(false);
    } else if (preset === 'YEAR') {
      const yr = new Date(now.getFullYear(), 0, 1);
      setStartDate(formatDateYMD(yr));
      setEndDate(formatDateYMD(now));
      setShowCustomRange(false);
    } else if (preset === 'CUSTOM') {
      setShowCustomRange(true);
    }
  };

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getReports(startDate, endDate, reportType);
      setReport(res);
    } catch (err: any) {
      console.warn('Failed to fetch reports:', err);
      Alert.alert('Error', err?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, reportType]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExportExcel = async () => {
    if (!report || report.rows.length === 0) {
      Alert.alert('No Data', 'No records found to export for the selected date range.');
      return;
    }
    setExportingExcel(true);
    try {
      await exportReportToExcel(report);
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
      await exportReportToPDF(report);
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
        subtitle={`${startDate} to ${endDate}`}
        onRefresh={fetchReports}
        isRefreshing={loading}
      />

      {/* Preset Range Filter Chips */}
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
            onPress={() => applyPreset('CUSTOM')}
          >
            <Calendar size={13} color={period === 'CUSTOM' ? '#ffffff' : colors.textSecondary} />
            <Text style={[styles.chipText, period === 'CUSTOM' && styles.chipTextActive]}>Custom</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Custom Date Inputs if Custom selected */}
      {showCustomRange && (
        <View style={styles.customDateBox}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>From (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.dateInput}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-09-01"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>To (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.dateInput}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-09-27"
            />
          </View>
          <TouchableOpacity style={styles.applyBtn} onPress={fetchReports}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 6 Report Type Selector Tabs (Horizontal Scrollable) */}
      <View style={styles.typeTabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeTabsScroll}>
          <TouchableOpacity
            style={[styles.typeTab, reportType === 'SALES' && styles.typeTabActive]}
            onPress={() => setReportType('SALES')}
          >
            <Receipt size={14} color={reportType === 'SALES' ? '#ffffff' : colors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'SALES' && styles.typeTabTextActive]}>
              Sales Register
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeTab, reportType === 'PAYMENTS' && styles.typeTabActive]}
            onPress={() => setReportType('PAYMENTS')}
          >
            <CreditCard size={14} color={reportType === 'PAYMENTS' ? '#ffffff' : colors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'PAYMENTS' && styles.typeTabTextActive]}>
              Payments
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeTab, reportType === 'CATEGORIES' && styles.typeTabActive]}
            onPress={() => setReportType('CATEGORIES')}
          >
            <Layers size={14} color={reportType === 'CATEGORIES' ? '#ffffff' : colors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'CATEGORIES' && styles.typeTabTextActive]}>
              Categories
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeTab, reportType === 'EXPENSES' && styles.typeTabActive]}
            onPress={() => setReportType('EXPENSES')}
          >
            <TrendingDown size={14} color={reportType === 'EXPENSES' ? '#ffffff' : colors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'EXPENSES' && styles.typeTabTextActive]}>
              Expenses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeTab, reportType === 'DAMAGED' && styles.typeTabActive]}
            onPress={() => setReportType('DAMAGED')}
          >
            <AlertTriangle size={14} color={reportType === 'DAMAGED' ? '#ffffff' : colors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'DAMAGED' && styles.typeTabTextActive]}>
              Damaged Goods
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeTab, reportType === 'PLANNER' && styles.typeTabActive]}
            onPress={() => setReportType('PLANNER')}
          >
            <PackageCheck size={14} color={reportType === 'PLANNER' ? '#ffffff' : colors.textSecondary} />
            <Text style={[styles.typeTabText, reportType === 'PLANNER' && styles.typeTabTextActive]}>
              Stock Planner
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}>
        {/* KPI Summary Card */}
        {report && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{report.title}</Text>

            <View style={styles.summaryGrid}>
              {reportType === 'SALES' && (
                <>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Net Sales</Text>
                    <Text style={[styles.sumValue, { color: colors.brand[600] }]}>
                      {formatINR(report.summary.total_net)}
                    </Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Total Bills</Text>
                    <Text style={styles.sumValue}>{report.summary.total_bills ?? 0}</Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Gross Sales</Text>
                    <Text style={styles.sumValue}>{formatINR(report.summary.total_gross)}</Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Total Discounts</Text>
                    <Text style={[styles.sumValue, { color: colors.danger }]}>
                      {formatINR(report.summary.total_discount)}
                    </Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Tax Collected</Text>
                    <Text style={styles.sumValue}>{formatINR(report.summary.total_tax)}</Text>
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
                    <Text style={styles.sumLabel}>Total Collections</Text>
                    <Text style={[styles.sumValue, { color: colors.brand[600] }]}>
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
                    <Text style={styles.sumLabel}>Total Categories</Text>
                    <Text style={styles.sumValue}>{report.summary.total_categories ?? 0}</Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Total Revenue</Text>
                    <Text style={[styles.sumValue, { color: colors.brand[600] }]}>
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
                    <Text style={[styles.sumValue, { color: colors.danger }]}>
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
                    <Text style={styles.sumLabel}>Total Units</Text>
                    <Text style={[styles.sumValue, { color: colors.warning }]}>
                      {report.summary.total_damaged_units ?? 0}
                    </Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Total Loss (Cost)</Text>
                    <Text style={[styles.sumValue, { color: colors.danger }]}>
                      {formatINR(report.summary.total_cost_loss)}
                    </Text>
                  </View>
                </>
              )}

              {reportType === 'PLANNER' && (
                <>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Critical Low Items</Text>
                    <Text style={[styles.sumValue, { color: colors.danger }]}>
                      {report.summary.critical_items_count ?? 0}
                    </Text>
                  </View>
                  <View style={styles.sumMetric}>
                    <Text style={styles.sumLabel}>Suggested Order Units</Text>
                    <Text style={[styles.sumValue, { color: colors.brand[600] }]}>
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
            <ActivityIndicator size="large" color={colors.brand[600]} />
            <Text style={styles.loadingText}>Generating report preview...</Text>
          </View>
        ) : !report || report.rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Filter size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptySub}>No transactions found for this date range.</Text>
          </View>
        ) : (
          <View style={styles.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  {report.columns.map((col, idx) => (
                    <Text key={idx} style={[styles.thText, idx === 0 && { width: 120 }]}>
                      {col}
                    </Text>
                  ))}
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
                            <Text style={{ fontSize: 10, color: colors.textMuted }}>{row.time}</Text>
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
                        <Text style={[styles.tdText, { width: 80, textAlign: 'right', color: colors.danger }]}>
                          -{formatINR(row.discount)}
                        </Text>
                        <Text style={[styles.tdText, { width: 75, textAlign: 'right' }]}>
                          {formatINR(row.tax)}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 105, textAlign: 'right', color: colors.textPrimary }]}>
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
                        <Text style={[styles.tdText, { width: 90, textAlign: 'right', color: colors.success, fontWeight: '700' }]}>
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
                        <Text style={[styles.tdText, { width: 90, textAlign: 'right', color: colors.success, fontWeight: '700' }]}>
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
                        <Text style={[styles.tdText, styles.tdBold, { width: 100, textAlign: 'right', color: colors.danger }]}>
                          {formatINR(row.amount)}
                        </Text>
                      </>
                    )}

                    {reportType === 'DAMAGED' && (
                      <>
                        <Text style={[styles.tdText, styles.tdBold, { width: 150 }]} numberOfLines={1}>
                          {row.product_name}
                        </Text>
                        <Text style={[styles.tdText, { width: 110, fontFamily: 'monospace' }]}>
                          {row.barcode}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 90, textAlign: 'center', color: colors.danger }]}>
                          {row.damaged_units}
                        </Text>
                        <Text style={[styles.tdText, { width: 90, textAlign: 'right' }]}>
                          {formatINR(row.cost_price)}
                        </Text>
                        <Text style={[styles.tdText, { width: 90, textAlign: 'right' }]}>
                          {formatINR(row.selling_price)}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 110, textAlign: 'right', color: colors.danger }]}>
                          {formatINR(row.total_cost_loss)}
                        </Text>
                      </>
                    )}

                    {reportType === 'PLANNER' && (
                      <>
                        <Text style={[styles.tdText, styles.tdBold, { width: 150 }]} numberOfLines={1}>
                          {row.product_name}
                        </Text>
                        <Text style={[styles.tdText, { width: 110, fontFamily: 'monospace' }]}>
                          {row.barcode}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 80, textAlign: 'center', color: colors.danger }]}>
                          {row.current_stock}
                        </Text>
                        <Text style={[styles.tdText, { width: 80, textAlign: 'center' }]}>
                          {row.min_alert}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 100, textAlign: 'center', color: colors.brand[600] }]}>
                          {row.suggested_order}
                        </Text>
                        <Text style={[styles.tdText, styles.tdBold, { width: 100, textAlign: 'right' }]}>
                          {formatINR(row.est_cost)}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  filterBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
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
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipActive: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  customDateBox: {
    backgroundColor: '#ffffff',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSubtle,
  },
  applyBtn: {
    backgroundColor: colors.brand[600],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  applyBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  typeTabsWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
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
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  typeTabActive: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  typeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
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
    color: colors.textMuted,
    fontWeight: '600',
  },
  sumValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    width: 95,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
    alignItems: 'center',
  },
  tableRowZebra: {
    backgroundColor: '#fafafa',
  },
  tdText: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: 6,
    width: 95,
  },
  tdBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modeBadge: {
    backgroundColor: colors.brand[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand[600],
  },
  loadingBox: {
    padding: 40,
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
  exportFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
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
    backgroundColor: '#059669', // Emerald Excel green
  },
  pdfBtn: {
    backgroundColor: colors.brand[600], // Dolly Rose PDF
  },
  exportBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
