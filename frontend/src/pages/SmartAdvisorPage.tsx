import React, { useEffect, useMemo } from 'react';
import { useAdvisorStore, AdvisorTab } from '../store/advisorStore';
import { 
  TrendingUp, 
  Package, 
  Users, 
  Calendar, 
  AlertTriangle, 
  ArrowUpRight, 
  Layers, 
  Zap, 
  BadgePercent,
  DollarSign,
  PieChart,
  Clock,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Award,
  Flame,
  RotateCw,
  Send,
  Sparkles,
  Boxes,
  ChevronDown,
  ChevronUp,
  FolderTree,
  Search,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const SmartAdvisorPage: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    deadStockDays,
    setDeadStockDays,
    deadStock,
    deadStockSummary,
    customerSegments,
    pricingSuggestions,
    categoryMatrix,
    categoryStockData,
    seasonalAdvisory,
    loading,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    selectedSubcategoryFilter,
    setSelectedSubcategoryFilter,
    productSearchQuery,
    setProductSearchQuery,
    sortColumn,
    sortDirection,
    handleSortToggle,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    fetchData
  } = useAdvisorStore();

  useEffect(() => {
    fetchData(activeTab, false);
  }, [activeTab, deadStockDays]);

  const handleCategorySelect = (catId: number | 'ALL') => {
    setSelectedCategoryFilter(catId);
  };

  // Selected Category Object
  const currentCategoryObj = useMemo(() => {
    if (selectedCategoryFilter === 'ALL' || !categoryStockData?.categories) return null;
    return categoryStockData.categories.find((c: any) => c.category_id === selectedCategoryFilter) || null;
  }, [selectedCategoryFilter, categoryStockData]);

  // Subcategories for current selection
  const currentSubcategories = useMemo(() => {
    if (!currentCategoryObj) return [];
    return currentCategoryObj.subcategories || [];
  }, [currentCategoryObj]);

  // Base Products List before subcategory / search / sort
  const rawProductsList = useMemo(() => {
    if (!categoryStockData?.categories) return [];
    if (selectedCategoryFilter === 'ALL') {
      return categoryStockData.categories.flatMap((c: any) => c.products || []);
    }
    return currentCategoryObj?.products || [];
  }, [selectedCategoryFilter, currentCategoryObj, categoryStockData]);

  // Filtered & Sorted Products
  const processedProducts = useMemo(() => {
    let list = [...rawProductsList];

    // Filter by Subcategory
    if (selectedSubcategoryFilter !== 'ALL') {
      list = list.filter((p: any) => p.subcategory_id === selectedSubcategoryFilter);
    }

    // Filter by Search Query
    if (productSearchQuery.trim()) {
      const q = productSearchQuery.toLowerCase().trim();
      list = list.filter((p: any) => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.size && p.size.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q)) ||
        (p.subcategory_name && p.subcategory_name.toLowerCase().includes(q))
      );
    }

    // Sort
    list.sort((a: any, b: any) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [rawProductsList, selectedSubcategoryFilter, productSearchQuery, sortColumn, sortDirection]);

  // Summary Metrics of the Filtered View
  const viewMetrics = useMemo(() => {
    const total_products = processedProducts.length;
    const total_active_qty = processedProducts.reduce((acc: number, p: any) => acc + (p.stock_quantity || 0), 0);
    const total_damaged_qty = processedProducts.reduce((acc: number, p: any) => acc + (p.damaged_quantity || 0), 0);
    const total_damaged_val = processedProducts.reduce((acc: number, p: any) => acc + (p.damaged_value || ((p.damaged_quantity || 0) * (p.purchase_price || 0))), 0);
    const total_cost = processedProducts.reduce((acc: number, p: any) => acc + (p.total_cost || ((p.stock_quantity || 0) * (p.purchase_price || 0))), 0);
    const total_retail = processedProducts.reduce((acc: number, p: any) => acc + (p.total_retail || ((p.stock_quantity || 0) * (p.selling_price || 0))), 0);
    const margin_pct = total_retail > 0 ? Math.round(((total_retail - total_cost) / total_retail) * 1000) / 10 : 0;

    return {
      total_products,
      total_active_qty,
      total_damaged_qty,
      total_damaged_val,
      total_cost,
      total_retail,
      margin_pct
    };
  }, [processedProducts]);

  // Fast pagination calculation - only renders current page slice in DOM for instant 60fps rendering
  const totalPages = Math.max(1, Math.ceil(processedProducts.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return processedProducts.slice(start, start + pageSize);
  }, [processedProducts, validCurrentPage, pageSize]);

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-pink-500" />
            Smart Retail Advisor & Growth Decision Engine
          </h1>
          <p className="text-xs text-slate-500">
            Automated retail audits: Trapped Working Capital, Pricing Optimization, Customer VIP Segments, and Category Margins.
          </p>
        </div>

        <button
          onClick={() => fetchData(activeTab, true)}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold hover:text-pink-600 flex items-center gap-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-60"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-pink-500' : ''}`} />
          <span>{loading ? 'Analyzing...' : 'Refresh Audit'}</span>
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit text-xs font-bold overflow-x-auto max-w-full">
        {[
          { id: 'DEADSTOCK', label: '⚠️ Dead Stock & Trapped Capital', icon: AlertTriangle },
          { id: 'PRICING', label: '🏷️ Margin & Pricing Health', icon: DollarSign },
          { id: 'CUSTOMERS', label: '👥 Customer VIP & Retention Cohorts', icon: Users },
          { id: 'CATEGORIES', label: '📊 Category Profitability Matrix', icon: PieChart },
          { id: 'SEASONAL', label: '🎉 Seasonal Demand Guide', icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col p-4 relative">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center space-y-4 py-16 animate-in fade-in duration-300">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border-4 border-pink-200 dark:border-pink-900/40 border-t-pink-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-pink-500 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                Generating Smart Retail Intelligence...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auditing inventory, profit margins, sales velocity & customer patterns
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* TAB 1: DEAD STOCK RECOVERY */}
        {activeTab === 'DEADSTOCK' && (
          <div className="h-full flex flex-col space-y-3 overflow-y-auto">
            {/* Timeline Filter Pills Bar */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-pink-500" />
                  Filter Unsold Duration:
                </span>
                {[
                  { label: '3 Months', days: 90 },
                  { label: '6 Months', days: 180 },
                  { label: '1 Year (Default)', days: 365 },
                  { label: '3 Years', days: 1095 },
                  { label: '5 Years', days: 1800 },
                ].map((item) => (
                  <button
                    key={item.days}
                    onClick={() => setDeadStockDays(item.days)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                      deadStockDays === item.days
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-mono text-slate-400">
                {deadStockSummary?.total_products_count ? `${deadStockSummary.total_products_count} Total Products in DB` : ''}
              </div>
            </div>

            {(() => {
              const totalDeadStockValue = deadStockSummary?.total_trapped_capital ?? deadStock.reduce((acc, p) => acc + ((p.stock_quantity || 0) * (p.purchase_price || (p.selling_price ? p.selling_price * 0.7 : 0))), 0);
              const totalDeadUnits = deadStockSummary?.total_idle_units ?? deadStock.reduce((acc, p) => acc + (p.stock_quantity || 0), 0);
              const totalItemsCount = deadStockSummary?.total_products_count ?? deadStock.length;
              const filterLabel = deadStockDays >= 365 
                ? `${Math.round(deadStockDays / 365)} Year${deadStockDays > 365 ? 's' : ''}` 
                : `${Math.round(deadStockDays / 30)} Months`;

              return (
                <div className="flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/40">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                      <span>Dead Stocks & Trapped Working Capital Liquidation</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 font-mono font-black text-xs">
                        {formatINR(totalDeadStockValue)}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {totalItemsCount} stagnant product lines ({totalDeadUnits} total idle units) with zero sales in {filterLabel}+.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Trapped Capital ({filterLabel}+)</span>
                    <span className="text-base font-black font-mono text-rose-600">{formatINR(totalDeadStockValue)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              {deadStock.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  ✓ Excellent inventory turnover! No dead stock detected.
                </div>
              ) : (
                deadStock.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/40 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800 dark:text-white block">{p.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Size: {p.size || 'N/A'} • Barcode: {p.barcode} • Selling: {formatINR(p.selling_price)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Idle Stock</span>
                        <span className="font-bold text-amber-600 font-mono">{p.stock_quantity} pcs</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Trapped Cost</span>
                        <span className="font-bold text-rose-600 font-mono">
                          {formatINR((p.stock_quantity || 0) * (p.purchase_price || (p.selling_price ? p.selling_price * 0.7 : 0)))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PRICE & MARGIN OPTIMIZATION */}
        {activeTab === 'PRICING' && (
          <div className="h-full flex flex-col space-y-3 overflow-y-auto">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                Margin Optimization & Smart Price Recommendations
              </h3>
              <p className="text-xs text-slate-500">
                Algorithmically identified products with high demand or low margins where a 5–10% adjustment can lift net profit.
              </p>
            </div>

            <div className="space-y-2">
              {pricingSuggestions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  ✓ All active product margins are well-calibrated.
                </div>
              ) : (
                pricingSuggestions.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-800/40 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800 dark:text-white block">{item.name}</span>
                      <span className="text-[11px] text-slate-500">{item.reason}</span>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Current Price</span>
                        <span className="font-bold font-mono">{formatINR(item.current_price)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Suggested Price</span>
                        <span className="text-emerald-600 font-black font-mono text-sm">
                          {formatINR(item.recommended_price)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CUSTOMER SEGMENTS & RETENTION */}
        {activeTab === 'CUSTOMERS' && (
          <div className="h-full flex flex-col space-y-4 overflow-y-auto">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                RFM Customer Segmentation & High-Value Retention
              </h3>
              <p className="text-xs text-slate-500">
                Segment your shoppers into VIP Champions, At-Risk Customers, and Active Khata accounts.
              </p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl border bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1">
                <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300 block">🏆 VIP Champions</span>
                <div className="text-2xl font-black font-mono text-emerald-600">
                  {customerSegments?.counts?.champions || customerSegments?.vip_count || 0}
                </div>
                <p className="text-[11px] text-slate-500">Top spenders with high repeat visit rates.</p>
              </div>

              <div className="p-3.5 rounded-2xl border bg-amber-50/40 dark:bg-amber-950/20 space-y-1">
                <span className="font-bold text-xs text-amber-800 dark:text-amber-300 block">⚠️ At-Risk Inactive</span>
                <div className="text-2xl font-black font-mono text-amber-600">
                  {customerSegments?.counts?.at_risk || customerSegments?.at_risk_count || 0}
                </div>
                <p className="text-[11px] text-slate-500">No purchases in 30+ days. Ideal for WhatsApp greetings.</p>
              </div>

              <div className="p-3.5 rounded-2xl border bg-purple-50/40 dark:bg-purple-950/20 space-y-1">
                <span className="font-bold text-xs text-purple-800 dark:text-purple-300 block">💳 Credit Khata Active</span>
                <div className="text-2xl font-black font-mono text-purple-600">
                  {customerSegments?.counts?.khata_due || customerSegments?.khata_active_count || 0}
                </div>
                <p className="text-[11px] text-slate-500">Customers with outstanding running balance.</p>
              </div>
            </div>

            {/* Cohort Customer Table - Scrollable Container */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span>Top High-Value VIP Customers</span>
                <span className="text-[11px] text-slate-400">Scrollable list ({customerSegments?.champions?.length || 0} customers)</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-xs">
                    <tr>
                      <th className="py-2 px-3">Customer Name</th>
                      <th className="py-2 px-2 text-center">Mobile</th>
                      <th className="py-2 px-2 text-center">Visit Count</th>
                      <th className="py-2 px-2 text-right">Lifetime Spend</th>
                      <th className="py-2 px-2 text-right">Khata Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {(customerSegments?.champions || []).map((c: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-white">
                          {c.name}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-500">
                          {c.phone}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold">
                          {c.visit_count}x
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-black text-emerald-600">
                          {formatINR(c.total_spend)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-rose-600">
                          {c.credit_balance > 0 ? formatINR(c.credit_balance) : '✓ Paid'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CATEGORY PROFITABILITY MATRIX & STOCK VALUATION */}
        {activeTab === 'CATEGORIES' && (
          <div className="h-full flex flex-col space-y-3.5 overflow-y-auto pr-1">
            {/* Header & Category Filter Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-50/80 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-pink-500" />
                  <span>Category-Wise Stock Analytics & Interactive Drill-Down</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Select any category below to view Active Stock, Damaged Loss, Capital at Cost, Retail Value, Subcategories, and full SKU tables.
                </p>
              </div>

              {/* Category Dropdown Selector */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Category:</span>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => handleCategorySelect(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-pink-500 shadow-xs"
                >
                  <option value="ALL">🌟 All Categories ({categoryStockData?.categories?.length || 0})</option>
                  {(categoryStockData?.categories || []).map((cat: any) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name} ({cat.product_count} SKUs • {cat.active_stock_qty} pcs)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category Filter Pills Bar */}
            {categoryStockData?.categories && categoryStockData.categories.length > 0 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => handleCategorySelect('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
                    selectedCategoryFilter === 'ALL'
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-pink-600'
                  }`}
                >
                  <span>All Categories</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    selectedCategoryFilter === 'ALL' ? 'bg-pink-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {categoryStockData.categories.length}
                  </span>
                </button>

                {categoryStockData.categories.map((c: any) => (
                  <button
                    key={c.category_id}
                    onClick={() => handleCategorySelect(c.category_id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
                      selectedCategoryFilter === c.category_id
                        ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30 ring-2 ring-pink-400'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-pink-600'
                    }`}
                  >
                    <span>{c.category_name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      selectedCategoryFilter === c.category_id ? 'bg-pink-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {c.active_stock_qty} pcs
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* 5 SUMMARY METRIC CARDS FOR CURRENT SELECTION */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 text-xs">
              <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-800/80 dark:to-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Products (SKUs)
                </span>
                <div className="text-xl font-black font-mono text-slate-800 dark:text-white">
                  {viewMetrics.total_products} <span className="text-xs font-normal text-slate-400">items</span>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  {selectedCategoryFilter === 'ALL' ? 'Across all departments' : `in ${currentCategoryObj?.category_name || 'Category'}`}
                </span>
              </div>

              <div className="p-3 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/30 dark:to-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                  Active Stock Units
                </span>
                <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {viewMetrics.total_active_qty} <span className="text-xs font-normal text-slate-500">pcs</span>
                </div>
                <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70 block">
                  Ready for customer billing
                </span>
              </div>

              <div className="p-3 bg-gradient-to-br from-rose-50/50 to-rose-100/30 dark:from-rose-950/30 dark:to-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/40 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
                  Damaged Stock & Loss
                </span>
                <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                  {viewMetrics.total_damaged_qty} <span className="text-xs font-normal text-slate-500">pcs</span>
                </div>
                <span className="text-[10px] font-bold font-mono text-rose-500 block">
                  {viewMetrics.total_damaged_val > 0 ? `-${formatINR(viewMetrics.total_damaged_val)} loss` : '✓ 0.00 Loss'}
                </span>
              </div>

              <div className="p-3 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/30 dark:to-slate-900 rounded-2xl border border-blue-200 dark:border-blue-900/40 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
                  Total Cost (Capital Held)
                </span>
                <div className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
                  {formatINR(viewMetrics.total_cost)}
                </div>
                <span className="text-[10px] text-blue-600/80 dark:text-blue-400/70 block">
                  Purchase cost valuation
                </span>
              </div>

              <div className="p-3 bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/30 dark:to-slate-900 rounded-2xl border border-purple-200 dark:border-purple-900/40 space-y-1 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 block">
                  Total Retail Value
                </span>
                <div className="text-xl font-black font-mono text-purple-600 dark:text-purple-400">
                  {formatINR(viewMetrics.total_retail)}
                </div>
                <span className="text-[10px] font-bold font-mono text-purple-500 block">
                  {viewMetrics.margin_pct}% Potential Margin
                </span>
              </div>
            </div>

            {/* SUBCATEGORY FILTER CHIPS (Visible if a category is selected and has subcategories) */}
            {selectedCategoryFilter !== 'ALL' && currentSubcategories.length > 0 && (
              <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5 text-pink-500" />
                    Subcategory Filter Drill-Down ({currentCategoryObj?.category_name}):
                  </span>
                  {selectedSubcategoryFilter !== 'ALL' && (
                    <button
                      onClick={() => setSelectedSubcategoryFilter('ALL')}
                      className="text-[11px] text-pink-600 hover:underline flex items-center gap-1 font-bold"
                    >
                      <X className="w-3 h-3" /> Clear Subcategory Filter
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedSubcategoryFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      selectedSubcategoryFilter === 'ALL'
                        ? 'bg-pink-600 text-white shadow-md shadow-pink-600/20'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-pink-300'
                    }`}
                  >
                    <span>All Subcategories</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      selectedSubcategoryFilter === 'ALL' ? 'bg-pink-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {rawProductsList.length} SKUs
                    </span>
                  </button>

                  {currentSubcategories.map((sc: any) => {
                    const isSelected = selectedSubcategoryFilter === sc.id;
                    return (
                      <button
                        key={sc.id}
                        onClick={() => setSelectedSubcategoryFilter(isSelected ? 'ALL' : sc.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                          isSelected
                            ? 'bg-pink-600 text-white shadow-md shadow-pink-600/20 ring-2 ring-pink-400'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-pink-400'
                        }`}
                      >
                        <span>{sc.name}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          isSelected ? 'bg-pink-700 text-white' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 font-bold'
                        }`}>
                          {sc.active_stock_qty} pcs
                        </span>
                        <span className={`text-[10px] font-mono ${isSelected ? 'text-pink-200' : 'text-slate-400'}`}>
                          {formatINR(sc.total_capital_held)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PRODUCT SEARCH & SORT CONTROLS BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center space-x-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search product name, barcode, size, color..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-hidden focus:ring-2 focus:ring-pink-500"
                  />
                  {productSearchQuery && (
                    <button
                      onClick={() => setProductSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
                <span>Showing <strong className="text-slate-800 dark:text-white font-mono">{processedProducts.length}</strong> items</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span>Sorted by: <strong className="text-pink-600 font-bold capitalize">{sortColumn.replace('_', ' ')}</strong> ({sortDirection.toUpperCase()})</span>
              </div>
            </div>

            {/* INTERACTIVE PRODUCT TABLE WITH ALL REQUIRED COLUMNS */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs flex flex-col">
              <div className="max-h-[460px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-xs">
                    <tr>
                      <th 
                        onClick={() => handleSortToggle('name')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Product Name</span>
                          {sortColumn === 'name' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-500" /> : <ArrowDown className="w-3 h-3 text-pink-500" />) : <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSortToggle('barcode')}
                        className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Barcode</span>
                          {sortColumn === 'barcode' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-500" /> : <ArrowDown className="w-3 h-3 text-pink-500" />)}
                        </div>
                      </th>
                      <th className="py-2.5 px-2 text-center">Subcategory</th>
                      <th className="py-2.5 px-2 text-center">Size / Color</th>
                      <th 
                        onClick={() => handleSortToggle('stock_quantity')}
                        className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Active Stock</span>
                          {sortColumn === 'stock_quantity' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-500" /> : <ArrowDown className="w-3 h-3 text-pink-500" />) : <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSortToggle('damaged_quantity')}
                        className="py-2.5 px-2 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Damaged & Loss ₹</span>
                          {sortColumn === 'damaged_quantity' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-500" /> : <ArrowDown className="w-3 h-3 text-pink-500" />) : <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSortToggle('purchase_price')}
                        className="py-2.5 px-2 text-right cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Cost Price & Total</span>
                          {sortColumn === 'purchase_price' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-500" /> : <ArrowDown className="w-3 h-3 text-pink-500" />) : <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSortToggle('selling_price')}
                        className="py-2.5 px-2 text-right cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Selling Price & Total</span>
                          {sortColumn === 'selling_price' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-500" /> : <ArrowDown className="w-3 h-3 text-pink-500" />) : <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSortToggle('margin_percent')}
                        className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Margin %</span>
                          {sortColumn === 'margin_percent' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-pink-500" /> : <ArrowDown className="w-3 h-3 text-pink-500" />) : <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium bg-white dark:bg-slate-900">
                    {paginatedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                          No products found matching your active filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedProducts.map((p: any) => {
                        const totalCostVal = p.total_cost ?? (p.stock_quantity * p.purchase_price);
                        const totalRetailVal = p.total_retail ?? (p.stock_quantity * p.selling_price);
                        const marginPct = p.margin_percent ?? (p.selling_price > 0 ? Math.round(((p.selling_price - p.purchase_price) / p.selling_price) * 1000) / 10 : 0);
                        const damagedVal = p.damaged_value ?? (p.damaged_quantity * p.purchase_price);

                        return (
                          <tr key={p.id} className="hover:bg-pink-50/40 dark:hover:bg-slate-800/50 transition-colors text-[11px]">
                            <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-white max-w-xs truncate">
                              <span title={p.name}>{p.name}</span>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[10px]">
                              {p.barcode}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                {p.subcategory_name || 'General'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-500">
                              {p.size || '—'} {p.color ? `/ ${p.color}` : ''}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-600">
                              {p.stock_quantity} pcs
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono">
                              {p.damaged_quantity > 0 ? (
                                <span className="font-bold text-rose-600">
                                  {p.damaged_quantity} pcs <span className="text-[10px] font-normal text-rose-500">(-{formatINR(damagedVal)})</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">
                              <span className="text-slate-600 dark:text-slate-300 block">{formatINR(p.purchase_price)}</span>
                              <span className="text-[10px] text-blue-600 font-bold block">{formatINR(totalCostVal)}</span>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">
                              <span className="font-bold text-slate-900 dark:text-white block">{formatINR(p.selling_price)}</span>
                              <span className="text-[10px] text-purple-600 font-bold block">{formatINR(totalRetailVal)}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                                marginPct >= 45
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : (marginPct >= 25 ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-amber-100 text-amber-800')
                              }`}>
                                {marginPct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION CONTROLS BAR */}
              {processedProducts.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 text-xs select-none">
                  <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
                    <span>
                      Showing <strong className="text-slate-800 dark:text-white font-mono">{((validCurrentPage - 1) * pageSize) + 1}</strong> to <strong className="text-slate-800 dark:text-white font-mono">{Math.min(validCurrentPage * pageSize, processedProducts.length)}</strong> of <strong className="text-pink-600 font-mono font-bold">{processedProducts.length}</strong> products
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Rows per page Selector */}
                    <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                      <span>Rows:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 outline-hidden"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                      </select>
                    </div>

                    {/* Page Navigation Buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={validCurrentPage <= 1}
                        title="First Page"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-30 hover:text-pink-600 disabled:hover:text-inherit transition-colors"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(validCurrentPage - 1)}
                        disabled={validCurrentPage <= 1}
                        title="Previous Page"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-30 hover:text-pink-600 disabled:hover:text-inherit transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-bold">
                        {validCurrentPage} / {totalPages}
                      </span>

                      <button
                        onClick={() => setCurrentPage(validCurrentPage + 1)}
                        disabled={validCurrentPage >= totalPages}
                        title="Next Page"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-30 hover:text-pink-600 disabled:hover:text-inherit transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={validCurrentPage >= totalPages}
                        title="Last Page"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-30 hover:text-pink-600 disabled:hover:text-inherit transition-colors"
                      >
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CATEGORY SALES REVENUE & MARGIN MATRIX TABLE */}
            <div className="space-y-2 pt-2">
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-pink-500" />
                Category Sales Revenue & Margin Performance Matrix
              </h4>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase border-b">
                    <tr>
                      <th className="py-2.5 px-3">Category Name</th>
                      <th className="py-2.5 px-2 text-center">Catalog SKUs</th>
                      <th className="py-2.5 px-2 text-center">Stock Units</th>
                      <th className="py-2.5 px-2 text-right">Stock Valuation</th>
                      <th className="py-2.5 px-2 text-right">Revenue Sold</th>
                      <th className="py-2.5 px-2 text-right">Gross Margin %</th>
                      <th className="py-2.5 px-2 text-center">Health Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {categoryMatrix.map((cat, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => handleCategorySelect(cat.category_id)}
                        className="hover:bg-pink-50/40 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                          <FolderTree className="w-3.5 h-3.5 text-pink-500" />
                          <span>{cat.category_name}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-500">
                          {cat.product_count}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold">
                          {cat.total_stock_units} pcs
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatINR(cat.stock_valuation)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatINR(cat.revenue)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-black text-emerald-600">
                          {cat.margin_percent}%
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            cat.margin_percent >= 45
                              ? 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300'
                              : (cat.margin_percent >= 25 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800')
                          }`}>
                            {cat.margin_percent >= 45 ? '💎 50% Impulse Zone' : (cat.margin_percent >= 25 ? '⚡ 30% Volume Zone' : '⚠️ Low Margin Alert')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* STICKY GRAND TOTAL INVENTORY VALUATION BAR */}
            {categoryStockData?.grand_total && (
              <div className="sticky bottom-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 flex items-center justify-between text-xs z-10 mt-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-pink-600 text-white flex items-center justify-center font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block">
                      Grand Total Inventory Valuation
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {categoryStockData.grand_total.total_products_count} Total Catalog SKUs across all departments
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Active Units</span>
                    <span className="font-mono font-black text-emerald-400 text-sm">
                      {categoryStockData.grand_total.total_active_stock_units} pcs
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Damaged Units</span>
                    <span className="font-mono font-bold text-rose-400 text-sm">
                      {categoryStockData.grand_total.total_damaged_stock_units} pcs
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Capital Held (Cost)</span>
                    <span className="font-mono font-black text-amber-400 text-sm">
                      {formatINR(categoryStockData.grand_total.total_capital_held)}
                    </span>
                  </div>

                  <div className="border-l border-slate-700 pl-4">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Retail Valuation</span>
                    <span className="font-mono font-black text-cyan-300 text-base">
                      {formatINR(categoryStockData.grand_total.total_retail_valuation)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SEASONAL DEMAND GUIDE */}
        {activeTab === 'SEASONAL' && (
          <div className="h-full flex flex-col space-y-4 overflow-y-auto">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                Upcoming Festival & Seasonal Demand Guide
              </h3>
              <p className="text-xs text-slate-500">
                Recommended wholesale buying timelines and high-demand product categories for major retail festivals.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-gradient-to-tr from-pink-500/10 to-rose-500/10 border border-pink-200 dark:border-pink-900/40 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-pink-600 block">🪔 Diwali Festival of Lights</span>
                <div className="text-base font-bold text-slate-800 dark:text-white">Ethnic Kurtas, Party Frocks, Light Toys & Gifts</div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Peak demand surges 40–60%. Begin wholesale buying 4–6 weeks ahead to ensure full size availability across all age groups.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-tr from-cyan-500/10 to-blue-500/10 border border-cyan-200 dark:border-cyan-900/40 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 block">🌧️ Monsoon Rainwear</span>
                <div className="text-base font-bold text-slate-800 dark:text-white">Sizes S-XL Raincoats, Umbrellas & Gumboots</div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Stock cartoon character raincoats (Frozen, Spider-Man, Peppa Pig) which command 50%+ profit margins.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-tr from-amber-500/10 to-orange-500/10 border border-amber-200 dark:border-amber-900/40 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 block">🎨 Holi Summer Special</span>
                <div className="text-base font-bold text-slate-800 dark:text-white">Pichkaris, Water Balloons, White Cotton T-Shirts</div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  High turnover fast-sale category. Clear stock before festival day to prevent capital lockup until next season.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 border border-indigo-200 dark:border-indigo-900/40 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 block">❄️ Winter Wear Season</span>
                <div className="text-base font-bold text-slate-800 dark:text-white">Jackets, Hoodies, Thermal Inners, Caps & Gloves</div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  High basket value item. Customers buy multi-piece sets (Cap + Gloves + Jacket) offering great upsell opportunities.
                </p>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};
