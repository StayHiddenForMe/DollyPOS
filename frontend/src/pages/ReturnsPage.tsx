import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { Product } from '../types';
import { useSettingStore } from '../store/settingStore';
import { 
  RotateCcw, 
  Search, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  AlertCircle,
  Receipt,
  Sparkles,
  X,
  History,
  FileText,
  ArrowRightLeft,
  Share2
} from 'lucide-react';
import { formatINR, playSuccessChime, formatISTDate } from '../utils/formatters';

interface ReturnItemState {
  product_id: number;
  item_name: string;
  barcode: string;
  size?: string;
  color?: string;
  quantity: number;
  max_quantity: number;
  unit_price: number;
  selected: boolean;
  is_defective: boolean;
}

interface ExchangeItemState {
  product: Product;
  quantity: number;
  unit_price: number;
}

export const ReturnsPage: React.FC = () => {
  const { settings, fetchSettings } = useSettingStore();
  const [activeTab, setActiveTab] = useState<'NEW_EXCHANGE' | 'HISTORY'>('NEW_EXCHANGE');

  useEffect(() => {
    fetchSettings();
  }, []);

  // Compute dynamic today's date formatted placeholder and monthly prefix
  const getTodayDateStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const getMonthPrefix = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `DLY-${year}${month}`;
  };

  const todayPlaceholder = `DLY-${getTodayDateStr()}-0001`;

  const [billSearch, setBillSearch] = useState(getMonthPrefix());
  const [loadingBill, setLoadingBill] = useState(false);
  const [billData, setBillData] = useState<any | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemState[]>([]);

  // Replacement Exchange Items
  const [exchangeItems, setExchangeItems] = useState<ExchangeItemState[]>([]);

  // Searchable Replacement Item State
  const [replacementQuery, setReplacementQuery] = useState('');
  const [replacementResults, setReplacementResults] = useState<Product[]>([]);

  // Searchable Walk-in Return Item State
  const [walkinQuery, setWalkinQuery] = useState('');
  const [walkinResults, setWalkinResults] = useState<Product[]>([]);

  // Customer & Settlement
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [settlementMode, setSettlementMode] = useState<'CASH' | 'UPI' | 'CREDIT_KHATA'>('CASH');
  const [returnReason, setReturnReason] = useState('Size/Color Exchange');
  const [isProcessing, setIsProcessing] = useState(false);
  const [exchangeReceipt, setExchangeReceipt] = useState<any | null>(null);

  // History State
  const [returnsHistory, setReturnsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Fetch History when switching tab
  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchReturnsHistory();
    }
  }, [activeTab]);

  // Keyboard Navigation: Enter to Print, Escape to Close
  useEffect(() => {
    if (!exchangeReceipt) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setExchangeReceipt(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exchangeReceipt]);

  const fetchReturnsHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/returns/history?limit=100');
      setReturnsHistory(res.data);
    } catch (e) {
      console.error('Failed to fetch returns history', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Debounced search for Replacement Products (Matches Speed Dials & Names)
  useEffect(() => {
    if (!replacementQuery.trim()) {
      setReplacementResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/inventory/search?q=${encodeURIComponent(replacementQuery.trim())}&limit=10`);
        setReplacementResults(res.data);
      } catch (e) {
        setReplacementResults([]);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [replacementQuery]);

  // Debounced search for Walk-in Return Products (Matches Speed Dials & Names)
  useEffect(() => {
    if (!walkinQuery.trim()) {
      setWalkinResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/inventory/search?q=${encodeURIComponent(walkinQuery.trim())}&limit=10`);
        setWalkinResults(res.data);
      } catch (e) {
        setWalkinResults([]);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [walkinQuery]);

  const handleSearchBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billSearch.trim()) return;

    setLoadingBill(true);
    setBillData(null);
    try {
      const res = await api.get(`/billing/by-number/${encodeURIComponent(billSearch.trim())}`);
      setBillData(res.data);
      setCustomerName(res.data.customer_name || '');
      setCustomerPhone(res.data.customer_phone || '');

      const items: ReturnItemState[] = res.data.items.map((i: any) => ({
        product_id: i.product_id,
        item_name: i.item_name,
        barcode: i.barcode,
        size: i.size,
        color: i.color,
        quantity: 1,
        max_quantity: i.quantity,
        unit_price: i.unit_price,
        selected: false,
        is_defective: false
      }));
      setReturnItems(items);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Bill not found. Check bill number.');
    } finally {
      setLoadingBill(false);
    }
  };

  const handleSelectReplacementProduct = (prod: Product) => {
    const existing = exchangeItems.find(e => e.product.id === prod.id);
    if (existing) {
      setExchangeItems(exchangeItems.map(e => e.product.id === prod.id ? { ...e, quantity: e.quantity + 1 } : e));
    } else {
      setExchangeItems([...exchangeItems, { product: prod, quantity: 1, unit_price: prod.selling_price }]);
    }
    setReplacementQuery('');
    setReplacementResults([]);
  };

  const handleReplacementKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && replacementResults.length > 0) {
      e.preventDefault();
      handleSelectReplacementProduct(replacementResults[0]);
    }
  };

  const handleSelectWalkinReturnProduct = (prod: Product) => {
    const existing = returnItems.find(r => r.product_id === prod.id);
    if (existing) {
      setReturnItems(returnItems.map(r => r.product_id === prod.id ? { ...r, quantity: r.quantity + 1, selected: true } : r));
    } else {
      setReturnItems([...returnItems, {
        product_id: prod.id,
        item_name: prod.name,
        barcode: prod.barcode,
        size: prod.size,
        color: prod.color,
        quantity: 1,
        max_quantity: 99,
        unit_price: prod.selling_price,
        selected: true,
        is_defective: false
      }]);
    }
    setWalkinQuery('');
    setWalkinResults([]);
  };

  const handleWalkinKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && walkinResults.length > 0) {
      e.preventDefault();
      handleSelectWalkinReturnProduct(walkinResults[0]);
    }
  };

  const toggleReturnItem = (idx: number) => {
    setReturnItems(returnItems.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
  };

  const selectedReturns = returnItems.filter(r => r.selected);
  const totalReturnValue = selectedReturns.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const totalExchangeValue = exchangeItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const netDifference = totalExchangeValue - totalReturnValue;

  const handleProcessExchange = async () => {
    if (selectedReturns.length === 0 && exchangeItems.length === 0) {
      alert('Please select items to return or exchange');
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        original_bill_number: billData?.bill_number || undefined,
        invoice_id: billData?.id || undefined,
        customer_name: customerName || 'Walk-in Customer',
        customer_phone: customerPhone || undefined,
        returned_items: selectedReturns.map(r => ({
          product_id: r.product_id,
          item_name: r.item_name,
          barcode: r.barcode,
          quantity: r.quantity,
          refund_price: r.unit_price,
          is_defective: r.is_defective
        })),
        exchange_items: exchangeItems.map(e => ({
          product_id: e.product.id,
          quantity: e.quantity,
          unit_price: e.unit_price
        })),
        total_returned_value: totalReturnValue,
        total_new_items_value: totalExchangeValue,
        net_difference: netDifference,
        settlement_mode: settlementMode,
        reason: returnReason
      };

      const res = await api.post('/returns/process-exchange', payload);
      playSuccessChime();
      
      setExchangeReceipt({
        return_number: res.data.return_number,
        original_bill_number: billData?.bill_number,
        new_bill_number: res.data.new_bill_number,
        action: res.data.action,
        customer_name: customerName || 'Walk-in Customer',
        customer_phone: customerPhone,
        returned_items: selectedReturns,
        exchange_items: exchangeItems,
        total_returned_value: totalReturnValue,
        total_new_items_value: totalExchangeValue,
        net_difference: netDifference,
        settlement_mode: settlementMode,
        reason: returnReason,
        date: formatISTDate(new Date())
      });

      // Reset Form
      setBillData(null);
      setReturnItems([]);
      setExchangeItems([]);
      setBillSearch(getMonthPrefix());
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to process return and exchange');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredHistory = returnsHistory.filter((ret) => {
    const q = historySearch.toLowerCase();
    return (
      ret.return_number?.toLowerCase().includes(q) ||
      ret.reason?.toLowerCase().includes(q) ||
      ret.return_type?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Top Header & Tab Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-pink-500" />
            Returns & Size/Product Exchange Engine
          </h1>
          <p className="text-xs text-slate-500">
            Speed Dial compatible • Auto-prefilled prefix • Walk-in return • Replacement selection • Standard Thermal Bill.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <button
            onClick={() => setActiveTab('NEW_EXCHANGE')}
            className={`px-4 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all ${
              activeTab === 'NEW_EXCHANGE'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Process Return & Exchange</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all ${
              activeTab === 'HISTORY'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Return Bills Ledger</span>
          </button>
        </div>
      </div>

      {activeTab === 'NEW_EXCHANGE' ? (
        <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
          {/* Left Column: Bill Search & Items to Return */}
          <div className="col-span-6 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 overflow-hidden">
            {/* Bill Search Form with Dynamic Today's Placeholder */}
            <form onSubmit={handleSearchBill} className="flex gap-2 text-xs">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                  placeholder={todayPlaceholder}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono focus:outline-none focus:border-pink-500 font-bold"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loadingBill}
                className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors"
              >
                {loadingBill ? 'Searching...' : 'Search Bill'}
              </button>
            </form>

            {/* Searchable Walk-in Return (Supports Speed Dials e.g. 1, M10, or Barcode/Name) */}
            <div className="relative text-xs">
              <input
                type="text"
                value={walkinQuery}
                onChange={(e) => setWalkinQuery(e.target.value)}
                onKeyDown={handleWalkinKeyDown}
                placeholder="Walk-in return: Type Speed Dial (e.g. 1, M10) or Name & hit Enter..."
                className="w-full px-3 py-2 bg-pink-50/50 dark:bg-slate-800 border border-pink-200 rounded-xl font-mono focus:outline-none"
              />
              {walkinResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl border shadow-xl z-50 max-h-48 overflow-y-auto divide-y">
                  {walkinResults.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectWalkinReturnProduct(prod)}
                      className="p-2 hover:bg-pink-50 cursor-pointer flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-1.5">
                          {prod.speed_dial_code && (
                            <span className="px-1.5 py-0.5 rounded bg-pink-600 text-white font-black text-[10px]">
                              ⚡ {prod.speed_dial_code}
                            </span>
                          )}
                          <span className="font-bold">{prod.name} ({prod.size || 'No Size'} • {prod.color || 'No Color'})</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">Barcode: {prod.barcode}</span>
                      </div>
                      <span className="font-bold text-pink-600 font-mono">{formatINR(prod.selling_price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Returned Items List */}
            <div className="flex-1 overflow-y-auto border rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
              {returnItems.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  Search a bill or use the search bar above with speed dial (e.g. 1, M10) to select items to return.
                </div>
              ) : (
                returnItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleReturnItem(idx)}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                      item.selected ? 'bg-pink-50 dark:bg-pink-950/30' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      {item.selected ? (
                        <CheckSquare className="w-4 h-4 text-pink-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold text-slate-800 dark:text-white block">
                          {item.item_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Size: {item.size || 'N/A'} • Color: {item.color || 'N/A'} • Barcode: {item.barcode}
                        </span>
                      </div>
                    </div>

                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                      <span className="font-mono font-bold text-slate-800 dark:text-white block">
                        {formatINR(item.unit_price)}
                      </span>
                      <label className="text-[10px] text-rose-600 flex items-center gap-1 mt-0.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.is_defective}
                          onChange={(e) => {
                            setReturnItems(returnItems.map((r, i) => i === idx ? { ...r, is_defective: e.target.checked } : r));
                          }}
                          className="rounded"
                        />
                        <span>Defective / Damaged</span>
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">Total Return Credit:</span>
              <span className="text-base font-black font-mono text-pink-600">{formatINR(totalReturnValue)}</span>
            </div>
          </div>

          {/* Right Column: Searchable Replacement Exchange Items (Supports Speed Dials) */}
          <div className="col-span-6 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-xs uppercase text-slate-400 tracking-wider">
                Add Replacement Exchange Items
              </h2>
              <span className="text-[11px] font-bold text-slate-500">
                {exchangeItems.length} Replacement Item(s)
              </span>
            </div>

            {/* Searchable Replacement Product Input (Speed Dials Supported) */}
            <div className="relative text-xs">
              <input
                type="text"
                value={replacementQuery}
                onChange={(e) => setReplacementQuery(e.target.value)}
                onKeyDown={handleReplacementKeyDown}
                placeholder="Replacement: Type Speed Dial (e.g. 1, M10) or Name & hit Enter..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-emerald-400 rounded-xl font-mono focus:outline-none"
              />
              {replacementResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl border shadow-xl z-50 max-h-48 overflow-y-auto divide-y">
                  {replacementResults.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectReplacementProduct(prod)}
                      className="p-2 hover:bg-emerald-50 cursor-pointer flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-1.5">
                          {prod.speed_dial_code && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px]">
                              ⚡ {prod.speed_dial_code}
                            </span>
                          )}
                          <span className="font-bold">{prod.name} ({prod.size || 'No Size'} • {prod.color || 'No Color'})</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">Barcode: {prod.barcode} • Stock: {prod.stock_quantity} pcs</span>
                      </div>
                      <span className="font-bold text-emerald-600 font-mono">{formatINR(prod.selling_price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exchange Items Cart */}
            <div className="flex-1 overflow-y-auto border rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
              {exchangeItems.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  Search and add replacement items with speed dial or name if customer is exchanging for another item.
                </div>
              ) : (
                exchangeItems.map((ex, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block">
                        {ex.product.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Size: {ex.product.size || 'N/A'} • Color: {ex.product.color || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="font-mono font-bold">{formatINR(ex.unit_price * ex.quantity)}</span>
                      <button
                        onClick={() => setExchangeItems(exchangeItems.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Net Settlement Calculation */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border space-y-2 text-xs">
              <div className="flex justify-between font-semibold text-slate-600">
                <span>New Items Total:</span>
                <span className="font-mono">{formatINR(totalExchangeValue)}</span>
              </div>
              <div className="flex justify-between font-semibold text-slate-600">
                <span>Less Return Credit:</span>
                <span className="font-mono text-pink-600">- {formatINR(totalReturnValue)}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between items-center">
                <span className="font-black text-sm">
                  {netDifference > 0 ? 'Collect from Customer:' : (netDifference < 0 ? 'Refund to Customer:' : 'Even Exchange:')}
                </span>
                <span className={`text-xl font-black font-mono ${
                  netDifference > 0 ? 'text-pink-600' : (netDifference < 0 ? 'text-emerald-600' : 'text-slate-800')
                }`}>
                  {formatINR(Math.abs(netDifference))}
                </span>
              </div>
            </div>

            {/* Settle Button */}
            <button
              onClick={handleProcessExchange}
              disabled={isProcessing || (selectedReturns.length === 0 && exchangeItems.length === 0)}
              className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? 'Processing Exchange...' : 'Complete Exchange & Print Bill'}
            </button>
          </div>
        </div>
      ) : (
        /* Returns & Exchange Ledger / History Tab */
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="relative w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search Return Voucher # (e.g. RET-2026)..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-mono"
              />
            </div>

            <button
              onClick={fetchReturnsHistory}
              className="px-3 py-1.5 rounded-xl border text-xs font-bold hover:bg-slate-50 text-slate-600"
            >
              Refresh History
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Return No</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Items Returned</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3 text-right">Refund / Credit (₹)</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadingHistory ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading returns history...</td></tr>
                ) : filteredHistory.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">No return orders found</td></tr>
                ) : (
                  filteredHistory.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-pink-600">{ret.return_number}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{formatISTDate(ret.created_at)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-pink-50 text-pink-700 rounded-full font-bold text-[10px]">
                          {ret.return_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {ret.items?.map((i: any) => `${i.item_name} x${i.quantity}`).join(', ') || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{ret.reason || 'Customer Request'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">{formatINR(ret.total_refund_amount)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => {
                            setExchangeReceipt({
                              return_number: ret.return_number,
                              original_bill_number: ret.invoice_id ? `Bill #${ret.invoice_id}` : 'Walk-in',
                              new_bill_number: null,
                              customer_name: 'Customer',
                              returned_items: ret.items || [],
                              exchange_items: [],
                              total_returned_value: ret.total_refund_amount,
                              total_new_items_value: 0,
                              net_difference: -ret.total_refund_amount,
                              settlement_mode: 'CASH',
                              reason: ret.reason,
                              date: formatISTDate(ret.created_at)
                            });
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg font-bold text-[11px] text-slate-700 dark:text-slate-300"
                        >
                          Reprint Bill
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

      {/* Return & Exchange Thermal Bill Print Modal (Matching Main Thermal Receipt View) */}
      {exchangeReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-150">
          <style>{`
            @media print {
              @page {
                margin: 0mm !important;
                size: 80mm auto;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body * {
                visibility: hidden !important;
              }
              #printable-voucher, #printable-voucher * {
                visibility: visible !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                border-color: #000000 !important;
              }
              #printable-voucher {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 80mm !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 1mm 2mm 1mm !important;
                font-weight: 600 !important;
                box-sizing: border-box !important;
              }
            }
          `}</style>

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <Printer className="w-4 h-4 text-pink-500" />
                Return & Exchange Bill (80mm)
              </h3>
              <button onClick={() => setExchangeReceipt(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Close (Esc)">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Thermal Container matching Main Receipt */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950 flex justify-center">
              <div 
                id="printable-voucher" 
                className="w-full max-w-[80mm] min-h-fit bg-white text-black px-[3px] pt-1.5 pb-3 font-mono text-[11px] leading-tight border border-slate-300 shadow-md flex flex-col box-border"
              >
                {/* Shop Header */}
                <div className="text-center pb-1 space-y-0.5">
                  <h2 className="font-black text-[16px] uppercase tracking-wide text-black leading-snug mt-[2px]">
                    {(settings?.shop_name || 'Dolly Toys & Kids Wear').replace(/\band\b/gi, '&')}
                  </h2>
                  {settings?.tag_line && (
                    <p 
                      className={`text-[10px] text-black italic ${settings?.is_tagline_bold ? 'font-black tracking-tight' : 'font-semibold'}`}
                      style={settings?.is_tagline_bold ? { fontWeight: 900, WebkitTextStroke: '0.4px #000' } : {}}
                    >
                      {settings?.is_tagline_bold ? <strong>{settings.tag_line}</strong> : settings.tag_line}
                    </p>
                  )}
                  <p className="text-[10.5px] font-bold text-black mt-[5px] mb-[5px] leading-tight">{settings?.address || 'Agra Road, Near Mahatma Gandhi Statue, Dhule'}</p>
                  {settings?.mobile && (
                    <p className="text-[11px] font-bold text-black mt-[2px]">Mob: {settings.mobile}</p>
                  )}
                  {settings?.show_gst_on_bill && settings?.gstin && (
                    <p className="text-[10.5px] font-bold text-black my-[3px] uppercase tracking-wider bg-slate-100 py-0.5">
                      GSTIN: {settings.gstin}
                    </p>
                  )}
                </div>

                {/* Title: Invoice Details */}
                <div className="border-t border-dashed border-black my-1"></div>
                <div className="text-center font-black uppercase text-[11px] tracking-wider text-black py-0.5">
                  Invoice Details
                </div>
                <div className="border-t border-dashed border-black my-1"></div>

                {/* Bill Details */}
                <div className="py-1 border-b border-dashed border-black space-y-0.5 text-[10.5px] font-semibold text-black">
                  <div className="flex justify-between">
                    <span>Bill No: <strong className="font-black text-black">{exchangeReceipt.return_number}</strong></span>
                    <span className="font-bold text-black">
                      {exchangeReceipt.date ? exchangeReceipt.date.replace(',', '').split(' ')[0] : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time: <span className="font-bold text-black">
                      {exchangeReceipt.date ? exchangeReceipt.date.replace(',', '').split(' ').slice(1).join(' ') : ''}
                    </span></span>
                    <span>Mode: <strong className="font-black text-black">{exchangeReceipt.settlement_mode}</strong></span>
                  </div>
                  {exchangeReceipt.original_bill_number && (
                    <div className="flex justify-between pt-0.5">
                      <span>Orig Bill: <strong className="font-bold text-black">{exchangeReceipt.original_bill_number}</strong></span>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div className="py-1.5 border-b border-dashed border-black">
                  <div className="flex justify-between font-black pb-1 text-[10.5px] uppercase text-black">
                    <span className="flex-1 min-w-0 pr-1 text-left">Item</span>
                    <span className="w-7 text-center shrink-0">Qty</span>
                    <span className="w-12 text-right shrink-0">Rate</span>
                    <span className="w-14 text-right shrink-0">Total</span>
                  </div>
                  {/* Divider Line immediately after column headers */}
                  <div className="border-b border-dashed border-black mb-1"></div>

                  <div className="divide-y divide-dotted divide-black">
                    {/* Returned Goods (Negative Credit) */}
                    {exchangeReceipt.returned_items.map((r: any, idx: number) => {
                      const price = r.unit_price || r.refund_price || 0;
                      return (
                        <div key={`ret-${idx}`} className="py-1 flex justify-between items-start text-[10.5px] text-black">
                          <div className="flex-1 min-w-0 pr-1 flex flex-col text-left">
                            <span className="font-bold text-black line-clamp-2 leading-tight break-words">[RETURN] {r.item_name}</span>
                            {(r.size || r.color) && (
                              <span className="text-[10px] font-semibold text-black">
                                {r.size ? `Sz:${r.size} ` : ''}{r.color ? `Col:${r.color}` : ''}
                              </span>
                            )}
                          </div>
                          <span className="w-7 text-center font-bold text-black shrink-0">{r.quantity}</span>
                          <span className="w-12 text-right font-medium text-black shrink-0">₹{price}</span>
                          <span className="w-14 text-right font-bold text-black shrink-0">-₹{price * r.quantity}</span>
                        </div>
                      );
                    })}

                    {/* Replacement Goods (Positive Amount) */}
                    {exchangeReceipt.exchange_items.map((e: any, idx: number) => {
                      const name = e.product ? e.product.name : e.item_name;
                      const size = e.product?.size || e.size;
                      const color = e.product?.color || e.color;
                      return (
                        <div key={`ex-${idx}`} className="py-1 flex justify-between items-start text-[10.5px] text-black">
                          <div className="flex-1 min-w-0 pr-1 flex flex-col text-left">
                            <span className="font-bold text-black line-clamp-2 leading-tight break-words">[EXCH] {name}</span>
                            {(size || color) && (
                              <span className="text-[10px] font-semibold text-black">
                                {size ? `Sz:${size} ` : ''}{color ? `Col:${color}` : ''}
                              </span>
                            )}
                          </div>
                          <span className="w-7 text-center font-bold text-black shrink-0">{e.quantity}</span>
                          <span className="w-12 text-right font-medium text-black shrink-0">₹{e.unit_price}</span>
                          <span className="w-14 text-right font-bold text-black shrink-0">+₹{e.unit_price * e.quantity}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px] text-black font-semibold">
                  <div className="flex justify-between">
                    <span>Return Credit:</span>
                    <span className="font-bold text-black">- {formatINR(exchangeReceipt.total_returned_value)}</span>
                  </div>
                  {exchangeReceipt.total_new_items_value > 0 && (
                    <div className="flex justify-between">
                      <span>New Exchange Items:</span>
                      <span className="font-bold text-black">+ {formatINR(exchangeReceipt.total_new_items_value)}</span>
                    </div>
                  )}

                  {/* Net Settlement */}
                  <div className="flex justify-between items-center font-black text-[13px] pt-1.5 border-t border-black text-black">
                    <span>NET SETTLEMENT:</span>
                    <span>
                      {exchangeReceipt.net_difference > 0
                        ? `Collected: ${formatINR(exchangeReceipt.net_difference)}`
                        : (exchangeReceipt.net_difference < 0 ? `Refunded: ${formatINR(Math.abs(exchangeReceipt.net_difference))}` : '₹0.00 (Even)')}
                    </span>
                  </div>

                  {/* No of items & Total Quantity */}
                  <div className="border-t border-dotted border-black pt-1.5 mt-1 text-[11px] font-bold text-black flex justify-between">
                    <span>No of items : <strong className="font-black text-black">{(exchangeReceipt.returned_items?.length || 0) + (exchangeReceipt.exchange_items?.length || 0)}</strong></span>
                    <span>Total Quantity : <strong className="font-black text-black">{(exchangeReceipt.returned_items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0) + (exchangeReceipt.exchange_items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0)}</strong></span>
                  </div>
                </div>

                {/* Follow Us Section */}
                {(settings?.show_instagram_on_bill || settings?.show_facebook_on_bill || settings?.show_threads_on_bill || settings?.show_website_on_bill || settings?.show_custom_social_on_bill || settings?.show_custom_social_on_bill2 || settings?.show_custom_social_on_bill3 || settings?.show_custom_social_on_bill4 || settings?.show_custom_social_on_bill5) && (
                  <div className="py-2 border-b border-dashed border-black text-[10.5px] text-black">
                    <span className="font-black text-[10.5px] uppercase tracking-wider block text-center mb-1 text-black">Follow Us</span>
                    <div className="space-y-1 w-full text-left px-1">
                      {settings?.show_instagram_on_bill && settings?.instagram_handle && (
                        <div className="flex items-start py-0.5">
                          <span className="font-bold text-black shrink-0">Instagram:</span>
                          <span className="font-semibold text-black ml-1 break-all flex-1">{settings.instagram_handle}</span>
                        </div>
                      )}
                      {settings?.show_facebook_on_bill && settings?.facebook_handle && (
                        <div className="flex items-start py-0.5">
                          <span className="font-bold text-black shrink-0">Facebook:</span>
                          <span className="font-semibold text-black ml-1 break-all flex-1">{settings.facebook_handle}</span>
                        </div>
                      )}
                      {settings?.show_threads_on_bill && settings?.threads_handle && (
                        <div className="flex items-start py-0.5">
                          <span className="font-bold text-black shrink-0">Threads:</span>
                          <span className="font-semibold text-black ml-1 break-all flex-1">{settings.threads_handle}</span>
                        </div>
                      )}
                      {settings?.show_website_on_bill && settings?.website_url && (
                        <div className="flex items-start py-0.5">
                          <span className="font-bold text-black shrink-0">Website:</span>
                          <span className="font-semibold text-black ml-1 break-all flex-1">{settings.website_url}</span>
                        </div>
                      )}
                      {settings?.show_custom_social_on_bill && settings?.custom_social_handle && (
                        <div className="flex items-start py-0.5">
                          <span className="font-bold text-black shrink-0">{settings.custom_social_label || 'Social'}:</span>
                          <span className="font-semibold text-black ml-1 break-all flex-1">{settings.custom_social_handle}</span>
                        </div>
                      )}
                      {settings?.show_custom_social_on_bill2 && settings?.custom_social_handle2 && (
                        <div className="flex items-start py-0.5">
                          <span className="font-bold text-black shrink-0">{settings.custom_social_label2 || 'Social 2'}:</span>
                          <span className="font-semibold text-black ml-1 break-all flex-1">{settings.custom_social_handle2}</span>
                        </div>
                      )}
                      {settings?.show_custom_social_on_bill3 && settings?.custom_social_handle3 && (
                        <div className="flex items-start py-0.5">
                          <span className="font-bold text-black shrink-0">{settings.custom_social_label3 || 'Social 3'}:</span>
                          <span className="font-semibold text-black ml-1 break-all flex-1">{settings.custom_social_handle3}</span>
                        </div>
                      )}
                      {settings?.show_custom_social_on_bill4 && settings?.custom_social_handle4 && (
                        <div className="flex items-start py-0.5">
                          <span className="font-bold text-black shrink-0">{settings.custom_social_label4 || 'Social 4'}:</span>
                          <span className="font-semibold text-black ml-1 break-all flex-1">{settings.custom_social_handle4}</span>
                        </div>
                      )}
                      {settings?.show_custom_social_on_bill5 && settings?.custom_social_handle5 && (
                        <div className="flex items-start py-0.5">
                          <span className="font-bold text-black shrink-0">{settings.custom_social_label5 || 'Social 5'}:</span>
                          <span className="font-semibold text-black ml-1 break-all flex-1">{settings.custom_social_handle5}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Terms & Conditions */}
                {settings?.show_terms_on_bill && settings?.terms_and_conditions && (
                  <div className="py-2 text-left text-[9.5px] text-black border-b border-dashed border-black space-y-0.5 font-medium">
                    <span className="font-black uppercase tracking-wider block text-center text-[10px] text-black">Terms & Conditions</span>
                    <p className="whitespace-pre-line leading-tight text-black font-semibold">{settings.terms_and_conditions}</p>
                  </div>
                )}

                {/* Bill Footer: Software powered by Dolly POS and Since 2002 on EXACT SAME SINGLE LINE */}
                <div className="text-center pt-2.5 text-black space-y-1 font-semibold">
                  <p 
                    className={`italic text-black ${settings?.is_footer_bold ? 'font-black' : 'font-bold'}`}
                    style={{ 
                      fontSize: settings?.footer_font_size || '9.5px', 
                      lineHeight: 1.15,
                      fontWeight: settings?.is_footer_bold ? 900 : 700,
                      WebkitTextStroke: settings?.is_footer_bold ? '0.35px #000' : 'none'
                    }}
                  >
                    {settings?.is_footer_bold ? <strong>{settings?.bill_footer || 'Thank you for shopping at Dolly Toys & Kids Wear!'}</strong> : (settings?.bill_footer || 'Thank you for shopping at Dolly Toys & Kids Wear!')}
                  </p>
                  <p 
                    className={`pt-1 text-black flex items-center justify-center space-x-1.5 ${settings?.is_power_footer_bold ? 'font-black' : 'font-bold'}`}
                    style={{
                      fontSize: settings?.power_footer_font_size || '9px',
                      fontWeight: settings?.is_power_footer_bold ? 900 : 600,
                      WebkitTextStroke: settings?.is_power_footer_bold ? '0.3px #000' : 'none'
                    }}
                  >
                    <span>Software powered by Dolly POS©</span>
                    <span>|</span>
                    <span className="font-black">Since 2002</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
              <button
                onClick={() => setExchangeReceipt(null)}
                className="px-4 py-2 border rounded-xl font-bold text-xs"
              >
                Close (Esc)
              </button>

              <button
                onClick={() => window.print()}
                className="px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-pink-600/30 active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Print Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
