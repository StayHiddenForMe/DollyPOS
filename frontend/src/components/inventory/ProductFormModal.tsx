import React, { useState, useEffect, useRef } from 'react';
import { Product, Category, Vendor } from '../../types';
import api from '../../utils/api';
import { X, Tag, Check, Truck, Lock, Unlock, Percent, Plus, Minus, Printer, Trash2, Barcode, RefreshCw } from 'lucide-react';
import {
  GARMENT_STYLE_OPTIONS,
  parseProductStyleCode,
  parseStyleCodeString,
  toggleStyleCodeValue,
  formatSizeAndColor,
  formatStickerRate,
  printBarcodeStickers,
  PrintStickerItem,
  StartSlot
} from '../../utils/printBarcode';

interface ProductFormModalProps {
  isOpen: boolean;
  product?: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaveSuccess: () => void;
}

interface FormBarcodeQueueItem {
  uid: string;
  productId?: number;
  name: string;
  barcode: string;
  size?: string;
  color?: string;
  styleCode?: string;
  mrp: number;
  copies: number;
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

const CUSTOM_STYLE_CODES_KEY = 'dollypos_custom_style_codes';
const BARCODE_QUEUE_ENABLED_KEY = 'dollypos_form_barcode_queue_enabled';

const capitalizeFirstWord = (val: string): string => {
  if (!val) return val;
  return val.replace(/^(\s*)([a-z])/, (_, spaces, ch) => `${spaces}${ch.toUpperCase()}`);
};

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

  // Category & Subcategory Lock
  const [lockedCategoryId, setLockedCategoryId] = useState<number | undefined>(undefined);
  const [lockedSubcategoryId, setLockedSubcategoryId] = useState<number | undefined>(undefined);
  const [isCategoryLocked, setIsCategoryLocked] = useState<boolean>(true);

  // Low Stock Alert Lock (kept until modal is closed)
  const [lockedMinStockAlert, setLockedMinStockAlert] = useState<number>(3);
  const [isMinStockLocked, setIsMinStockLocked] = useState<boolean>(true);

  // Short Code Lock (kept until modal is closed)
  const [lockedStyleCode, setLockedStyleCode] = useState<string>('');
  const [isStyleCodeLocked, setIsStyleCodeLocked] = useState<boolean>(true);

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
    cgst_percent: 0,
    sgst_percent: 0,
    margin_percent: 0,
    price_change_reason: 'Price Update'
  });

  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [customSize, setCustomSize] = useState('');
  const [customStyleInput, setCustomStyleInput] = useState('');
  const [customStyleCodes, setCustomStyleCodes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_STYLE_CODES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Right-side Barcode Print Queue state
  const [isBarcodeQueueEnabled, setIsBarcodeQueueEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(BARCODE_QUEUE_ENABLED_KEY);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [barcodeQueue, setBarcodeQueue] = useState<FormBarcodeQueueItem[]>([]);
  const [startSlot, setStartSlot] = useState<StartSlot>('left');
  const queueListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (queueListRef.current) {
      queueListRef.current.scrollTop = queueListRef.current.scrollHeight;
    }
  }, [barcodeQueue.length]);

  const toggleBarcodeQueueEnabled = () => {
    const next = !isBarcodeQueueEnabled;
    setIsBarcodeQueueEnabled(next);
    try {
      localStorage.setItem(BARCODE_QUEUE_ENABLED_KEY, JSON.stringify(next));
    } catch {}
  };

  const updateQueueItemCopies = (uid: string, deltaOrVal: number, isAbsolute = false) => {
    setBarcodeQueue(prev =>
      prev.map(item => {
        if (item.uid !== uid) return item;
        const nextCopies = isAbsolute ? Math.max(1, deltaOrVal) : Math.max(1, item.copies + deltaOrVal);
        return { ...item, copies: nextCopies };
      })
    );
  };

  const removeQueueItem = (uid: string) => {
    setBarcodeQueue(prev => prev.filter(item => item.uid !== uid));
  };

  const handlePrintQueuedBarcodes = () => {
    if (barcodeQueue.length === 0) return;
    const stickerItems: PrintStickerItem[] = [];
    barcodeQueue.forEach(q => {
      for (let i = 0; i < q.copies; i++) {
        stickerItems.push({
          productName: q.name,
          styleCode: q.styleCode || undefined,
          size: q.size || undefined,
          color: q.color || undefined,
          barcode: q.barcode,
          mrp: q.mrp,
          barcodeImage: ''
        });
      }
    });
    printBarcodeStickers(stickerItems, '2UP_50x25', startSlot);
  };

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
        const parsedExisting = parseProductStyleCode(product.name, product.fabric);
        setFormData({
          name: parsedExisting.baseName,
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
          fabric: parsedExisting.styleCode || '',
          brand: product.brand || '',
          gender: product.gender || 'Unisex',
          age_group: product.age_group || '',
          gst_percent: product.gst_percent || 0,
          cgst_percent: product.cgst_percent !== undefined ? product.cgst_percent : ((product.gst_percent || 0) / 2),
          sgst_percent: product.sgst_percent !== undefined ? product.sgst_percent : ((product.gst_percent || 0) / 2),
          margin_percent: product.margin_percent,
          price_change_reason: 'Price Update'
        });
        setSelectedSizes(product.size ? [product.size] : []);
        setLockedVendorCode(product.vendor_code || '');
        setLockedCategoryId(product.category_id);
        setLockedSubcategoryId(product.subcategory_id);
        setLockedMinStockAlert(product.min_stock_alert);
        setLockedStyleCode(parsedExisting.styleCode || '');
      } else {
        resetFormForNewItem();
      }

      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 100);
    }
  }, [product, isOpen]);

  const resetFormForNewItem = (nextMinAlert?: number, nextStyleCode?: string) => {
    const timestamp = Date.now().toString();
    const effectiveMinAlert = nextMinAlert !== undefined ? nextMinAlert : lockedMinStockAlert;
    const effectiveStyleCode = nextStyleCode !== undefined ? nextStyleCode : lockedStyleCode;
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
      min_stock_alert: isMinStockLocked ? effectiveMinAlert : 3,
      vendor_code: isVendorLocked ? lockedVendorCode : '',
      season: 'All-Season',
      custom_season: '',
      fabric: isStyleCodeLocked ? effectiveStyleCode : '',
      brand: '',
      gender: 'Unisex',
      age_group: '',
      gst_percent: 0,
      cgst_percent: 0,
      sgst_percent: 0,
      margin_percent: 0,
      price_change_reason: 'Price Update'
    });
    setSelectedSizes([]);
    setCustomSize('');
    setCustomStyleInput('');
  };

  const handleRegenerateBarcode = () => {
    const timestamp = Date.now().toString();
    const newBarcode = `890${timestamp.slice(-9)}`;
    setFormData(prev => ({ ...prev, barcode: newBarcode }));
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

  const GST_PRESETS = [0, 2, 5, 12, 18, 28];

  const handleTotalGstChange = (total: number) => {
    const validTotal = Math.max(0, total);
    const half = Math.round((validTotal / 2) * 100) / 100;
    setFormData(prev => ({
      ...prev,
      gst_percent: validTotal,
      cgst_percent: half,
      sgst_percent: half
    }));
  };

  const handleCgstChange = (cgst: number) => {
    const validCgst = Math.max(0, cgst);
    setFormData(prev => {
      const newTotal = Math.round((validCgst + prev.sgst_percent) * 100) / 100;
      return {
        ...prev,
        cgst_percent: validCgst,
        gst_percent: newTotal
      };
    });
  };

  const handleSgstChange = (sgst: number) => {
    const validSgst = Math.max(0, sgst);
    setFormData(prev => {
      const newTotal = Math.round((prev.cgst_percent + validSgst) * 100) / 100;
      return {
        ...prev,
        sgst_percent: validSgst,
        gst_percent: newTotal
      };
    });
  };

  const toggleSize = (sz: string) => {
    setSelectedSizes(prev => 
      prev.includes(sz) ? prev.filter(s => s !== sz) : [...prev, sz]
    );
  };

  const handleAddCustomSize = () => {
    if (customSize.trim()) {
      const clean = customSize.trim();
      if (!selectedSizes.includes(clean)) {
        setSelectedSizes(prev => [...prev, clean]);
      }
      setCustomSize('');
    }
  };

  const handleAddCustomStyleCode = () => {
    const clean = customStyleInput.trim().toUpperCase().replace(/[^A-Z0-9\/\-]/g, '').slice(0, 6);
    if (!clean) return;
    const presetCodes = GARMENT_STYLE_OPTIONS.map(o => o.code);
    if (!presetCodes.includes(clean) && !customStyleCodes.includes(clean)) {
      const updated = [...customStyleCodes, clean];
      setCustomStyleCodes(updated);
      try {
        localStorage.setItem(CUSTOM_STYLE_CODES_KEY, JSON.stringify(updated));
      } catch {}
    }
    const nextCodeStr = toggleStyleCodeValue(formData.fabric, clean);
    setFormData(prev => ({ ...prev, fabric: nextCodeStr }));
    setLockedStyleCode(nextCodeStr);
    setCustomStyleInput('');
  };

  const handleRemoveCustomStyleCode = (codeToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customStyleCodes.filter(c => c !== codeToRemove);
    setCustomStyleCodes(updated);
    try {
      localStorage.setItem(CUSTOM_STYLE_CODES_KEY, JSON.stringify(updated));
    } catch {}
    const currentCodes = parseStyleCodeString(formData.fabric);
    if (currentCodes.includes(codeToRemove)) {
      const nextCodeStr = toggleStyleCodeValue(formData.fabric, codeToRemove);
      setFormData(prev => ({ ...prev, fabric: nextCodeStr }));
      setLockedStyleCode(nextCodeStr);
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
            cgst_percent: formData.cgst_percent,
            sgst_percent: formData.sgst_percent,
            stock_per_size: formData.stock_quantity || 1,
            min_stock_alert: formData.min_stock_alert,
            is_speed_dial: formData.is_speed_dial,
            speed_dial_code: formData.speed_dial_code.trim() || undefined,
            speed_dial_color: formData.speed_dial_color
          };
          const res = await api.post('/inventory/multi-size', multiPayload);
          if (isBarcodeQueueEnabled) {
            const createdList: Product[] = Array.isArray(res.data) ? res.data : [];
            const newItems: FormBarcodeQueueItem[] = createdList.map((cp, idx) => ({
              uid: `${cp.id || Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              productId: cp.id,
              name: cp.name || formData.name.trim(),
              barcode: cp.barcode,
              size: cp.size || undefined,
              color: cp.color || formData.color || undefined,
              styleCode: cp.fabric || formData.fabric || undefined,
              mrp: cp.mrp || cp.selling_price || formData.mrp || formData.selling_price,
              copies: cp.stock_quantity || formData.stock_quantity || 1
            }));
            setBarcodeQueue(prev => [...prev, ...newItems]);
          }
          setSuccessBanner(`✓ Saved ${selectedSizes.length} size variants (${selectedSizes.join(', ')})!${isBarcodeQueueEnabled ? ' Added to Barcode Queue →' : ' Ready for next.'}`);
        } else {
          const singlePayload = {
            ...formData,
            size: selectedSizes[0] || undefined,
            season: finalSeason,
            speed_dial_code: formData.speed_dial_code.trim() || undefined,
            vendor_code: formData.vendor_code || undefined
          };
          const res = await api.post('/inventory', singlePayload);
          if (isBarcodeQueueEnabled) {
            const created: Product = res.data;
            const newItem: FormBarcodeQueueItem = {
              uid: `${created?.id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              productId: created?.id,
              name: created?.name || formData.name.trim(),
              barcode: created?.barcode || formData.barcode.trim(),
              size: created?.size || selectedSizes[0] || undefined,
              color: created?.color || formData.color || undefined,
              styleCode: created?.fabric || formData.fabric || undefined,
              mrp: created?.mrp || created?.selling_price || formData.mrp || formData.selling_price,
              copies: created?.stock_quantity || formData.stock_quantity || 1
            };
            setBarcodeQueue(prev => [...prev, newItem]);
          }
          setSuccessBanner(`✓ Product "${formData.name}" added!${isBarcodeQueueEnabled ? ' Queued for barcode print →' : ' Ready for next.'}`);
        }

        if (formData.vendor_code) {
          setLockedVendorCode(formData.vendor_code);
        }
        if (formData.category_id) {
          setLockedCategoryId(formData.category_id);
          setLockedSubcategoryId(formData.subcategory_id);
        }
        setLockedMinStockAlert(formData.min_stock_alert);
        setLockedStyleCode(formData.fabric);

        onSaveSuccess();
        resetFormForNewItem(formData.min_stock_alert, formData.fabric);
        requestAnimationFrame(() => {
          nameInputRef.current?.focus();
        });
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 50);
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 180);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save product. Check barcode/code uniqueness.');
    } finally {
      setIsSubmitting(false);
      if (!product) {
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 20);
      }
    }
  };

  if (!isOpen) return null;

  const parsedName = parseProductStyleCode(formData.name, formData.fabric);
  const totalQueuedStickers = barcodeQueue.reduce((sum, item) => sum + item.copies, 0);
  const total2UpRows = Math.ceil((totalQueuedStickers + (startSlot === 'right' ? 1 : 0)) / 2);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 select-none">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full ${product ? 'max-w-4xl' : 'max-w-6xl'} overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in duration-150`}>
        {/* Compact Header */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-pink-50 dark:bg-pink-950/60 text-pink-600">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                {product ? 'Edit Product' : 'Add Product (Fast Continuous Entry)'}
              </h2>
              <p className="text-[10.5px] text-slate-500">
                Press <kbd className="px-1 py-0.2 bg-slate-200 dark:bg-slate-700 rounded font-mono font-bold text-[9.5px]">Esc</kbd> to close • Short Code, Category, Vendor &amp; Low Stock stay locked for rapid entry
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800" title="Close (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Continuous Success Banner */}
        {successBanner && (
          <div className="py-2 px-5 bg-emerald-50 text-emerald-800 border-b border-emerald-200 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              {successBanner}
            </span>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-900 font-normal text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Main Body: Left Form + Right Barcode Print Queue Panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Clean, Compact Form Body */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 min-w-0">
            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
              
              {/* SECTION 1: Product Name + Short Codes (1 or 2 codes + Custom) & Barcode */}
              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-8">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Product Name *
                      </label>
                      {(formData.name.trim() || parsedName.styleCode) && (
                        <div className="text-[11px] bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs">
                          <span className="text-slate-400 text-[10px]">Sticker 2nd Line:</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {[
                              formatSizeAndColor(selectedSizes[0], formData.color),
                              parsedName.styleCode || '',
                              formatStickerRate(formData.mrp || formData.selling_price || 0)
                            ].filter(Boolean).join('  |  ')}
                          </span>
                        </div>
                      )}
                    </div>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: capitalizeFirstWord(e.target.value) })}
                      placeholder="e.g. Dress, Dress for some kids at 1yr"
                      className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-pink-600 rounded-lg focus:outline-none font-semibold text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div className="col-span-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Barcode <span className="text-[10px] font-normal text-slate-400">(Click to select)</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleRegenerateBarcode}
                        className="text-[10.5px] text-pink-600 hover:text-pink-700 dark:text-pink-400 font-bold flex items-center gap-1 hover:underline"
                        title="Generate a new unique 890 barcode"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.barcode}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => e.currentTarget.select()}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-pink-600 rounded-lg focus:outline-none pr-8"
                        placeholder="e.g. 890123456789"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleRegenerateBarcode}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-pink-600 rounded transition-colors"
                        title="Regenerate Barcode"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

              {/* Short Codes Bar: F/S, H/S, C/S, R/N, FNY + Custom Code (Pick 1 or 2) */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-500 mr-0.5 flex items-center gap-1">
                    <span>Short Code <span className="text-slate-400 font-normal">(Pick 1 or 2):</span></span>
                    {!product && (
                      <button
                        type="button"
                        onClick={() => setIsStyleCodeLocked(!isStyleCodeLocked)}
                        className={`flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold transition-colors ${
                          isStyleCodeLocked
                            ? 'bg-pink-50 text-pink-700 border border-pink-200'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                        title="Keep Short Code locked for continuous product entry until modal is closed"
                      >
                        {isStyleCodeLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                        {isStyleCodeLocked ? 'Locked' : 'Unlock'}
                      </button>
                    )}
                  </span>

                  {/* Preset Short Codes */}
                  {GARMENT_STYLE_OPTIONS.map((opt) => {
                    const isActive = parsedName.styleCodes.includes(opt.code);
                    const orderIdx = parsedName.styleCodes.indexOf(opt.code);
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => {
                          const nextCodeStr = toggleStyleCodeValue(formData.fabric, opt.code);
                          setFormData({ ...formData, fabric: nextCodeStr });
                          setLockedStyleCode(nextCodeStr);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] transition-all border flex items-center gap-1 ${
                          isActive
                            ? 'bg-pink-600 text-white border-pink-600 font-black shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-pink-400 font-semibold'
                        }`}
                        title={`${opt.label} (${opt.code}) — Click to toggle (up to 2 codes)`}
                      >
                        <span>{opt.label}</span>
                        <span className="font-black">({opt.code})</span>
                        {isActive && parsedName.styleCodes.length > 1 && (
                          <span className="text-[9px] bg-white/25 px-1 rounded">{orderIdx + 1}</span>
                        )}
                      </button>
                    );
                  })}

                  {/* Saved Custom Short Codes */}
                  {customStyleCodes.map((code) => {
                    const isActive = parsedName.styleCodes.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          const nextCodeStr = toggleStyleCodeValue(formData.fabric, code);
                          setFormData({ ...formData, fabric: nextCodeStr });
                          setLockedStyleCode(nextCodeStr);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] transition-all border flex items-center gap-1 ${
                          isActive
                            ? 'bg-pink-600 text-white border-pink-600 font-black shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-pink-400 font-bold'
                        }`}
                        title={`Custom Code (${code})`}
                      >
                        <span>{code}</span>
                        <span
                          onClick={(e) => handleRemoveCustomStyleCode(code, e)}
                          className={`ml-0.5 text-[10px] hover:text-rose-300 ${isActive ? 'text-white/80' : 'text-slate-400 hover:text-rose-500'}`}
                          title="Delete custom code"
                        >
                          ×
                        </span>
                      </button>
                    );
                  })}

                  {parsedName.styleCodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, fabric: '' });
                        setLockedStyleCode('');
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Inline Custom Short Code Input */}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={customStyleInput}
                    onChange={(e) => setCustomStyleInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomStyleCode();
                      }
                    }}
                    placeholder="Custom e.g. COT"
                    maxLength={6}
                    className="w-28 px-2 py-0.5 text-[11px] font-mono font-bold uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:border-pink-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomStyleCode}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-md text-[11px] flex items-center gap-0.5"
                    title="Add & select custom short code"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Code</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 2: Pricing & Stock (4 Columns) */}
            <div className="grid grid-cols-4 gap-3 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Purchase Cost (₹)
                </label>
                <input
                  type="number"
                  value={formData.purchase_price || ''}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                  onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0, formData.selling_price)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  min="0"
                />
              </div>

              <div>
                <label className="block font-bold text-pink-600 dark:text-pink-400 mb-1">
                  Selling Price (₹) *
                </label>
                <input
                  type="number"
                  value={formData.selling_price || ''}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                  onChange={(e) => handlePriceChange(formData.purchase_price, parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-pink-300 dark:border-pink-800 focus:border-pink-600 rounded-lg focus:outline-none"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                  MRP (₹)
                </label>
                <input
                  type="number"
                  value={formData.mrp || ''}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                  onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  min="0"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Quantity (Pcs) *
                </label>
                <input
                  type="number"
                  value={formData.stock_quantity || ''}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  className="w-full px-2.5 py-1.5 font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  min="1"
                  required
                />
              </div>
            </div>

            {/* SECTION 3: Category, Subcategory, Vendor & Color (4 Columns) */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Category</label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryLocked(!isCategoryLocked)}
                    className={`text-[9.5px] flex items-center gap-0.5 font-bold px-1.5 py-0.2 rounded transition-colors ${
                      isCategoryLocked 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCategoryLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                    <span>{isCategoryLocked ? 'Locked' : 'Unlock'}</span>
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
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sub Category
                </label>
                <select
                  value={formData.subcategory_id || ''}
                  onChange={(e) => {
                    const subId = parseInt(e.target.value) || undefined;
                    setFormData({ ...formData, subcategory_id: subId });
                    setLockedSubcategoryId(subId);
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                >
                  <option value="">Select Subcategory</option>
                  {subcategoriesList.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-pink-500" />
                    <span>Vendor</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsVendorLocked(!isVendorLocked)}
                    className={`text-[9.5px] flex items-center gap-0.5 px-1.5 py-0.2 rounded font-bold ${
                      isVendorLocked ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isVendorLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                    <span>{isVendorLocked ? 'Locked' : 'Unlock'}</span>
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
                  placeholder="e.g. VEN-001"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs font-semibold"
                />
                <datalist id="vendors-datalist">
                  {vendors.map(v => (
                    <option key={v.id} value={v.vendor_code || v.name}>{v.name} ({v.vendor_code || 'No code'})</option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: capitalizeFirstWord(e.target.value) })}
                  placeholder="e.g. Red, Pink, Blue"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-medium"
                />
              </div>
            </div>

            {/* SECTION 4: Compact Sizes Bar (with inline custom size input) */}
            <div className="p-2.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Sizes <span className="text-slate-400 font-normal">(Pick 1 or multiple variants)</span>
                  </label>
                  {selectedSizes.length > 0 && (
                    <span className="text-[10.5px] bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 px-2 py-0.2 rounded-full font-bold">
                      {selectedSizes.join(', ')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Custom size (e.g. 4-5Y)"
                    value={customSize}
                    onChange={(e) => setCustomSize(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSize();
                      }
                    }}
                    className="w-36 px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSize}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-md text-[11px]"
                  >
                    + Size
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {PRESET_SIZES.map((sz) => {
                  const isSelected = selectedSizes.includes(sz);
                  return (
                    <button
                      type="button"
                      key={sz}
                      onClick={() => toggleSize(sz)}
                      className={`px-2 py-0.5 rounded-md font-bold font-mono text-[11px] transition-all flex items-center gap-0.5 ${
                        isSelected
                          ? 'bg-pink-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-pink-300'
                      }`}
                    >
                      <span>{sz}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 5: Compact Split Row — Left: Season, Alert, Speed Dial | Right: GST */}
            <div className="grid grid-cols-12 gap-3">
              {/* Left 6 cols: Season, Min Stock, Speed Dial */}
              <div className="col-span-6 grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-[11px]">
                    Season / Tag
                  </label>
                  <select
                    value={formData.season}
                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-[11px]"
                  >
                    {FESTIVAL_PRESETS.map((fest) => (
                      <option key={fest} value={fest}>{fest}</option>
                    ))}
                  </select>
                  {formData.season === 'Custom' && (
                    <input
                      type="text"
                      placeholder="Custom season..."
                      value={formData.custom_season}
                      onChange={(e) => setFormData({ ...formData, custom_season: e.target.value })}
                      className="w-full mt-1 px-2 py-0.5 bg-white dark:bg-slate-900 border rounded text-[10.5px]"
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      Low Stock
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsMinStockLocked(!isMinStockLocked)}
                      className={`text-[9px] flex items-center gap-0.5 px-1 py-0.2 rounded font-bold transition-colors ${
                        isMinStockLocked
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                      title="Keep Low Stock Alert limit locked until modal is closed"
                    >
                      {isMinStockLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                      <span>{isMinStockLocked ? 'Locked' : 'Unlock'}</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    value={formData.min_stock_alert}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setFormData({ ...formData, min_stock_alert: 0 });
                        setLockedMinStockAlert(0);
                        return;
                      }
                      const parsed = parseInt(raw, 10);
                      const nextVal = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
                      setFormData({
                        ...formData,
                        min_stock_alert: nextVal
                      });
                      setLockedMinStockAlert(nextVal);
                    }}
                    className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-pink-600 rounded-lg font-mono text-[11px] focus:outline-none"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-[11px]">
                    Speed Dial
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={formData.is_speed_dial}
                      onChange={(e) => setFormData({ ...formData, is_speed_dial: e.target.checked })}
                      className="w-3.5 h-3.5 text-pink-600 rounded border-slate-300"
                    />
                    <input
                      type="text"
                      placeholder="#1 / M1"
                      value={formData.speed_dial_code}
                      disabled={!formData.is_speed_dial}
                      onChange={(e) => setFormData({ ...formData, speed_dial_code: e.target.value.toUpperCase() })}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-[11px] uppercase disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Right 6 cols: Compact GST Rates */}
              <div className="col-span-6 p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1 text-[11px]">
                    <Percent className="w-3.5 h-3.5 text-emerald-600" />
                    <span>GST Rate</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {GST_PRESETS.map((rate) => (
                      <button
                        type="button"
                        key={rate}
                        onClick={() => handleTotalGstChange(rate)}
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold font-mono transition-all ${
                          formData.gst_percent === rate
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-[10px] text-slate-400 font-bold mr-1">Total:</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.gst_percent === 0 ? '' : formData.gst_percent}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      onChange={(e) => handleTotalGstChange(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full font-mono font-bold text-right text-[11px] bg-transparent focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                  </div>

                  <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-[10px] text-slate-400 font-bold mr-1">CGST:</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cgst_percent === 0 ? '' : formData.cgst_percent}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      onChange={(e) => handleCgstChange(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full font-mono font-bold text-right text-[11px] bg-transparent focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                  </div>

                  <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-[10px] text-slate-400 font-bold mr-1">SGST:</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.sgst_percent === 0 ? '' : formData.sgst_percent}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      onChange={(e) => handleSgstChange(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full font-mono font-bold text-right text-[11px] bg-transparent focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer Submit Action */}
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
              <span>
                Margin: <strong className="text-emerald-600">{formData.margin_percent}%</strong>
              </span>
              {formData.gst_percent > 0 && formData.selling_price > 0 && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  • Tax: ₹{((formData.selling_price * formData.gst_percent) / 100).toFixed(2)}
                </span>
              )}
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
              >
                Close (Esc)
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs shadow-md shadow-pink-600/25 active:scale-95 transition-all"
              >
                {isSubmitting ? 'Saving...' : (product ? 'Update Product' : '+ Save Product (Enter)')}
              </button>
            </div>
          </div>
          </form>

          {/* Right Column: Live Barcode Print Queue Section (For Fast Continuous Entry) */}
          {!product && (
            <div className="w-80 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 relative">
              <div className="absolute inset-0 flex flex-col">
                {/* Right Panel Header + ON/OFF Toggle */}
                <div className="shrink-0 p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Barcode className="w-4 h-4 text-pink-600" />
                      <span className="font-bold text-xs text-slate-800 dark:text-white">
                        Barcode Print Queue
                      </span>
                    </div>

                    {/* ON / OFF Switch */}
                    <button
                      type="button"
                      onClick={toggleBarcodeQueueEnabled}
                      className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black transition-all flex items-center gap-1 border ${
                        isBarcodeQueueEnabled
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                      }`}
                      title="Turn ON to automatically queue barcodes whenever you save a product"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isBarcodeQueueEnabled ? 'bg-white' : 'bg-slate-400'}`} />
                      <span>{isBarcodeQueueEnabled ? 'AUTO: ON' : 'AUTO: OFF'}</span>
                    </button>
                  </div>

                  {/* 2-UP Roll Status & Start Slot Selector */}
                  <div className="flex items-center justify-between text-[10.5px] pt-1 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-center gap-1 text-slate-500">
                      <span>2-UP Start:</span>
                      <button
                        type="button"
                        onClick={() => setStartSlot('left')}
                        className={`px-1.5 py-0.2 rounded font-bold ${
                          startSlot === 'left'
                            ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        onClick={() => setStartSlot('right')}
                        className={`px-1.5 py-0.2 rounded font-bold ${
                          startSlot === 'right'
                            ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                        title="Use when left sticker on current row was already used"
                      >
                        Right 🔄
                      </button>
                    </div>

                    {barcodeQueue.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setBarcodeQueue([])}
                        className="text-rose-600 hover:text-rose-700 font-bold text-[10.5px]"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Queue Items List (Scrolls after 4-5 items; locked to form height so modal never grows) */}
                <div
                  ref={queueListRef}
                  className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 scroll-smooth"
                >
                  {barcodeQueue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-3 text-slate-400 space-y-1.5">
                      <Printer className="w-7 h-7 opacity-35" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {isBarcodeQueueEnabled ? 'Queue is Ready (ON)' : 'Auto-Queue is OFF'}
                      </p>
                      <p className="text-[10.5px] leading-relaxed">
                        {isBarcodeQueueEnabled
                          ? 'Save products on the left (Enter) — they will appear here in exact order so you can adjust qty & print all at once.'
                          : 'Switch AUTO: ON above if you want saved products to queue here for barcode printing.'}
                      </p>
                    </div>
                  ) : (
                    barcodeQueue.map((item, idx) => {
                      const secondLinePreview = [
                        formatSizeAndColor(item.size, item.color),
                        item.styleCode || '',
                        formatStickerRate(item.mrp)
                      ]
                        .filter(Boolean)
                        .join(' | ');

                      return (
                        <div
                          key={item.uid}
                          className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col gap-1.5"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="px-1.5 py-0.2 rounded bg-pink-50 dark:bg-pink-950 text-pink-600 font-mono font-black text-[10px]">
                                  #{idx + 1}
                                </span>
                                <span className="font-bold text-xs text-slate-800 dark:text-white truncate">
                                  {item.name}
                                </span>
                              </div>
                              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                                {secondLinePreview}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeQueueItem(item.uid)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Remove from queue"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60">
                            <span className="text-[10px] font-mono font-bold text-slate-500">
                              {item.barcode}
                            </span>

                            {/* Quantity Decrease / Input / Increase */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateQueueItemCopies(item.uid, -1)}
                                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold"
                                title="Decrease sticker quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.copies}
                                onFocus={(e) => e.currentTarget.select()}
                                onClick={(e) => e.currentTarget.select()}
                                onChange={(e) => updateQueueItemCopies(item.uid, parseInt(e.target.value) || 1, true)}
                                className="w-11 h-6 text-center font-mono font-black text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                              />
                              <button
                                type="button"
                                onClick={() => updateQueueItemCopies(item.uid, 1)}
                                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold"
                                title="Increase sticker quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Right Panel Bottom Print Action (Pinned flush at the bottom) */}
                <div className="mt-auto shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      Total: <strong className="text-slate-900 dark:text-white">{totalQueuedStickers} Sticker{totalQueuedStickers === 1 ? '' : 's'}</strong>
                    </span>
                    {totalQueuedStickers > 0 && (
                      <span
                        className={`font-bold text-[10.5px] px-1.5 py-0.2 rounded ${
                          (totalQueuedStickers + (startSlot === 'right' ? 1 : 0)) % 2 === 0
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {total2UpRows} Row{total2UpRows === 1 ? '' : 's'} • {(totalQueuedStickers + (startSlot === 'right' ? 1 : 0)) % 2 === 0 ? 'Full Row' : '1 Slot Open'}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={barcodeQueue.length === 0}
                    onClick={handlePrintQueuedBarcodes}
                    className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-pink-600 dark:hover:bg-pink-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md disabled:opacity-40 transition-all active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Barcodes ({totalQueuedStickers})</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

