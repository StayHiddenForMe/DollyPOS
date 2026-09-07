import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  ClipboardList, 
  Truck, 
  UserX, 
  Calendar, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Phone, 
  ShoppingBag, 
  ArrowUpRight, 
  Clock, 
  RotateCw,
  Trash2,
  Check,
  Tag,
  Printer,
  FileText,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const ProcurementPlannerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'LOW_STOCK' | 'LOST_DEMAND' | 'SEASONAL'>('LOW_STOCK');
  const [lowStockData, setLowStockData] = useState<any>(null);
  const [lostDemandList, setLostDemandList] = useState<any[]>([]);
  const [seasonalChecklist, setSeasonalChecklist] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter & Sorting for Low Stock Sheet
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'CRITICAL' | 'BUDGET' | 'QTY' | 'NAME'>('CRITICAL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Lost Demand Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [itemDesc, setItemDesc] = useState('');
  const [categoryName, setCategoryName] = useState('Kids Wear');
  const [preferredSize, setPreferredSize] = useState('');
  const [preferredColor, setPreferredColor] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [urgency, setUrgency] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [notes, setNotes] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Close Log Lost Demand modal on Escape key
  useEffect(() => {
    if (!isLogModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsLogModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLogModalOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'LOW_STOCK') {
        const res = await api.get('/procurement/low-stock-sheet');
        setLowStockData(res.data);
      } else if (activeTab === 'LOST_DEMAND') {
        const res = await api.get('/procurement/lost-demand');
        setLostDemandList(res.data);
      } else if (activeTab === 'SEASONAL') {
        const res = await api.get('/procurement/seasonal-checklist');
        setSeasonalChecklist(res.data.seasonal_events || []);
      }
    } catch (e) {
      console.error('Failed to load procurement data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLostDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDesc.trim()) return;

    setSubmittingLog(true);
    try {
      await api.post('/procurement/lost-demand', {
        item_description: itemDesc.trim(),
        category_name: categoryName,
        preferred_size: preferredSize || undefined,
        preferred_color: preferredColor || undefined,
        customer_name: custName || undefined,
        customer_phone: custPhone || undefined,
        urgency,
        notes: notes || undefined
      });

      setIsLogModalOpen(false);
      setItemDesc('');
      setPreferredSize('');
      setPreferredColor('');
      setCustName('');
      setCustPhone('');
      setNotes('');
      const res = await api.get('/procurement/lost-demand');
      setLostDemandList(res.data);
    } catch (e: any) {
      alert(`Error: ${e.response?.data?.detail || 'Failed to log customer request'}`);
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleUpdateDemandStatus = async (id: number, status: string) => {
    try {
      await api.put(`/procurement/lost-demand/${id}/status`, { status });
      const res = await api.get('/procurement/lost-demand');
      setLostDemandList(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDemand = async (id: number) => {
    if (!confirm('Remove this customer demand log?')) return;
    try {
      await api.delete(`/procurement/lost-demand/${id}`);
      setLostDemandList(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // Filter and sort vendor groups and items
  const getProcessedVendorGroups = () => {
    if (!lowStockData?.vendor_groups) return [];

    let groups = lowStockData.vendor_groups;

    // Filter by Vendor
    if (selectedVendorFilter !== 'ALL') {
      groups = groups.filter((g: any) => g.vendor_code === selectedVendorFilter || g.vendor_name === selectedVendorFilter);
    }

    // Filter items by search term
    return groups.map((g: any) => {
      let filteredItems = g.items;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filteredItems = filteredItems.filter((i: any) => 
          i.name.toLowerCase().includes(q) || 
          i.barcode.toLowerCase().includes(q) ||
          i.size.toLowerCase().includes(q)
        );
      }

      // Sort items
      const sortedItems = [...filteredItems].sort((a: any, b: any) => {
        if (sortBy === 'CRITICAL') return a.current_stock - b.current_stock;
        if (sortBy === 'BUDGET') return b.estimated_cost - a.estimated_cost;
        if (sortBy === 'QTY') return b.suggested_reorder_qty - a.suggested_reorder_qty;
        return a.name.localeCompare(b.name);
      });

      return {
        ...g,
        items: sortedItems,
        total_items_count: sortedItems.length,
        total_estimated_budget: sortedItems.reduce((acc: number, item: any) => acc + item.estimated_cost, 0)
      };
    }).filter((g: any) => g.items.length > 0);
  };

  const processedGroups = getProcessedVendorGroups();
  const totalFilteredUnits = processedGroups.reduce((acc, g) => acc + g.items.reduce((s: number, i: any) => s + i.suggested_reorder_qty, 0), 0);
  const totalFilteredBudget = processedGroups.reduce((acc, g) => acc + g.total_estimated_budget, 0);

  // Print PDF Sheet Function
  const handlePrintBuyingSheet = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to generate print sheet');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Procurement Buying Sheet — Dolly Toys & Kids Wear</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1e293b; font-size: 12px; }
          .header { border-bottom: 2px solid #ec4899; padding-bottom: 10px; margin-bottom: 15px; }
          .title { font-size: 18px; font-weight: bold; color: #be185d; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 3px; }
          .vendor-section { margin-top: 20px; page-break-inside: avoid; }
          .vendor-title { font-size: 14px; font-weight: bold; background: #fdf2f8; padding: 6px 10px; border-left: 4px solid #ec4899; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
          th { background: #f1f5f9; padding: 6px 8px; text-align: left; border-bottom: 1px solid #cbd5e1; }
          td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .font-mono { font-family: monospace; }
          .grand-total { margin-top: 25px; border-top: 2px solid #0f172a; padding-top: 10px; font-size: 13px; font-weight: bold; text-align: right; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">DOLLY TOYS AND KIDS WEAR — WHOLESALE BUYING SHEET</div>
          <div class="subtitle">Agra Road, Near Mahatma Gandhi Statue, Dhule | Phone: 7972558842</div>
          <div class="subtitle">Generated on: ${new Date().toLocaleString('en-IN')} | Scope: ${selectedVendorFilter === 'ALL' ? 'All Vendors & General Stock' : selectedVendorFilter}</div>
        </div>

        ${processedGroups.map(g => `
          <div class="vendor-section">
            <div class="vendor-title">
              [${g.vendor_code}] ${g.vendor_name} — Phone: ${g.vendor_phone} | Budget: ₹${g.total_estimated_budget.toLocaleString('en-IN')}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th class="text-center">Barcode</th>
                  <th class="text-center">Size</th>
                  <th class="text-center">Color</th>
                  <th class="text-right">Stock Left</th>
                  <th class="text-right">Cost (₹)</th>
                  <th class="text-right">Order Qty</th>
                  <th class="text-right">Est. Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${g.items.map((i: any) => `
                  <tr>
                    <td class="bold">${i.name}</td>
                    <td class="text-center font-mono">${i.barcode}</td>
                    <td class="text-center bold">${i.size}</td>
                    <td class="text-center">${i.color}</td>
                    <td class="text-right font-mono">${i.current_stock}</td>
                    <td class="text-right font-mono">₹${i.purchase_price}</td>
                    <td class="text-right font-mono bold" style="color: #059669;">+${i.suggested_reorder_qty} pcs</td>
                    <td class="text-right font-mono bold">₹${i.estimated_cost.toLocaleString('en-IN')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}

        <div class="grand-total">
          Total Order Quantity: +${totalFilteredUnits} pcs | Total Estimated PO Budget: ₹${totalFilteredBudget.toLocaleString('en-IN')}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-pink-500" />
            Smart Procurement & Market Buying Planner
          </h1>
          <p className="text-xs text-slate-500">
            Supplier Buying Sheet by Vendor Code, General Unlinked Stock, Lost Customer Demand Logger & Festival Checklists.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'LOW_STOCK' && (
            <button
              onClick={handlePrintBuyingSheet}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              title="Print / Save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-pink-400" />
              <span>Print / PDF Buying Sheet</span>
            </button>
          )}

          {activeTab === 'LOST_DEMAND' && (
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="px-3.5 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-pink-600/30 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Lost Customer Request</span>
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold hover:text-pink-600"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-pink-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit text-xs font-bold">
        {[
          { id: 'LOW_STOCK', label: '📦 Low Stock Buying Sheet (by Vendor)', icon: Truck },
          { id: 'LOST_DEMAND', label: '👥 Customer Lost Demand Log', icon: UserX },
          { id: 'SEASONAL', label: '🎉 Upcoming Festival Checklist', icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
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
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col p-4">
        {/* TAB 1: LOW STOCK PROCUREMENT SHEET BY VENDOR */}
        {activeTab === 'LOW_STOCK' && lowStockData && (
          <div className="h-full flex flex-col space-y-3 overflow-hidden">
            {/* Filter & Sorting Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-xs">
              <div className="flex items-center space-x-2 flex-1">
                {/* Vendor Filter Dropdown */}
                <div className="flex items-center space-x-1.5 min-w-[220px]">
                  <Truck className="w-3.5 h-3.5 text-pink-500" />
                  <select
                    value={selectedVendorFilter}
                    onChange={(e) => setSelectedVendorFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs focus:outline-none focus:border-pink-500"
                  >
                    <option value="ALL">All Vendors & General ({lowStockData.total_low_stock_products} items)</option>
                    {lowStockData.vendor_groups.map((vg: any, idx: number) => (
                      <option key={idx} value={vg.vendor_code || vg.vendor_name}>
                        {vg.vendor_code === 'GENERAL' ? '🏷️ General / Unassigned Market Stock' : `[${vg.vendor_code}] ${vg.vendor_name} (${vg.total_items_count} items)`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search in low stock */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter by product name, barcode, size..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-xl text-xs font-medium focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              {/* Sorting Options */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3" /> Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs focus:outline-none"
                >
                  <option value="CRITICAL">⚠️ Lowest Stock First (Most Critical)</option>
                  <option value="BUDGET">💰 Highest Estimated Cost First</option>
                  <option value="QTY">📦 Highest Order Quantity First</option>
                  <option value="NAME">🔤 Product Name (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border bg-rose-50/40 dark:bg-rose-950/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-rose-600 uppercase block">Filtered Items to Buy</span>
                  <div className="text-xl font-black font-mono text-rose-600">
                    {processedGroups.reduce((acc, g) => acc + g.total_items_count, 0)} SKUs
                  </div>
                </div>
                <Tag className="w-5 h-5 text-rose-400" />
              </div>

              <div className="p-3 rounded-xl border bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Units to Order</span>
                  <div className="text-xl font-black font-mono text-emerald-600">
                    +{totalFilteredUnits} pcs
                  </div>
                </div>
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
              </div>

              <div className="p-3 rounded-xl border bg-pink-50/40 dark:bg-pink-950/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-pink-600 uppercase block">Estimated Procurement Budget</span>
                  <div className="text-xl font-black font-mono text-pink-600">
                    {formatINR(totalFilteredBudget)}
                  </div>
                </div>
                <Truck className="w-5 h-5 text-pink-400" />
              </div>
            </div>

            {/* Vendor Groups List */}
            <div className="flex-1 overflow-y-auto space-y-3 pt-1">
              {processedGroups.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  ✓ No low-stock products matching the selected filter.
                </div>
              ) : (
                processedGroups.map((vGroup: any, idx: number) => (
                  <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-slate-50/50 dark:bg-slate-950/30 space-y-2">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded font-mono font-black text-xs ${vGroup.vendor_code === 'GENERAL' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300'}`}>
                          {vGroup.vendor_code === 'GENERAL' ? 'GENERAL' : vGroup.vendor_code}
                        </span>
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                          {vGroup.vendor_name}
                        </h3>
                        {vGroup.vendor_phone !== 'N/A' && (
                          <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-500" /> {vGroup.vendor_phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-4 text-xs font-mono">
                        <span className="text-slate-500 font-bold">{vGroup.total_items_count} SKUs</span>
                        <span className="text-emerald-600 font-black">Budget: {formatINR(vGroup.total_estimated_budget)}</span>
                      </div>
                    </div>

                    {/* Vendor Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="text-[10px] font-bold text-slate-400 uppercase">
                          <tr>
                            <th className="py-1 px-2">Product Name</th>
                            <th className="py-1 px-2 text-center">Barcode</th>
                            <th className="py-1 px-2 text-center">Size</th>
                            <th className="py-1 px-2 text-center">Color</th>
                            <th className="py-1 px-2 text-right text-rose-600">Stock Left</th>
                            <th className="py-1 px-2 text-right">Cost (₹)</th>
                            <th className="py-1 px-2 text-right font-bold text-emerald-600">Order Qty</th>
                            <th className="py-1 px-2 text-right font-mono font-bold">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {vGroup.items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                              <td className="py-2 px-2 font-bold text-slate-800 dark:text-white">
                                {item.name}
                              </td>
                              <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-400">
                                {item.barcode}
                              </td>
                              <td className="py-2 px-2 text-center font-mono font-bold">
                                {item.size}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-500">
                                {item.color}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-rose-600">
                                {item.current_stock} pcs (Min: {item.min_stock_alert})
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {formatINR(item.purchase_price)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-black text-emerald-600">
                                +{item.suggested_reorder_qty} pcs
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-slate-800 dark:text-white">
                                {formatINR(item.estimated_cost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOMER LOST DEMAND LOG */}
        {activeTab === 'LOST_DEMAND' && (
          <div className="h-full flex flex-col space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Customer Out-of-Stock & Unmet Requests ({lostDemandList.length} items logged)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Track exact items customers asked for so you never miss buying them when visiting supplier wholesale markets.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase sticky top-0 z-10 border-b">
                  <tr>
                    <th className="py-2 px-3">Item Requested / Need Description</th>
                    <th className="py-2 px-2 text-center">Category</th>
                    <th className="py-2 px-2 text-center">Size / Color</th>
                    <th className="py-2 px-2 text-center">Demand Count</th>
                    <th className="py-2 px-2 text-center">Customer</th>
                    <th className="py-2 px-2 text-center">Urgency</th>
                    <th className="py-2 px-2 text-center">Procurement Status</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {lostDemandList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        No customer lost demand logged yet. Click "+ Log Lost Customer Request" above when a customer asks for a missing item!
                      </td>
                    </tr>
                  ) : (
                    lostDemandList.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800 dark:text-white block">{log.item_description}</span>
                          {log.notes && <span className="text-[10px] text-slate-400 italic">{log.notes}</span>}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500">
                          {log.category_name}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {log.preferred_size} • {log.preferred_color}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950 font-black text-pink-700 dark:text-pink-300 font-mono text-[11px]">
                            {log.request_count}x Asked
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-[11px]">
                          <span className="font-semibold block">{log.customer_name}</span>
                          {log.customer_phone !== 'N/A' && <span className="font-mono text-slate-400">{log.customer_phone}</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.urgency === 'URGENT' ? 'bg-rose-100 text-rose-800' : (log.urgency === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')}`}>
                            {log.urgency}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <select
                            value={log.status}
                            onChange={(e) => handleUpdateDemandStatus(log.id, e.target.value)}
                            className={`px-2 py-1 rounded-xl text-[10px] font-bold border ${log.status === 'FULFILLED' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : (log.status === 'ORDERED_WITH_VENDOR' ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-amber-50 text-amber-800 border-amber-300')}`}
                          >
                            <option value="PENDING_PROCUREMENT">⏳ Pending Buy</option>
                            <option value="ORDERED_WITH_VENDOR">📦 Ordered with Vendor</option>
                            <option value="FULFILLED">✓ Stock Arrived & Fulfilled</option>
                          </select>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            onClick={() => handleDeleteDemand(log.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: UPCOMING FESTIVAL CHECKLIST */}
        {activeTab === 'SEASONAL' && (
          <div className="h-full flex flex-col space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              {seasonalChecklist.map((ev, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                        <span>🎉 {ev.event_name}</span>
                      </h3>
                      <p className="text-[11px] text-pink-600 font-semibold">{ev.focus_products}</p>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 font-mono font-black text-xs">
                      in ~{ev.approx_days_left} Days
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border">
                      <span className="text-[10px] text-slate-400 block">Catalog SKUs</span>
                      <span className="font-bold text-slate-800 dark:text-white">{ev.matched_catalog_skus} items</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border">
                      <span className="text-[10px] text-slate-400 block">In-Stock Pieces</span>
                      <span className="font-bold text-emerald-600">{ev.total_units_in_stock} pcs</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border">
                      <span className="text-[10px] text-slate-400 block">Readiness</span>
                      <span className={`text-[10px] font-bold block truncate ${ev.readiness_status.includes('Ready') ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {ev.readiness_status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QUICK LOG LOST DEMAND MODAL */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-pink-500" />
                  Log Customer Out-of-Stock / Missing Demand
                </h2>
                <p className="text-xs text-slate-400">
                  Quickly record what a customer wanted so the owner can procure it in market.
                </p>
              </div>
              <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateLostDemand} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Item Description / What did the customer ask for? *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Size 28 Black Tuxedo Suit, Frozen Character Raincoat, Hot Wheels Monster Truck"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-pink-400 rounded-xl font-bold focus:outline-none focus:border-pink-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Category</label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Boys Wear"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Size Needed</label>
                  <input
                    type="text"
                    value={preferredSize}
                    onChange={(e) => setPreferredSize(e.target.value)}
                    placeholder="Size 28 / 4-5Y"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Color</label>
                  <input
                    type="text"
                    value={preferredColor}
                    onChange={(e) => setPreferredColor(e.target.value)}
                    placeholder="Black / Navy"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Customer Name (Optional)</label>
                  <input
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Customer Mobile (Optional)</label>
                  <input
                    type="text"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">Notes / Extra details</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Customer needed for wedding on Friday"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLog}
                  className="px-5 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl shadow-md shadow-pink-600/30"
                >
                  {submittingLog ? 'Saving...' : 'Save Demand Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
