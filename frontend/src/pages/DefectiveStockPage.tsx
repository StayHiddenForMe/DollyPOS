import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { Product } from '../types';
import { 
  AlertOctagon, 
  Search, 
  Plus, 
  TrendingDown, 
  CheckCircle, 
  RotateCcw,
  Sparkles,
  PackageCheck,
  Filter,
  SlidersHorizontal
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const DefectiveStockPage: React.FC = () => {
  const [damagedOverview, setDamagedOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [lossTier, setLossTier] = useState<'ALL' | 'HIGH_LOSS' | 'MULTI_PCS'>('ALL');
  const [sortField, setSortField] = useState<string>('loss_value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Log New Damaged Item Modal
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [isProductSearchFocused, setIsProductSearchFocused] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [damageQty, setDamageQty] = useState(1);
  const [damageReason, setDamageReason] = useState('Stitching defect / Fabric tear');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restock Recover Damaged Modal
  const [restockProduct, setRestockProduct] = useState<any | null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [restockReason, setRestockReason] = useState('Cleaned / Repaired / False Defect');

  useEffect(() => {
    fetchDamagedOverview();
  }, []);

  // Close active modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (restockProduct) {
          e.preventDefault();
          setRestockProduct(null);
        } else if (isLogModalOpen) {
          e.preventDefault();
          setIsLogModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [restockProduct, isLogModalOpen]);

  const fetchDamagedOverview = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/damaged-products');
      setDamagedOverview(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSearch = async (q: string) => {
    setProductQuery(q);
    if (!q.trim()) {
      setProductSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/inventory/search?q=${encodeURIComponent(q)}&limit=10`);
      setProductSearchResults(res.data);
    } catch (e) {
      setProductSearchResults([]);
    }
  };

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setProductSearchResults([]);
    setIsProductSearchFocused(false);
    setProductQuery(`${prod.name} (${prod.barcode})`);
  };

  const handleSaveDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert('Please select a product first');
      return;
    }
    if (damageQty <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/inventory/mark-damaged', {
        product_id: selectedProduct.id,
        quantity: damageQty,
        reason: damageReason
      });
      alert(`Recorded ${damageQty} pcs of "${selectedProduct.name}" into damaged pool.`);
      setIsLogModalOpen(false);
      setSelectedProduct(null);
      setProductQuery('');
      setDamageQty(1);
      fetchDamagedOverview();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to record damaged stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestockDamaged = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct) return;
    if (restockQty <= 0 || restockQty > restockProduct.damaged_quantity) {
      alert(`Restock quantity must be between 1 and ${restockProduct.damaged_quantity}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/inventory/restock-damaged', {
        product_id: restockProduct.id,
        quantity: restockQty,
        reason: restockReason
      });
      alert(`Restocked ${restockQty} pcs of "${restockProduct.name}" back into active inventory!`);
      setRestockProduct(null);
      fetchDamagedOverview();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to restock item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const items = damagedOverview?.items || [];

  // Extract distinct categories from damaged items
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((itm: any) => {
      if (itm.category_name) set.add(itm.category_name);
    });
    return Array.from(set).sort();
  }, [items]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setLossTier('ALL');
    setSortField('loss_value');
    setSortOrder('desc');
  };

  const isFilterActive = searchQuery !== '' || selectedCategory !== 'ALL' || lossTier !== 'ALL';

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(itm => {
        const nameMatch = itm.name && itm.name.toLowerCase().includes(q);
        const barcodeMatch = itm.barcode && itm.barcode.toLowerCase().includes(q);
        const catMatch = itm.category_name && itm.category_name.toLowerCase().includes(q);
        const sizeMatch = itm.size && itm.size.toLowerCase().includes(q);
        const colorMatch = itm.color && itm.color.toLowerCase().includes(q);
        return nameMatch || barcodeMatch || catMatch || sizeMatch || colorMatch;
      });
    }

    // 2. Category Filter
    if (selectedCategory !== 'ALL') {
      result = result.filter(itm => itm.category_name === selectedCategory);
    }

    // 3. Loss Tier Filter
    if (lossTier === 'HIGH_LOSS') {
      result = result.filter(itm => (Number(itm.loss_value) || 0) >= 1000);
    } else if (lossTier === 'MULTI_PCS') {
      result = result.filter(itm => (Number(itm.damaged_quantity) || 0) > 1);
    }

    // 4. Sorting
    if (sortField) {
      result.sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [items, searchQuery, selectedCategory, lossTier, sortField, sortOrder]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              Damaged & Defective Stock Manager
            </h1>
            <p className="text-xs text-slate-400">
              Track defective garments, broken toys, trapped capital loss, and restock repaired units.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsLogModalOpen(true)}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-rose-600/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Log Damaged Item</span>
        </button>
      </div>

      {/* Trapped Loss KPI Summary Cards */}
      <div className="p-4 pb-2 grid grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trapped Capital Loss (Cost)</div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
            {formatINR(damagedOverview?.total_trapped_loss || 0)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Direct purchase cost stuck in defective goods</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Defective Pieces</div>
          <div className="text-2xl font-black font-mono text-slate-800 dark:text-white mt-1">
            {damagedOverview?.total_damaged_quantity || 0} pcs
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across {damagedOverview?.total_damaged_items_count || 0} SKU variants</p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-tr from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border border-rose-200 dark:border-rose-900/40 shadow-xs">
          <div className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">Vendor Return Potential</div>
          <div className="text-xs text-rose-700/80 mt-2">
            Ask your supplier (Surat / Mumbai / Ahmedabad) for credit notes or replacements during next stock purchase.
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="px-4 pb-2">
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by name, barcode, size, color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-rose-500" />
              Category:
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold text-slate-700 dark:text-slate-200 focus:outline-none text-xs"
            >
              <option value="ALL">All Categories ({items.length})</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Quick Loss Tier Pills */}
          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[
              { id: 'ALL', label: 'All Items' },
              { id: 'HIGH_LOSS', label: '🔥 High Loss (₹1k+)' },
              { id: 'MULTI_PCS', label: '📦 Multi-Pcs (2+)' },
            ].map((tier) => (
              <button
                key={tier.id}
                onClick={() => setLossTier(tier.id as any)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  lossTier === tier.id
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>

          {/* Clear Filters Button & Counter */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold text-slate-400 px-1">
              Showing {filteredAndSortedItems.length} of {items.length}
            </span>
            {isFilterActive && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center space-x-1 transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
                title="Reset all search and category filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Damaged Stock Table */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase sticky top-0 z-10">
              <tr>
                <th 
                  onClick={() => handleSort('barcode')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors select-none"
                  title="Click to sort by Barcode"
                >
                  <div className="flex items-center space-x-1">
                    <span>Barcode</span>
                    <span className="text-[10px] text-rose-500 font-bold">{sortField === 'barcode' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors select-none"
                  title="Click to sort by Product Name"
                >
                  <div className="flex items-center space-x-1">
                    <span>Product Name</span>
                    <span className="text-[10px] text-rose-500 font-bold">{sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('category_name')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors select-none"
                  title="Click to sort by Category"
                >
                  <div className="flex items-center space-x-1">
                    <span>Category</span>
                    <span className="text-[10px] text-rose-500 font-bold">{sortField === 'category_name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('size')}
                  className="py-3 px-2 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors select-none"
                  title="Click to sort by Size"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Size</span>
                    <span className="text-[10px] text-rose-500 font-bold">{sortField === 'size' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('color')}
                  className="py-3 px-2 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors select-none"
                  title="Click to sort by Color"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Color</span>
                    <span className="text-[10px] text-rose-500 font-bold">{sortField === 'color' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('damaged_quantity')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors select-none"
                  title="Click to sort by Damaged Quantity"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Damaged Qty</span>
                    <span className="text-[10px] text-rose-500 font-bold">{sortField === 'damaged_quantity' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('cost_price')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors select-none"
                  title="Click to sort by Cost Price"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Cost Price</span>
                    <span className="text-[10px] text-rose-500 font-bold">{sortField === 'cost_price' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('loss_value')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors select-none"
                  title="Click to sort by Total Loss Value"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Total Loss Value</span>
                    <span className="text-[10px] text-rose-500 font-bold">{sortField === 'loss_value' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Restock Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">Loading damaged inventory...</td>
                </tr>
              ) : filteredAndSortedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    {items.length === 0 
                      ? '✓ Clean record! No damaged or defective goods logged.'
                      : 'No damaged items match the selected filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedItems.map((itm: any) => (
                  <tr key={itm.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {itm.barcode}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-white">
                      {itm.name}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {itm.category_name || '-'}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-bold">
                      {itm.size || '-'}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {itm.color || '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold font-mono text-[11px]">
                        {itm.damaged_quantity} pcs
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-400">
                      {formatINR(itm.cost_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatINR(itm.loss_value)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setRestockProduct(itm);
                          setRestockQty(itm.damaged_quantity);
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg font-bold text-[10px] transition-all flex items-center space-x-1 mx-auto active:scale-95"
                        title="Restock repaired item back into active inventory"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Restock / Recover</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Damaged Product Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-500" />
                Log Damaged / Defective Stock
              </h3>
              <button onClick={() => setIsLogModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDamage} className="p-5 space-y-4 text-xs">
              {/* Product Search */}
              <div className="relative">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Search Product (Barcode or Name)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={productQuery}
                    onChange={(e) => handleProductSearch(e.target.value)}
                    onFocus={() => setIsProductSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsProductSearchFocused(false), 200)}
                    placeholder="Type barcode or product name..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-semibold"
                    autoFocus
                  />
                </div>

                {/* Dropdown Results - Only shown when search input is in focus */}
                {isProductSearchFocused && productSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {productSearchResults.map((prod) => (
                      <div
                        key={prod.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectProduct(prod);
                        }}
                        className="p-2.5 hover:bg-rose-50 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold">{prod.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Barcode: {prod.barcode} • Size: {prod.size || 'N/A'} • Available: {prod.stock_quantity} pcs</div>
                        </div>
                        <div className="font-mono font-bold text-pink-600">{formatINR(prod.selling_price)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/40">
                  <div className="font-bold text-rose-800 dark:text-rose-300">{selectedProduct.name}</div>
                  <div className="text-[11px] text-rose-700/80 font-mono">
                    Current Active Stock: {selectedProduct.stock_quantity} pcs • Cost: {formatINR(selectedProduct.purchase_price)}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Defective Quantity (pcs)
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct ? selectedProduct.stock_quantity : 999}
                  value={damageQty}
                  onChange={(e) => setDamageQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono font-bold text-sm"
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Damage Reason / Defect Details
                </label>
                <select
                  value={damageReason}
                  onChange={(e) => setDamageReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
                >
                  <option value="Stitching defect / Fabric tear">Stitching defect / Fabric tear</option>
                  <option value="Color bleeding / Stain mark">Color bleeding / Stain mark</option>
                  <option value="Broken toy plastic / Missing part">Broken toy plastic / Missing part</option>
                  <option value="Water / Moisture damage during transit">Water / Moisture damage during transit</option>
                  <option value="Customer trial damage">Customer trial damage</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border text-[11px] text-slate-500">
                ⚠️ Recording damaged goods reduces saleable inventory and adds trapped cost to your P&L loss audit.
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedProduct}
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Move to Damaged Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Recover Modal */}
      {restockProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-500" />
                Restock Recovered / Repaired Item
              </h3>
              <button onClick={() => setRestockProduct(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleRestockDamaged} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">{restockProduct.name}</div>
                <div className="text-[11px] text-emerald-700/80 font-mono">
                  Currently Damaged: {restockProduct.damaged_quantity} pcs • Barcode: {restockProduct.barcode}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity to Restock (pcs)
                </label>
                <input
                  type="number"
                  min="1"
                  max={restockProduct.damaged_quantity}
                  value={restockQty}
                  onChange={(e) => setRestockQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Recovery Reason
                </label>
                <input
                  type="text"
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  placeholder="e.g. Dry cleaned stain, Stitched, Replaced button"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md"
                >
                  {isSubmitting ? 'Restocking...' : 'Restock to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
