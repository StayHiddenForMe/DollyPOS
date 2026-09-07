import React, { useState, useEffect, useRef } from 'react';
import { Product, Category, Vendor } from '../../types';
import api from '../../utils/api';
import { X, Tag, Check, Truck, Lock, Unlock, Zap, Sparkles } from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  product?: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaveSuccess: () => void;
}

const PRESET_SIZES = [
  '000', '00', '0', '1', '2', '3',
  '12', '14', '16', '18', '20', '22', '24', '26', '28', '30',
  'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', 'Free Size'
];

const FESTIVAL_PRESETS = [
  'All-Season',
  'Summer',
  'Winter',
  'Monsoon / Rainy',
  'Makar Sankranti',
  'Maha Shivratri',
  'Holi',
  'Gudi Padwa',
  'Janmashtami',
  'Chhath Puja',
  'Navratri',
  'Diwali',
  'Christmas',
  'Ekadashi',
  'Custom'
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  product,
  categories,
  onClose,
  onSaveSuccess
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [lockedVendorCode, setLockedVendorCode] = useState<string>('');
  const [isVendorLocked, setIsVendorLocked] = useState<boolean>(true);

  // Category & Subcategory Lock (Point 6)
  const [lockedCategoryId, setLockedCategoryId] = useState<number | undefined>(undefined);
  const [lockedSubcategoryId, setLockedSubcategoryId] = useState<number | undefined>(undefined);
  const [isCategoryLocked, setIsCategoryLocked] = useState<boolean>(true);

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    sku: '',
    purchase_price: 0,
    selling_price: 0,
    mrp: 0,
    stock_quantity: 1,
    category_id: undefined as number | undefined,
    subcategory_id: undefined as number | undefined,
    color: '',
    is_speed_dial: false,
    speed_dial_code: '',
    speed_dial_color: '#EC4899',
    min_stock_alert: 3,
    vendor_code: '',
    season: 'All-Season',
    custom_season: '',
    fabric: '',
    brand: '',
    gender: 'Unisex',
    age_group: '',
    gst_percent: 0,
    margin_percent: 0,
    price_change_reason: 'Price Update'
  });

  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [customSize, setCustomSize] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Close on Escape Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const res = await api.get('/vendors');
      setVendors(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setFormData({
          name: product.name,
          barcode: product.barcode,
          sku: product.sku || '',
          purchase_price: product.purchase_price,
          selling_price: product.selling_price,
          mrp: product.mrp || 0,
          stock_quantity: product.stock_quantity,
          category_id: product.category_id,
          subcategory_id: product.subcategory_id,
          color: product.color || '',
          is_speed_dial: product.is_speed_dial,
          speed_dial_code: product.speed_dial_code || '',
          speed_dial_color: product.speed_dial_color || '#EC4899',
          min_stock_alert: product.min_stock_alert,
          vendor_code: product.vendor_code || '',
          season: FESTIVAL_PRESETS.includes(product.season || '') ? (product.season || 'All-Season') : 'Custom',
          custom_season: FESTIVAL_PRESETS.includes(product.season || '') ? '' : (product.season || ''),
          fabric: product.fabric || '',
          brand: product.brand || '',
          gender: product.gender || 'Unisex',
          age_group: product.age_group || '',
          gst_percent: product.gst_percent,
          margin_percent: product.margin_percent,
          price_change_reason: 'Price Update'
        });
        setSelectedSizes(product.size ? [product.size] : []);
        setLockedVendorCode(product.vendor_code || '');
        setLockedCategoryId(product.category_id);
        setLockedSubcategoryId(product.subcategory_id);
      } else {
        resetFormForNewItem();
      }

      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 100);
    }
  }, [product, isOpen]);

  const resetFormForNewItem = () => {
    const timestamp = Date.now().toString();
    setFormData({
      name: '',
      barcode: `890${timestamp.slice(-9)}`,
      sku: `DLY-${timestamp.slice(-6)}`,
      purchase_price: 0,
      selling_price: 0,
      mrp: 0,
      stock_quantity: 1,
      category_id: isCategoryLocked ? lockedCategoryId : undefined,
      subcategory_id: isCategoryLocked ? lockedSubcategoryId : undefined,
      color: '',
      is_speed_dial: false,
      speed_dial_code: '',
      speed_dial_color: '#EC4899',
      min_stock_alert: 3,
      vendor_code: isVendorLocked ? lockedVendorCode : '',
      season: 'All-Season',
      custom_season: '',
      fabric: '',
      brand: '',
      gender: 'Unisex',
      age_group: '',
      gst_percent: 0,
      margin_percent: 0,
      price_change_reason: 'Price Update'
    });
    setSelectedSizes([]);
    setCustomSize('');
  };

  const handlePriceChange = (purchase: number, selling: number) => {
    let margin = 0;
    if (purchase > 0 && selling > 0) {
      margin = Math.round(((selling - purchase) / purchase) * 100 * 100) / 100;
    }
    setFormData(prev => ({
      ...prev,
      purchase_price: purchase,
      selling_price: selling,
      margin_percent: margin
    }));
  };

  const toggleSize = (sz: string) => {
    setSelectedSizes(prev => 
      prev.includes(sz) ? prev.filter(s => s !== sz) : [...prev, sz]
    );
  };

  const handleAddCustomSize = (e: React.FormEvent) => {
    e.preventDefault();
    if (customSize.trim()) {
      const clean = customSize.trim();
      if (!selectedSizes.includes(clean)) {
        setSelectedSizes(prev => [...prev, clean]);
      }
      setCustomSize('');
    }
  };

  const selectedCategoryObj = categories.find(c => c.id === formData.category_id);
  const subcategoriesList = selectedCategoryObj?.subcategories || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Product Name is required.');
      return;
    }
    if (formData.selling_price <= 0) {
      alert('Selling Price must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setSuccessBanner(null);

    const finalSeason = formData.season === 'Custom' 
      ? (formData.custom_season.trim() || 'Custom') 
      : formData.season;

    try {
      if (product) {
        // Update Single Product
        const payload = {
          ...formData,
          size: selectedSizes[0] || undefined,
          season: finalSeason,
          speed_dial_code: formData.speed_dial_code.trim() || undefined,
          vendor_code: formData.vendor_code || undefined
        };
        await api.put(`/inventory/${product.id}`, payload);
        setSuccessBanner(`✓ Product "${formData.name}" updated successfully!`);
        onSaveSuccess();
        setTimeout(() => onClose(), 600);
      } else {
        // Multi-size or Single Create
        if (selectedSizes.length > 1) {
          const multiPayload = {
            name: formData.name.trim(),
            base_barcode: formData.barcode.trim(),
            base_sku: formData.sku.trim(),
            category_id: formData.category_id,
            subcategory_id: formData.subcategory_id,
            vendor_code: formData.vendor_code || undefined,
            sizes: selectedSizes,
            color: formData.color || undefined,
            fabric: formData.fabric || undefined,
            season: finalSeason,
            purchase_price: formData.purchase_price,
            selling_price: formData.selling_price,
            mrp: formData.mrp || 0.0,
            gst_percent: formData.gst_percent,
            stock_per_size: formData.stock_quantity || 1,
            min_stock_alert: formData.min_stock_alert,
            is_speed_dial: formData.is_speed_dial,
            speed_dial_code: formData.speed_dial_code.trim() || undefined,
            speed_dial_color: formData.speed_dial_color
          };
          await api.post('/inventory/multi-size', multiPayload);
          setSuccessBanner(`✓ Saved ${selectedSizes.length} size variants (${selectedSizes.join(', ')})! Ready for next.`);
        } else {
          const singlePayload = {
            ...formData,
            size: selectedSizes[0] || undefined,
            season: finalSeason,
            speed_dial_code: formData.speed_dial_code.trim() || undefined,
            vendor_code: formData.vendor_code || undefined
          };
          await api.post('/inventory', singlePayload);
          setSuccessBanner(`✓ Product "${formData.name}" added successfully! Ready for next.`);
        }

        if (formData.vendor_code) {
          setLockedVendorCode(formData.vendor_code);
        }
        if (formData.category_id) {
          setLockedCategoryId(formData.category_id);
          setLockedSubcategoryId(formData.subcategory_id);
        }

        onSaveSuccess();
        resetFormForNewItem();
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save product. Check barcode/code uniqueness.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-pink-500" />
              {product ? 'Edit Product' : 'Add New Kids Product (Continuous Entry Mode)'}
            </h2>
            <p className="text-[11px] text-slate-500">
              Press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono font-bold text-[10px]">Esc</kbd> anytime to close • Category, Subcategory & Vendor code stay locked for fast multi-product entry.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Close (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Continuous Success Banner */}
        {successBanner && (
          <div className="p-2.5 bg-emerald-50 text-emerald-800 border-b border-emerald-200 text-xs font-bold flex items-center justify-between px-6 animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              {successBanner}
            </span>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-900 font-normal text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Form Body - 14 Requested Sequence Fields */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          
          {/* Row 1: (1) Product Name & (2) Barcode */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                1. Product Name *
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Boys Cotton T-Shirt, Remote Control Monster Car"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-pink-600 rounded-xl focus:outline-none font-semibold text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                2. Barcode
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Row 2: (3) Purchase Cost, (4) Selling Price, (5) MRP, (6) Qty */}
          <div className="grid grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                3. Purchase Cost (₹)
              </label>
              <input
                type="number"
                value={formData.purchase_price || ''}
                onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0, formData.selling_price)}
                placeholder="0"
                className="w-full px-3 py-1.5 font-mono font-bold bg-white dark:bg-slate-800 border rounded-xl"
                min="0"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                4. Selling Price (₹) *
              </label>
              <input
                type="number"
                value={formData.selling_price || ''}
                onChange={(e) => handlePriceChange(formData.purchase_price, parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-3 py-1.5 font-mono font-bold bg-white dark:bg-slate-800 border rounded-xl"
                required
                min="1"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                5. MRP (₹)
              </label>
              <input
                type="number"
                value={formData.mrp || ''}
                onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full px-3 py-1.5 font-mono bg-white dark:bg-slate-800 border rounded-xl"
                min="0"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                6. Quantity (Pcs) *
              </label>
              <input
                type="number"
                value={formData.stock_quantity || ''}
                onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 1 })}
                placeholder="1"
                className="w-full px-3 py-1.5 font-mono font-bold bg-white dark:bg-slate-800 border rounded-xl"
                min="1"
                required
              />
            </div>
          </div>

          {/* Row 3: (7) Category, (8) Sub Category, (9) Color, (10) Assign Speed Dial */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  7. Category
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryLocked(!isCategoryLocked)}
                  className={`text-[10px] flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded-md transition-colors ${
                    isCategoryLocked 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                      : 'bg-slate-100 text-slate-500'
                  }`}
                  title={isCategoryLocked ? 'Category locked for continuous adds' : 'Category unlocks on save'}
                >
                  {isCategoryLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                  <span>{isCategoryLocked ? 'Locked' : 'Unlocked'}</span>
                </button>
              </div>
              <select
                value={formData.category_id || ''}
                onChange={(e) => {
                  const catId = parseInt(e.target.value) || undefined;
                  const catObj = categories.find(c => c.id === catId);
                  const subId = catObj?.subcategories[0]?.id || undefined;
                  setFormData({
                    ...formData,
                    category_id: catId,
                    subcategory_id: subId
                  });
                  setLockedCategoryId(catId);
                  setLockedSubcategoryId(subId);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-semibold"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  8. Sub Category
                </label>
              </div>
              <select
                value={formData.subcategory_id || ''}
                onChange={(e) => {
                  const subId = parseInt(e.target.value) || undefined;
                  setFormData({ ...formData, subcategory_id: subId });
                  setLockedSubcategoryId(subId);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-semibold"
              >
                <option value="">Select Subcategory</option>
                {subcategoriesList.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                9. Color
              </label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="e.g. Red, Navy Blue, Pink"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>10. Speed Dial</span>
                <span className="text-[10px] text-pink-600 font-normal">#1 to #M10</span>
              </label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="checkbox"
                  id="is_speed_dial"
                  checked={formData.is_speed_dial}
                  onChange={(e) => setFormData({ ...formData, is_speed_dial: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded border-slate-300"
                />
                <input
                  type="text"
                  placeholder="Code e.g. 1 or M1"
                  value={formData.speed_dial_code}
                  disabled={!formData.is_speed_dial}
                  onChange={(e) => setFormData({ ...formData, speed_dial_code: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-xs uppercase disabled:opacity-40"
                />
              </div>
            </div>
          </div>

          {/* Row 4: (11) Sizes / Custom Sizes Multi-selector */}
          <div className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                11. Sizes (Pick Single or Multiple Sizes to Auto-generate Variants)
              </label>
              {selectedSizes.length > 0 && (
                <span className="text-[11px] font-bold text-pink-600">
                  {selectedSizes.length} Size(s): {selectedSizes.join(', ')}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto py-1">
              {PRESET_SIZES.map((sz) => {
                const isSelected = selectedSizes.includes(sz);
                return (
                  <button
                    type="button"
                    key={sz}
                    onClick={() => toggleSize(sz)}
                    className={`px-2.5 py-1 rounded-lg font-bold font-mono text-xs transition-all flex items-center space-x-1 ${
                      isSelected
                        ? 'bg-pink-600 text-white shadow-xs scale-105'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{sz}</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5 inline" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="text"
                placeholder="Custom size (e.g. 6-12M, 32, 4-5Y)..."
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                className="flex-1 px-3 py-1 bg-white dark:bg-slate-800 border rounded-xl text-xs"
              />
              <button
                type="button"
                onClick={handleAddCustomSize}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
              >
                + Add Custom Size
              </button>
            </div>
          </div>

          {/* Row 5: (12) Min Stock Alert, (13) Vendor Code (Locked), (14) Season / Festival */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                12. Min Stock Alert Qty
              </label>
              <input
                type="number"
                value={formData.min_stock_alert}
                onChange={(e) => setFormData({ ...formData, min_stock_alert: parseInt(e.target.value) || 3 })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono"
                min="0"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-pink-500" />
                  13. Vendor Code
                </label>
                <button
                  type="button"
                  onClick={() => setIsVendorLocked(!isVendorLocked)}
                  className={`text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold ${
                    isVendorLocked ? 'bg-pink-100 text-pink-700' : 'bg-slate-200 text-slate-600'
                  }`}
                  title={isVendorLocked ? 'Vendor Code locked across product saves' : 'Vendor Code unlocks each save'}
                >
                  {isVendorLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  <span>{isVendorLocked ? 'Locked' : 'Unlocked'}</span>
                </button>
              </div>

              <input
                type="text"
                list="vendors-datalist"
                value={formData.vendor_code}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, vendor_code: val });
                  setLockedVendorCode(val);
                }}
                placeholder="e.g. VEN-001 or VENDOR NAME"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-xs font-semibold"
              />
              <datalist id="vendors-datalist">
                {vendors.map(v => (
                  <option key={v.id} value={v.vendor_code || v.name}>{v.name} ({v.vendor_code || 'No code'})</option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                14. Season / Festival Tag
              </label>
              <select
                value={formData.season}
                onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-semibold"
              >
                {FESTIVAL_PRESETS.map((fest) => (
                  <option key={fest} value={fest}>{fest}</option>
                ))}
              </select>
              {formData.season === 'Custom' && (
                <input
                  type="text"
                  placeholder="Type custom festival / season..."
                  value={formData.custom_season}
                  onChange={(e) => setFormData({ ...formData, custom_season: e.target.value })}
                  className="w-full mt-1.5 px-3 py-1 bg-white dark:bg-slate-800 border rounded-xl text-xs font-semibold"
                />
              )}
            </div>
          </div>

          {/* Footer Submit Action */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 font-mono">
              Margin: <strong className="text-emerald-600">{formData.margin_percent}%</strong>
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
              >
                Close (Esc)
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs shadow-md shadow-pink-600/30 active:scale-95 transition-all"
              >
                {isSubmitting ? 'Saving Product...' : (product ? 'Update Product' : '+ Save Product (Enter)')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
