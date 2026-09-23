import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Product, Category } from '../types';
import { useAuthStore } from '../store/authStore';
import { 
  Package, 
  Search, 
  Plus, 
  Filter, 
  Edit3, 
  Trash2, 
  Barcode as BarcodeIcon, 
  Printer, 
  AlertTriangle,
  Zap,
  Tag,
  Palette,
  ChevronLeft,
  ChevronRight,
  History,
  TrendingUp,
  Copy,
  Check,
  Upload,
  Download
} from 'lucide-react';
import { formatINR } from '../utils/formatters';
import { ProductFormModal } from '../components/inventory/ProductFormModal';
import { LabelPreviewModal } from '../components/barcode/LabelPreviewModal';
import { PriceHistoryModal } from '../components/inventory/PriceHistoryModal';

export const InventoryPage: React.FC = () => {
  const { isOwner } = useAuthStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  // Editable Page Catalog Heading (Click-to-edit directly without extra buttons)
  const [catalogTitle, setCatalogTitle] = useState<string>(() => {
    return localStorage.getItem('dollypos_inventory_catalog_title') || 'Kids Wear & Toy Inventory Catalog';
  });
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  // Inline Speed Dial Quick Edit
  const [editingSpeedDialId, setEditingSpeedDialId] = useState<number | null>(null);
  const [speedDialInput, setSpeedDialInput] = useState('');
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportStockExcel = async () => {
    setIsExporting(true);
    try {
      const urlParam = selectedCategory ? `?category_id=${selectedCategory}` : '';
      const res = await api.get(`/inventory/export-excel${urlParam}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const catName = categories.find(c => c.id === selectedCategory)?.name || 'All_Stock';
      link.setAttribute('download', `DollyToys_Stock_${catName}_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to export inventory sheet');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsImporting(true);
    try {
      const res = await api.post('/inventory/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(res.data.message);
      fetchProducts();
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to import products from Excel');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [page, pageSize, search, selectedCategory, selectedColor, lowStockOnly]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `/inventory?page=${page}&page_size=${pageSize}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedCategory) url += `&category_id=${selectedCategory}`;
      if (selectedColor) url += `&color=${encodeURIComponent(selectedColor)}`;
      if (lowStockOnly) url += `&low_stock_only=true`;

      const res = await api.get(url);
      setProducts(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this product?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete product');
    }
  };

  const handleInlineSpeedDialSave = async (prod: Product) => {
    const code = speedDialInput.trim().toUpperCase();
    try {
      await api.put(`/inventory/${prod.id}/speed-dial`, {
        is_speed_dial: !!code,
        speed_dial_code: code || null
      });
      setEditingSpeedDialId(null);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update speed dial');
    }
  };

  const uniqueColors = Array.from(new Set(products.map(p => p.color).filter(Boolean))) as string[];
  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-pink-500 shrink-0" />
              <input
                type="text"
                autoFocus
                value={catalogTitle}
                onChange={(e) => {
                  const val = e.target.value;
                  setCatalogTitle(val);
                  localStorage.setItem('dollypos_inventory_catalog_title', val);
                }}
                onBlur={() => {
                  if (!catalogTitle.trim()) {
                    setCatalogTitle('Kids Wear & Toy Inventory Catalog');
                    localStorage.setItem('dollypos_inventory_catalog_title', 'Kids Wear & Toy Inventory Catalog');
                  }
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    if (!catalogTitle.trim()) {
                      setCatalogTitle('Kids Wear & Toy Inventory Catalog');
                      localStorage.setItem('dollypos_inventory_catalog_title', 'Kids Wear & Toy Inventory Catalog');
                    }
                    setIsEditingTitle(false);
                  }
                }}
                className="text-xl font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-800 border-2 border-pink-500 rounded-xl px-2.5 py-0.5 outline-none shadow-sm min-w-[320px]"
              />
            </div>
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              title="Click to edit heading"
              className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2 cursor-pointer hover:text-pink-600 dark:hover:text-pink-400 group transition-colors"
            >
              <Package className="w-5 h-5 text-pink-500 shrink-0" />
              <span className="border-b-2 border-dashed border-transparent group-hover:border-pink-500/50 pb-0.5">
                {catalogTitle || 'Kids Wear & Toy Inventory Catalog'}
              </span>
            </h1>
          )}
          <p className="text-xs text-slate-500">
            Total {total} unique SKUs • Multi-size matrix, instant shortcodes, price logs & barcode stickers.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isOwner() && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportExcel}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{isImporting ? 'Importing...' : 'Import Stock (.xlsx)'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportStockExcel}
                disabled={isExporting}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Exporting...' : 'Export Stock (.xlsx)'}</span>
              </button>
            </>
          )}

          <button
            onClick={handleAddNew}
            className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-pink-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Kids Product (Continuous Mode)</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by Barcode, Shortcode (e.g. 1, M10), Name, SKU, Size, or Color..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-pink-500 focus:outline-none font-mono"
          />
        </div>

        {/* Category Filter */}
        <div className="w-44">
          <select
            value={selectedCategory || ''}
            onChange={(e) => { setSelectedCategory(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Color Filter */}
        <div className="w-36">
          <select
            value={selectedColor}
            onChange={(e) => { setSelectedColor(e.target.value); setPage(1); }}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
          >
            <option value="">All Colors</option>
            {uniqueColors.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        {/* Low Stock Toggle */}
        <button
          onClick={() => { setLowStockOnly(!lowStockOnly); setPage(1); }}
          className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1 font-semibold transition-colors ${
            lowStockOnly
              ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
              : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <span>Low Stock Alert</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Barcode</th>
                <th className="py-2.5 px-3 max-w-[220px]">Product Name</th>
                <th className="py-2.5 px-2">Category</th>
                <th className="py-2.5 px-2 text-center">Size</th>
                <th className="py-2.5 px-2 text-center">Color</th>
                <th className="py-2.5 px-2 text-center">⚡ Speed Dial</th>
                <th className="py-2.5 px-3 text-right">Cost (₹)</th>
                <th className="py-2.5 px-3 text-right">Sell (₹)</th>
                <th className="py-2.5 px-2 text-center">Stock</th>
                <th className="py-2.5 px-3 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">Loading catalog...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">No products found matching criteria</td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = p.stock_quantity <= p.min_stock_alert;
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      isLow ? 'bg-rose-50/20' : ''
                    }`}>
                      {/* Barcode with 1-Click Copy */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center space-x-1.5 group">
                          <span className="select-text cursor-text">{p.barcode}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(p.barcode);
                              setCopiedBarcode(p.barcode);
                              setTimeout(() => setCopiedBarcode(null), 1500);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-pink-600 transition-opacity"
                            title="Copy Barcode"
                          >
                            {copiedBarcode === p.barcode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Product Name (Width controlled for clean fit) */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white max-w-[200px] truncate" title={p.name}>
                        {p.name}
                        {p.vendor_code && (
                          <span className="text-[10px] text-pink-500 font-mono block">Vendor: {p.vendor_code}</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-2 text-slate-500">
                        {p.category_name || '-'}
                      </td>

                      {/* Size */}
                      <td className="py-2.5 px-2 text-center">
                        {p.size ? (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-bold font-mono">
                            {p.size}
                          </span>
                        ) : '-'}
                      </td>

                      {/* Color */}
                      <td className="py-2.5 px-2 text-center">
                        {p.color ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 text-[10px] font-bold">
                            {p.color}
                          </span>
                        ) : '-'}
                      </td>

                      {/* Speed Dial Column */}
                      <td className="py-2.5 px-2 text-center">
                        {editingSpeedDialId === p.id ? (
                          <div className="flex items-center space-x-1 justify-center">
                            <input
                              type="text"
                              value={speedDialInput}
                              onChange={(e) => setSpeedDialInput(e.target.value)}
                              placeholder="Code..."
                              className="w-16 px-1.5 py-0.5 font-mono uppercase text-[10px] bg-white border border-pink-500 rounded text-center"
                              autoFocus
                            />
                            <button
                              onClick={() => handleInlineSpeedDialSave(p)}
                              className="px-1.5 py-0.5 bg-pink-600 text-white rounded text-[10px] font-bold"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setEditingSpeedDialId(null)}
                              className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingSpeedDialId(p.id);
                              setSpeedDialInput(p.speed_dial_code || '');
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-black transition-all ${
                              p.speed_dial_code 
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs hover:bg-amber-200' 
                                : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Click to assign speed shortcode (e.g. 1, M10)"
                          >
                            {p.speed_dial_code ? `⚡ ${p.speed_dial_code}` : '+ Assign'}
                          </button>
                        )}
                      </td>

                      {/* Cost */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                        {formatINR(p.purchase_price)}
                      </td>

                      {/* Selling Price */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-pink-600 dark:text-pink-400">
                        {formatINR(p.selling_price)}
                      </td>

                      {/* Stock */}
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                          isLow ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {p.stock_quantity}
                        </span>
                      </td>

                      {/* Actions: Barcode, Price History, Edit, Delete */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* 1. Barcode Print Action Icon */}
                          <button
                            onClick={() => setLabelProduct(p)}
                            className="p-1 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                            title="Print Barcode Label"
                          >
                            <BarcodeIcon className="w-4 h-4" />
                          </button>

                          {/* 2. Price History Log Icon */}
                          <button
                            onClick={() => setHistoryProduct(p)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Price Evolution History"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* 3. Edit */}
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Product Details"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* 4. Delete (Owner only) */}
                          {isOwner() && (
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Deactivate Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-500">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 bg-white dark:bg-slate-700 border rounded-lg font-bold"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
            <span>Showing {Math.min((page - 1) * pageSize + 1, total)} - {Math.min(page * pageSize, total)} of {total} products</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 bg-white dark:bg-slate-700 border rounded-lg font-mono font-bold">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Product Form Modal */}
      {isFormOpen && (
        <ProductFormModal
          isOpen={isFormOpen}
          product={editingProduct}
          categories={categories}
          onClose={() => setIsFormOpen(false)}
          onSaveSuccess={fetchProducts}
        />
      )}

      {/* Barcode Label Preview Modal */}
      {labelProduct && (
        <LabelPreviewModal
          isOpen={!!labelProduct}
          product={labelProduct}
          onClose={() => setLabelProduct(null)}
        />
      )}

      {/* Price Evolution History Modal */}
      {historyProduct && (
        <PriceHistoryModal
          isOpen={!!historyProduct}
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
        />
      )}
    </div>
  );
};
