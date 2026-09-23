import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Category } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  Flame, 
  Clock, 
  Package, 
  Layers, 
  ArrowUpRight,
  Filter,
  Check,
  Search,
  Zap,
  Sparkles,
  ArrowRight,
  Send,
  Share2,
  CalendarDays,
  Activity,
  AlertCircle,
  Plus,
  Tag
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'YOY' | 'CATEGORY_BOOM' | 'CALENDAR'>('FINANCIAL');

  // Financial P&L Period State
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [report, setReport] = useState<any | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingSales, setExportingSales] = useState(false);
  const [exportingInv, setExportingInv] = useState(false);

  // Export Filters State
  const [salesExportPeriod, setSalesExportPeriod] = useState<string>('monthly');
  const [invExportCategory, setInvExportCategory] = useState<string>('');

  // YoY Comparison State
  const [yoyQuery, setYoyQuery] = useState<string>('Raincoat');
  const [yoyData, setYoyData] = useState<any | null>(null);
  const [loadingYoy, setLoadingYoy] = useState<boolean>(false);

  // Category Boom State
  const [categoryBoomData, setCategoryBoomData] = useState<any[]>([]);
  const [loadingBoom, setLoadingBoom] = useState<boolean>(false);

  // Festival & Event Calendar State
  const [selectedCalendarYear, setSelectedCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarData, setCalendarData] = useState<any | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(false);

  // Custom Festival Stock Lead Items State
  const [isAddFestivalItemModalOpen, setIsAddFestivalItemModalOpen] = useState(false);
  const [targetFestivalName, setTargetFestivalName] = useState<string>('');
  const [newFestItemName, setNewFestItemName] = useState<string>('');
  const [newFestItemScope, setNewFestItemScope] = useState<'THIS_YEAR' | 'ALL_YEARS'>('ALL_YEARS');
  const [isSubmittingFestItem, setIsSubmittingFestItem] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'FINANCIAL') {
      fetchReport();
    } else if (activeTab === 'YOY') {
      fetchYoyData(yoyQuery);
    } else if (activeTab === 'CATEGORY_BOOM') {
      fetchCategoryBoom();
    } else if (activeTab === 'CALENDAR') {
      fetchCalendarData(selectedCalendarYear);
    }
  }, [activeTab, period, selectedCalendarYear]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `/reports/sales-summary?period=${period}`;
      if (period === 'custom' && customStartDate) {
        url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
      }
      const res = await api.get(url);
      setReport(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchYoyData = async (queryText: string) => {
    if (!queryText.trim()) return;
    setLoadingYoy(true);
    try {
      const res = await api.get(`/reports/yoy-comparison?query=${encodeURIComponent(queryText.trim())}`);
      setYoyData(res.data);
    } catch (e) {
      console.error('Failed to fetch YoY data', e);
    } finally {
      setLoadingYoy(false);
    }
  };

  const fetchCategoryBoom = async () => {
    setLoadingBoom(true);
    try {
      const res = await api.get('/reports/category-boom');
      setCategoryBoomData(res.data);
    } catch (e) {
      console.error('Failed to fetch category boom data', e);
    } finally {
      setLoadingBoom(false);
    }
  };

  const fetchCalendarData = async (year: number) => {
    setLoadingCalendar(true);
    try {
      const res = await api.get(`/reports/seasonal-calendar?year=${year}`);
      setCalendarData(res.data);
    } catch (e) {
      console.error('Failed to fetch festival calendar data', e);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleOpenAddFestItem = (festivalName: string) => {
    setTargetFestivalName(festivalName);
    setNewFestItemName('');
    setNewFestItemScope('ALL_YEARS');
    setIsAddFestivalItemModalOpen(true);
  };

  const handleSaveCustomFestItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFestItemName.trim() || !targetFestivalName) return;
    setIsSubmittingFestItem(true);
    try {
      await api.post('/reports/festival-custom-item', {
        festival_name: targetFestivalName,
        item_name: newFestItemName.trim(),
        scope: newFestItemScope,
        year: selectedCalendarYear
      });
      setIsAddFestivalItemModalOpen(false);
      setNewFestItemName('');
      fetchCalendarData(selectedCalendarYear);
    } catch (err) {
      console.error('Failed to add custom festival item', err);
      alert('Failed to save festival item.');
    } finally {
      setIsSubmittingFestItem(false);
    }
  };

  const handleDeleteCustomFestItem = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/reports/festival-custom-item/${itemId}`);
      fetchCalendarData(selectedCalendarYear);
    } catch (err) {
      console.error('Failed to delete custom festival item', err);
      alert('Failed to delete item.');
    }
  };

  const handleExportSalesExcel = async () => {
    setExportingSales(true);
    try {
      let url = `/reports/export/sales-excel?period=${salesExportPeriod}`;
      if (period === 'custom' && customStartDate) {
        url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
      }
      const response = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `DollyToys_SalesReport_${salesExportPeriod}_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert('Failed to download Sales Excel report.');
    } finally {
      setExportingSales(false);
    }
  };

  const handleExportInventoryExcel = async () => {
    setExportingInv(true);
    try {
      let url = '/reports/export/inventory-excel';
      if (invExportCategory) {
        url += `?category_id=${invExportCategory}`;
      }
      const response = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `DollyToys_StockCatalog_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert('Failed to download Inventory Excel catalog.');
    } finally {
      setExportingInv(false);
    }
  };

  const deadStock = report?.dead_stock_summary?.dead_stock_products || report?.dead_stock || [];
  const totalTrapped = report?.dead_stock_summary?.total_trapped_capital ?? report?.dead_stock_trapped ?? 0;

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Top Header & Tab Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-pink-500" />
            Financial Intelligence, YoY Trends & Festival Calendar
          </h1>
          <p className="text-xs text-slate-500">
            P&L Audit • Custom Date Ranges • Raincoat & Festive YoY Growth • Category Boom Radar • Perpetual Indian Festival Planner.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold shadow-xs">
          {[
            { id: 'FINANCIAL', label: '📊 Financial P&L', icon: DollarSign },
            { id: 'YOY', label: '📈 YoY Sales Comparison', icon: TrendingUp },
            { id: 'CATEGORY_BOOM', label: '🚀 Category Boom Radar', icon: Flame },
            { id: 'CALENDAR', label: '🪔 Festival Event Calendar', icon: CalendarDays },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: FINANCIAL P&L SUMMARY (WITH CUSTOM RANGE) */}
      {activeTab === 'FINANCIAL' && (
        <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
          {/* Controls Bar: Periods + Custom Range Date Pickers + Excel Exports */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
            {/* Period Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[
                { id: 'daily', label: '⚡ Today' },
                { id: 'weekly', label: '📅 Last 7 Days' },
                { id: 'monthly', label: '📆 This Month (Sep)' },
                { id: 'yearly', label: '📊 This Year (2026)' },
                { id: 'custom', label: '🎯 Custom Range' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs ${
                    period === p.id
                      ? 'bg-pink-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers (Shown when Custom Range is active) */}
            {period === 'custom' && (
              <div className="flex items-center space-x-2 bg-pink-50/70 dark:bg-slate-800/80 p-1.5 rounded-xl border border-pink-200 dark:border-pink-900 animate-in fade-in">
                <span className="font-bold text-[11px] text-pink-700 dark:text-pink-300">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono"
                />
                <span className="font-bold text-[11px] text-pink-700 dark:text-pink-300">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono"
                />
                <button
                  onClick={fetchReport}
                  className="px-3 py-1 bg-pink-600 text-white font-bold rounded-lg text-xs hover:bg-pink-500 shadow-xs"
                >
                  Apply Range
                </button>
              </div>
            )}

            {/* Excel Download Group (Item 24: Week/Month/Year/All Presets) */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 border rounded-xl p-1 bg-slate-50 dark:bg-slate-800">
                <select
                  value={salesExportPeriod}
                  onChange={(e) => setSalesExportPeriod(e.target.value)}
                  className="bg-transparent border-0 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none pr-1"
                >
                  <option value="weekly">📅 This Week (7 Days)</option>
                  <option value="monthly">📆 This Month</option>
                  <option value="yearly">📊 This Year</option>
                  <option value="all">📁 All-Time Full Archive</option>
                  <option value="daily">⚡ Today Only</option>
                  {period === 'custom' && <option value="custom">🎯 Custom Date Range</option>}
                </select>
                <button
                  onClick={handleExportSalesExcel}
                  disabled={exportingSales}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center space-x-1 transition-all disabled:opacity-50 text-xs shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingSales ? 'Exporting...' : 'Export Sales Excel (.xlsx)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Financial KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 shrink-0">
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-0.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Gross Turnover</span>
              <div className="text-lg sm:text-xl font-black font-mono text-slate-800 dark:text-white">
                {formatINR(report?.total_sales ?? 0)}
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {report?.bill_count ?? 0} Bills • {report?.total_units_sold ?? 0} Sold
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 shadow-xs space-y-0.5">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">COGS (Wholesale Cost)</span>
              <div className="text-lg sm:text-xl font-black font-mono text-blue-600 dark:text-blue-400">
                {formatINR(report?.total_cogs ?? 0)}
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                Wholesale Cost of Sold Items
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs space-y-0.5">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Trading Gross Margin</span>
              <div className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatINR(report?.gross_profit ?? 0)}
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block truncate">
                Margin: {report?.gross_margin_percent ?? 0}%
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 shadow-xs space-y-0.5">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Operating Expenses</span>
              <div className="text-lg sm:text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                {formatINR(report?.expenses_total ?? 0)}
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                Rent, Staff, Bills & Misc
              </span>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 shadow-xs space-y-0.5">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Returns & Refunds</span>
              <div className="text-lg sm:text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                {formatINR(report?.total_refunds ?? 0)}
              </div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block truncate">
                {report?.refund_count ?? 0} Return Vouchers
              </span>
            </div>

            <div className="p-3.5 bg-gradient-to-tr from-pink-600 to-purple-600 text-white rounded-2xl shadow-md space-y-0.5">
              <span className="text-[11px] font-bold text-pink-200 uppercase tracking-wider block">Take-Home Net Profit</span>
              <div className="text-lg sm:text-xl font-black font-mono">
                {formatINR(report?.take_home_net_profit ?? 0)}
              </div>
              <span className="text-[10px] text-pink-100 block truncate">
                After COGS & Expenses
              </span>
            </div>
          </div>

          {/* Fast Moving & Dead Stock Row */}
          <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
            {/* Fast Movers */}
            <div className="col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col overflow-hidden">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" />
                Fast-Moving Velocity Products
              </h3>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {report?.fast_moving_products?.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">No sales recorded for this period</div>
                ) : (
                  report?.fast_moving_products?.map((p: any, idx: number) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-white block">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Barcode: {p.barcode}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-pink-600 block">{p.quantity_sold} pcs sold</span>
                        <span className="text-[10px] font-mono text-slate-500">{formatINR(p.revenue)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dead Stock Watchlist */}
            <div className="col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Dead Stock Watchlist (&gt;1 Year Unsold)
                </h3>
                <span className="text-[10px] font-bold text-rose-600 font-mono">
                  Trapped Capital: {formatINR(totalTrapped)}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {deadStock.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">Zero dead stock! Catalog moving efficiently.</div>
                ) : (
                  deadStock.slice(0, 15).map((d: any, idx: number) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-white block">{d.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {d.size ? `Size: ${d.size} • ` : ''}{d.stock_quantity} pcs in stock
                        </span>
                      </div>
                      <span className="font-bold font-mono text-rose-600">
                        {formatINR(d.trapped_capital ?? d.capital_trapped ?? (d.stock_quantity * d.purchase_price))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: YEAR-OVER-YEAR (YoY) SALES COMPARISON */}
      {activeTab === 'YOY' && (
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 flex flex-col space-y-4 overflow-hidden">
          {/* Search Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-pink-500" />
                Product & Season Year-over-Year (YoY) Comparison Engine
              </h2>
              <p className="text-xs text-slate-500">
                Compare sales of Raincoats, Holi outfits, Kurta sets, Toys or any item across 2026, 2025, and historical years.
              </p>
            </div>

            {/* Quick Keyword Pills */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="font-bold text-slate-400 text-[11px]">Quick Compare:</span>
              {['Raincoat', 'Holi', 'Kurta', 'Frock', 'Toy', 'Shoes', 'Diwali'].map((kw) => (
                <button
                  key={kw}
                  onClick={() => { setYoyQuery(kw); fetchYoyData(kw); }}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-pink-50 hover:text-pink-600 font-semibold text-[11px] transition-colors"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); fetchYoyData(yoyQuery); }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1 text-xs">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={yoyQuery}
                onChange={(e) => setYoyQuery(e.target.value)}
                placeholder="Search any product or seasonal keyword (e.g. Raincoat, Winter Jacket, Lehengas)..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono focus:outline-none focus:border-pink-500 font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={loadingYoy}
              className="px-5 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs shadow-md shadow-pink-600/30 transition-all active:scale-95"
            >
              {loadingYoy ? 'Comparing...' : 'Compare YoY'}
            </button>
          </form>

          {/* YoY Results Display */}
          {yoyData && (
            <div className="flex-1 overflow-y-auto space-y-4 text-xs">
              {/* Year Cards Comparison */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl border-2 border-pink-500 bg-pink-50/40 dark:bg-pink-950/20 shadow-xs">
                  <span className="text-[11px] font-black uppercase tracking-wider text-pink-600 block">
                    This Year ({yoyData.this_year.year})
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
                    {formatINR(yoyData.this_year.revenue)}
                  </div>
                  <span className="text-xs font-bold text-pink-700 dark:text-pink-300 mt-1 block">
                    {yoyData.this_year.units_sold} Units Sold ({yoyData.this_year.bill_count} Bills)
                  </span>
                </div>

                <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-800/60 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Last Year ({yoyData.last_year.year})
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-700 dark:text-slate-200 mt-1">
                    {formatINR(yoyData.last_year.revenue)}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {yoyData.last_year.units_sold} Units Sold ({yoyData.last_year.bill_count} Bills)
                  </span>
                </div>

                <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-800/60 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    2 Years Ago ({yoyData.two_years_ago.year})
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-700 dark:text-slate-200 mt-1">
                    {formatINR(yoyData.two_years_ago.revenue)}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {yoyData.two_years_ago.units_sold} Units Sold
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                    YoY Growth Velocity
                  </span>
                  <div className="text-2xl font-black font-mono">
                    {yoyData.yoy_growth_revenue_percent >= 0 ? `+${yoyData.yoy_growth_revenue_percent}%` : `${yoyData.yoy_growth_revenue_percent}%`} 🚀
                  </div>
                  <span className="text-[11px] text-emerald-100 font-bold">
                    Units Growth: {yoyData.yoy_growth_units_percent >= 0 ? `+${yoyData.yoy_growth_units_percent}%` : `${yoyData.yoy_growth_units_percent}%`}
                  </span>
                </div>
              </div>

              {/* Monthly Trend Bars */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">
                  Historical Monthly Velocity Breakdown (Past 12 Months)
                </h3>
                <div className="space-y-2">
                  {yoyData.monthly_trend?.length === 0 ? (
                    <div className="text-slate-400 py-6 text-center">No sales history found for keyword '{yoyQuery}'</div>
                  ) : (
                    yoyData.monthly_trend.map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="w-20 font-mono font-bold text-slate-600 dark:text-slate-300">{m.month}</span>
                        <div className="flex-1 mx-4 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-pink-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (m.revenue / Math.max(1, yoyData.this_year.revenue)) * 100)}%` }}
                          />
                        </div>
                        <span className="w-24 text-right font-bold text-slate-700 dark:text-slate-200">{m.units} pcs</span>
                        <span className="w-28 text-right font-mono font-black text-pink-600">{formatINR(m.revenue)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Size-by-Size Breakdown & Live Stock Matrix */}
              {yoyData.size_breakdown?.length > 0 && (
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-pink-500" />
                        Size-by-Size Velocity & Stock Breakdown
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Tracks exact units sold vs remaining inventory and defective pieces per size (S, M, L, XL...).
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 text-xs">
                      <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl">
                        ✓ In Stock: {yoyData.inventory_summary?.total_in_stock || 0} pcs
                      </span>
                      {yoyData.inventory_summary?.total_damaged_stock > 0 && (
                        <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl">
                          ⚠ Defective: {yoyData.inventory_summary.total_damaged_stock} pcs
                        </span>
                      )}
                      <span className="font-bold text-pink-600 bg-pink-50 dark:bg-pink-950/40 px-2.5 py-1 rounded-xl">
                        ★ Sold: {yoyData.inventory_summary?.total_sold_all_time || 0} pcs
                      </span>
                    </div>
                  </div>

                  {/* AI Smart Advice Banner */}
                  {yoyData.inventory_summary?.smart_advice && (
                    <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <span className="text-base">💡</span>
                      <span className="font-semibold">{yoyData.inventory_summary.smart_advice}</span>
                    </div>
                  )}

                  {/* Itemized Product Name & Variant Table */}
                  {yoyData.product_breakdown?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Itemized Products & Variants ({yoyData.product_breakdown.length} items found)</span>
                        <span className="text-[11px] text-slate-400 font-normal">Shows exact Product Name, Barcode, Size, Sold vs Leftover Stock</span>
                      </h4>

                      <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase sticky top-0 z-10 border-b">
                            <tr>
                              <th className="py-2 px-3">Product Name & Category</th>
                              <th className="py-2 px-2 text-center">Barcode</th>
                              <th className="py-2 px-2 text-center">Size</th>
                              <th className="py-2 px-2 text-center">Color</th>
                              <th className="py-2 px-2 text-right text-emerald-600 font-bold">Sold</th>
                              <th className="py-2 px-2 text-right text-amber-600 font-bold">In Stock</th>
                              <th className="py-2 px-2 text-right text-rose-600 font-bold">Defective</th>
                              <th className="py-2 px-2 text-right">Total Brought</th>
                              <th className="py-2 px-2 text-right font-mono">Revenue (₹)</th>
                              <th className="py-2 px-2 text-center">Sell %</th>
                              <th className="py-2 px-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {yoyData.product_breakdown.map((p: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="py-2 px-3">
                                  <span className="font-bold text-slate-800 dark:text-white block">{p.name}</span>
                                  <span className="text-[10px] text-slate-400">{p.category_name || 'General Category'}</span>
                                </td>
                                <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-500">
                                  {p.barcode}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[11px]">
                                    {p.size}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-center text-slate-500 text-[11px]">
                                  {p.color}
                                </td>
                                <td className="py-2 px-2 text-right font-bold text-emerald-600 font-mono">
                                  {p.sold_units} pcs
                                </td>
                                <td className="py-2 px-2 text-right font-bold text-amber-600 font-mono">
                                  {p.in_stock} pcs
                                </td>
                                <td className="py-2 px-2 text-right font-bold font-mono">
                                  {p.damaged_quantity > 0 ? (
                                    <span className="text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                                      {p.damaged_quantity} pcs
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600">0</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right font-mono font-semibold text-slate-600 dark:text-slate-300">
                                  {p.total_brought} pcs
                                </td>
                                <td className="py-2 px-2 text-right font-mono font-bold text-pink-600">
                                  {formatINR(p.sold_revenue)}
                                </td>
                                <td className="py-2 px-2 text-center font-mono font-bold text-[11px]">
                                  {p.sell_through_percent}%
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                                    p.status.includes('Best') 
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                                      : (p.status.includes('Steady') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300')
                                  }`}>
                                    {p.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CATEGORY BOOM & MOMENTUM RADAR */}
      {activeTab === 'CATEGORY_BOOM' && (
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 flex flex-col space-y-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Category Growth & Surge Momentum Radar
              </h2>
              <p className="text-xs text-slate-500">
                Identifies which retail categories are surging this month compared to previous periods for optimal stocking.
              </p>
            </div>
            <button
              onClick={fetchCategoryBoom}
              className="px-3 py-1.5 border rounded-xl text-xs font-bold hover:bg-slate-50"
            >
              Refresh Momentum
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-400 uppercase sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Category Name</th>
                  <th className="py-2.5 px-3 text-right">This Month Revenue</th>
                  <th className="py-2.5 px-3 text-center">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Last Month Revenue</th>
                  <th className="py-2.5 px-3 text-center">Growth Rate (%)</th>
                  <th className="py-2.5 px-3 text-center">Momentum Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadingBoom ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Analyzing category momentum...</td></tr>
                ) : categoryBoomData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <p className="font-semibold text-xs text-slate-500 dark:text-slate-400">No active category sales recorded for this period.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Start selling items to see live surge & boom momentum rankings!</p>
                    </td>
                  </tr>
                ) : categoryBoomData.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-pink-100 text-pink-700 font-black text-[10px] flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <span>{cat.category_name}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-pink-600">{formatINR(cat.this_month_revenue)}</td>
                    <td className="py-3 px-3 text-center font-mono font-semibold">{cat.this_month_units} pcs</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">{formatINR(cat.last_month_revenue)}</td>
                    <td className="py-3 px-3 text-center font-mono font-black text-sm">
                      <span className={cat.growth_percent >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {cat.growth_percent >= 0 ? `+${cat.growth_percent}%` : `${cat.growth_percent}%`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                        cat.momentum_status.includes('BOOM') ? 'bg-orange-100 text-orange-800 animate-pulse' :
                        cat.momentum_status.includes('GROWTH') ? 'bg-emerald-100 text-emerald-800' :
                        cat.momentum_status.includes('STEADY') ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {cat.momentum_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PERPETUAL INDIAN FESTIVAL & SEASONAL CALENDAR */}
      {activeTab === 'CALENDAR' && (
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 flex flex-col space-y-3 overflow-hidden">
          {/* Calendar Header with Year Selector */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-pink-500" />
                Perpetual Indian Festival & Seasonal Retail Planner
              </h2>
              <p className="text-xs text-slate-500">
                Diwali, Holi, Ganesh Chaturthi, Makar Sankranti, Eid, Back to School & Monsoon stocking countdowns.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500">Year:</span>
              
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setSelectedCalendarYear(prev => Math.max(2020, prev - 1))}
                  className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 shadow-xs"
                  title="Previous Year"
                >
                  ◀
                </button>

                {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setSelectedCalendarYear(yr)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedCalendarYear === yr
                        ? 'bg-pink-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {yr}
                  </button>
                ))}

                <button
                  onClick={() => setSelectedCalendarYear(prev => Math.min(2075, prev + 1))}
                  className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 shadow-xs"
                  title="Next Year (2033, 2034, 2035...)"
                >
                  ▶
                </button>
              </div>

              {/* Direct Year Dropdown for 2024-2060+ */}
              <select
                value={selectedCalendarYear}
                onChange={(e) => setSelectedCalendarYear(Number(e.target.value))}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-xl font-bold text-xs text-pink-600 focus:outline-none"
              >
                {Array.from({ length: 40 }, (_, i) => 2024 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Today's Active Festival Banner (If today matches a festival) */}
          {calendarData?.has_active_festival_today && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white shadow-md flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🎉</span>
                <div>
                  <h3 className="font-black text-sm">
                    Today is {calendarData.today_festivals.map((f: any) => f.name).join(', ')}!
                  </h3>
                  <p className="text-xs text-amber-100">Wishing you a high-sales day! Send 1-click WhatsApp festive greetings to your customers.</p>
                </div>
              </div>
              <a
                href="/customers"
                className="px-4 py-2 rounded-xl bg-white text-slate-900 font-bold text-xs shadow-sm hover:bg-amber-50"
              >
                Send Customer WhatsApp Wishes
              </a>
            </div>
          )}

          {/* Festival Cards Grid */}
          <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-3 pr-1">
            {calendarData?.festivals?.map((fest: any, idx: number) => (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-2 transition-all ${
                  fest.is_today
                    ? 'border-2 border-pink-500 bg-pink-50 dark:bg-pink-950/30 shadow-md'
                    : fest.is_upcoming
                    ? 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">{fest.icon}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      fest.is_today ? 'bg-pink-600 text-white animate-bounce' :
                      fest.is_upcoming ? 'bg-emerald-600 text-white font-bold' :
                      'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {fest.status_text}
                    </span>
                  </div>

                  <h4 className="font-black text-xs text-slate-900 dark:text-white">{fest.name}</h4>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono mt-0.5">
                    <span>Date: <strong>{fest.date}</strong></span>
                    <span>• {fest.season}</span>
                  </div>
                </div>

                {/* Recommended Stock & Custom Stock Lead Checklist */}
                <div className="space-y-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Stock Lead: {fest.stock_lead_days}d prior
                    </span>
                    <button
                      onClick={() => handleOpenAddFestItem(fest.name)}
                      className="text-[10px] font-bold text-pink-600 hover:text-pink-700 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md hover:bg-pink-50 dark:hover:bg-pink-950/40 border border-pink-200 dark:border-pink-900/50"
                      title="Add custom stock item for this festival"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {/* Default Recommended Stock */}
                    {fest.recommended_stock.map((item: string, i: number) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border text-slate-700 dark:text-slate-300 font-medium">
                        {item}
                      </span>
                    ))}

                    {/* Custom Store Owner Stock Lead Items */}
                    {fest.custom_stock?.map((cItem: any) => (
                      <span
                        key={cItem.id}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-pink-100 dark:bg-pink-950/80 border border-pink-300 dark:border-pink-800 text-pink-800 dark:text-pink-200 font-bold flex items-center gap-1 shadow-2xs"
                      >
                        <span>{cItem.item_name}</span>
                        <span className="text-[8px] font-mono opacity-80">
                          ({cItem.scope === 'ALL_YEARS' ? 'All Years' : `${cItem.year}`})
                        </span>
                        <button
                          onClick={(e) => handleDeleteCustomFestItem(cItem.id, e)}
                          className="hover:text-rose-600 text-pink-500 font-black ml-0.5 text-[10px] cursor-pointer"
                          title="Remove this custom item"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add Custom Festival Stock Lead */}
      {isAddFestivalItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-pink-500" />
                  Add Custom Stock Lead Item
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate max-w-xs">
                  For: <span className="font-bold text-pink-600">{targetFestivalName}</span>
                </p>
              </div>
              <button onClick={() => setIsAddFestivalItemModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-base">✕</button>
            </div>

            <form onSubmit={handleSaveCustomFestItem} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Item / Product to Stock *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Colourful Dhoti kurta, Light Dandiya Sets, Red Santa Frock"
                  value={newFestItemName}
                  onChange={(e) => setNewFestItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-pink-400 rounded-xl font-bold focus:outline-none focus:border-pink-600 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Scope / Duration *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewFestItemScope('THIS_YEAR')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newFestItemScope === 'THIS_YEAR'
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">📅</span>
                      <span className="font-bold">Only This Year ({selectedCalendarYear})</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Appears only in {selectedCalendarYear} calendar</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewFestItemScope('ALL_YEARS')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newFestItemScope === 'ALL_YEARS'
                        ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">♾️</span>
                      <span className="font-bold">All Years (Every Year)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Recurs annually for this festival</p>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddFestivalItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-slate-600 font-bold text-xs hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFestItem || !newFestItemName.trim()}
                  className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md shadow-pink-600/20 disabled:opacity-50"
                >
                  {isSubmittingFestItem ? 'Saving...' : 'Save Stock Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
