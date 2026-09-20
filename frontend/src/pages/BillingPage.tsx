import React, { useState, useEffect } from 'react';
import { useBillingStore } from '../store/billingStore';
import { useSettingStore } from '../store/settingStore';
import { BarcodeScannerInput } from '../components/billing/BarcodeScannerInput';
import { CartItemRow } from '../components/billing/CartItemRow';
import { SpeedDialsGrid } from '../components/billing/SpeedDialsGrid';
import { UnlistedItemModal } from '../components/billing/UnlistedItemModal';
import { PaymentModal } from '../components/billing/PaymentModal';
import { ThermalReceiptView } from '../components/billing/ThermalReceiptView';
import { HeldBillsDrawer } from '../components/billing/HeldBillsDrawer';
import { formatINR } from '../utils/formatters';
import { computeExtraCharges } from '../utils/extraCharges';
import { PaymentMode } from '../types';
import api from '../utils/api';
import { 
  Plus, 
  Trash2, 
  PauseCircle, 
  Gift, 
  Banknote, 
  QrCode, 
  CreditCard, 
  User, 
  Phone, 
  Percent, 
  FileText,
  ShoppingBag,
  ListRestart,
  Zap
} from 'lucide-react';

export const BillingPage: React.FC = () => {
  const {
    tabs,
    activeTabId,
    activeItems,
    subtotal,
    discountVal,
    taxAmount,
    grandTotal,
    addTab,
    switchTab,
    closeTab,
    clearActiveCart,
    setCustomer,
    setBillDiscount,
    toggleGiftReceipt,
    setNotes
  } = useBillingStore();

  const { settings } = useSettingStore();

  const [isSpeedDialsOpen, setIsSpeedDialsOpen] = useState(false);
  const [isUnlistedModalOpen, setIsUnlistedModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalInitialMode, setPaymentModalInitialMode] = useState<PaymentMode>('UPI');
  const [selectedTenderMode, setSelectedTenderMode] = useState<PaymentMode>('UPI');
  const [isHeldDrawerOpen, setIsHeldDrawerOpen] = useState(false);
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<any>(null);
  const [thermalReceiptData, setThermalReceiptData] = useState<any>(null);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);

  // Customer Autocomplete Suggestions
  const [crmSuggestions, setCrmSuggestions] = useState<any[]>([]);
  const [showCrmDropdown, setShowCrmDropdown] = useState(false);
  const [crmSelectedIdx, setCrmSelectedIdx] = useState(-1);

  const currentTab = tabs.find(t => t.id === activeTabId);
  const items = activeItems();

  const handleCrmSearch = async (query: string, field: 'name' | 'phone') => {
    if (field === 'name') {
      setCustomer(query, currentTab?.customerPhone || '');
    } else {
      setCustomer(currentTab?.customerName || '', query);
    }

    if (query.trim().length >= 1) {
      try {
        const res = await api.get(`/customers?search=${encodeURIComponent(query.trim())}`);
        setCrmSuggestions(res.data || []);
        setShowCrmDropdown((res.data || []).length > 0);
        setCrmSelectedIdx(-1);
      } catch (err) {
        setCrmSuggestions([]);
        setShowCrmDropdown(false);
      }
    } else {
      setCrmSuggestions([]);
      setShowCrmDropdown(false);
    }
  };

  const handleSelectCrmCustomer = (c: any) => {
    setCustomer(c.name, c.phone || '');
    setShowCrmDropdown(false);
  };

  // Keyboard shortcut listener for F-keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setIsSpeedDialsOpen(prev => !prev);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsUnlistedModalOpen(true);
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleHoldBill();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (items.length > 0) {
          setPaymentModalInitialMode('CASH');
          setIsPaymentModalOpen(true);
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (items.length > 0) {
          setPaymentModalInitialMode('UPI');
          setIsPaymentModalOpen(true);
        }
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (items.length > 0) {
          setPaymentModalInitialMode('SPLIT');
          setIsPaymentModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, currentTab]);

  const handleHoldBill = async () => {
    if (items.length === 0) return;
    try {
      const payload = {
        customer_name: currentTab?.customerName || undefined,
        customer_phone: currentTab?.customerPhone || undefined,
        subtotal: subtotal(),
        discount_amount: discountVal(),
        tax_amount: taxAmount(),
        grand_total: grandTotal(),
        paid_amount: 0,
        due_amount: grandTotal(),
        is_held: true,
        items: items.map(i => ({
          product_id: i.product_id,
          item_name: i.item_name,
          barcode: i.barcode,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
          unit_price: i.unit_price,
          cost_price: i.cost_price,
          discount_amount: i.discount_amount,
          tax_percent: i.tax_percent,
          tax_amount: i.tax_amount,
          total_price: i.total_price,
          is_unlisted: i.is_unlisted
        }))
      };
      await api.post('/billing/checkout', payload);
      clearActiveCart();
      alert('Bill parked successfully. You can resume it anytime from Held Bills.');
    } catch (e) {
      console.error('Failed to park bill', e);
    }
  };

  const handlePaymentSuccess = async (invoice: any) => {
    setLastCompletedInvoice(invoice);
    try {
      const res = await api.get(`/billing/receipt/${invoice.id}?is_gift=${invoice.is_gift_receipt}`);
      setThermalReceiptData(res.data);
    } catch (e) {
      console.error('Failed to fetch receipt data', e);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden select-none p-3 space-y-3">
      {/* Top Section: Multi-Cart Tabs & Scanner Bar */}
      <div className="flex items-center justify-between gap-3">
        {/* Cart Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto max-w-xl pb-1">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl cursor-pointer text-xs font-bold transition-all ${
                tab.id === activeTabId
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>{tab.tabName}</span>
              {tab.items.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                  {tab.items.length}
                </span>
              )}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="hover:text-rose-200 text-white/70"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addTab}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-500 hover:text-pink-600 hover:bg-pink-50 transition-colors shadow-xs"
            title="New Customer Bill Tab"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Parked bills launcher */}
        <button
          onClick={() => setIsHeldDrawerOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold flex items-center space-x-1.5 hover:bg-amber-100 transition-colors"
        >
          <PauseCircle className="w-4 h-4 text-amber-500" />
          <span>Parked Bills (F5)</span>
        </button>
      </div>

      {/* Barcode & Search Bar */}
      <BarcodeScannerInput
        onOpenSpeedDials={() => setIsSpeedDialsOpen(true)}
        onOpenUnlistedModal={() => setIsUnlistedModalOpen(true)}
      />

      {/* Main Billing Workspace (Grid Layout: 70% Cart Table, 30% Checkout & Summary) */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* Left Column: Cart Items Table */}
        <div className="col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden">
          {/* Table Header */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-pink-500" />
              Billed Items ({items.length})
            </span>
            {items.length > 0 && (
              <button
                onClick={clearActiveCart}
                className="text-slate-400 hover:text-rose-600 flex items-center space-x-1 normal-case"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Bill</span>
              </button>
            )}
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-pink-50 dark:bg-slate-800 flex items-center justify-center text-pink-500">
                  <ShoppingBag className="w-8 h-8 opacity-60" />
                </div>
                <p className="text-base font-bold text-slate-600 dark:text-slate-300">
                  Cart is currently empty
                </p>
                <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed">
                  Scan barcode with USB scanner, search item name, or tap Speed Dials (F2) to add products.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3 text-center w-10">#</th>
                    <th className="py-2 px-3">Item Details</th>
                    <th className="py-2 px-3 text-right w-28">Price (₹)</th>
                    <th className="py-2 px-3 text-center w-36">Quantity</th>
                    <th className="py-2 px-3 text-right w-24">Disc (₹)</th>
                    <th className="py-2 px-3 text-right w-28">Total (₹)</th>
                    <th className="py-2 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item, index) => (
                    <CartItemRow 
                      key={item.cart_item_id} 
                      item={item} 
                      index={index} 
                      isSelected={item.cart_item_id === selectedCartItemId}
                      onSelect={() => setSelectedCartItemId(item.cart_item_id)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Customer Info, Discounts, and Pay Panel */}
        <div className="col-span-4 flex flex-col space-y-3 min-h-0">
          {/* Customer CRM Bar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-pink-500" />
                Customer CRM (Optional)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 relative">
              {/* 1. Customer Name First */}
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={currentTab?.customerName || ''}
                  onChange={(e) => handleCrmSearch(e.target.value, 'name')}
                  onFocus={() => {
                    if (currentTab?.customerName && currentTab.customerName.trim().length >= 1 && crmSuggestions.length > 0) {
                      setShowCrmDropdown(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowCrmDropdown(false), 200)}
                  onKeyDown={(e) => {
                    if (showCrmDropdown && crmSuggestions.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setCrmSelectedIdx(prev => Math.min(prev + 1, crmSuggestions.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setCrmSelectedIdx(prev => Math.max(prev - 1, 0));
                      } else if (e.key === 'Enter') {
                        if (crmSelectedIdx >= 0 && crmSelectedIdx < crmSuggestions.length) {
                          e.preventDefault();
                          handleSelectCrmCustomer(crmSuggestions[crmSelectedIdx]);
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowCrmDropdown(false);
                      }
                    }
                  }}
                  placeholder="Customer Name"
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* 2. Customer Phone Second */}
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={currentTab?.customerPhone || ''}
                  onChange={(e) => handleCrmSearch(e.target.value, 'phone')}
                  onFocus={() => {
                    if (currentTab?.customerPhone && currentTab.customerPhone.trim().length >= 1 && crmSuggestions.length > 0) {
                      setShowCrmDropdown(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowCrmDropdown(false), 200)}
                  onKeyDown={(e) => {
                    if (showCrmDropdown && crmSuggestions.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setCrmSelectedIdx(prev => Math.min(prev + 1, crmSuggestions.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setCrmSelectedIdx(prev => Math.max(prev - 1, 0));
                      } else if (e.key === 'Enter') {
                        if (crmSelectedIdx >= 0 && crmSelectedIdx < crmSuggestions.length) {
                          e.preventDefault();
                          handleSelectCrmCustomer(crmSuggestions[crmSelectedIdx]);
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setShowCrmDropdown(false);
                      }
                    }
                  }}
                  placeholder="Mobile No (10-digit)"
                  className="w-full pl-8 pr-2 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Autocomplete Dropdown List for CRM */}
              {showCrmDropdown && crmSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 animate-in fade-in zoom-in duration-100">
                  <div className="px-3 py-1 bg-slate-100 dark:bg-slate-900 text-[10px] font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 flex justify-between">
                    <span>Matched Customer (↑ ↓ ↵ to select)</span>
                    <span className="text-slate-400 font-normal">Esc to ignore</span>
                  </div>
                  {crmSuggestions.map((c, idx) => (
                    <div
                      key={c.id || idx}
                      onClick={() => handleSelectCrmCustomer(c)}
                      className={`p-2 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                        idx === crmSelectedIdx
                          ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div>
                        <span className="font-bold block text-xs">{c.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {c.phone ? `Ph: ${c.phone}` : 'No mobile'} {c.city ? `• ${c.city}` : ''}
                        </span>
                      </div>
                      {c.credit_balance > 0 ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded">
                          Khata: {formatINR(c.credit_balance)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          0 Due
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bill Financial Summary */}
          {(() => {
            const extraCharges = computeExtraCharges(subtotal(), discountVal(), selectedTenderMode, settings);
            const livePayable = Math.max(0, Math.round(subtotal() - discountVal() + taxAmount() + extraCharges.totalCharges));

            return (
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2 text-xs">
                  {/* Tender Mode Switcher */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-500">Tender:</span>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-[11px] font-bold gap-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTenderMode('UPI')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          selectedTenderMode === 'UPI'
                            ? 'bg-pink-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        UPI QR (F9)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTenderMode('CASH')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          selectedTenderMode === 'CASH'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Cash (F8)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTenderMode('SPLIT')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          selectedTenderMode === 'SPLIT'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Split (F10)
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                      {formatINR(subtotal())}
                    </span>
                  </div>

                  {/* Bill Discount Input */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-rose-500" />
                      Bill Discount:
                    </span>
                    <div className="flex items-center space-x-1">
                      <span className="text-slate-400">-₹</span>
                      <input
                        type="number"
                        value={currentTab?.discountAmount || ''}
                        placeholder="0"
                        onChange={(e) => setBillDiscount(parseFloat(e.target.value) || 0, 'FLAT')}
                        className="w-20 px-2 py-1 text-right text-xs font-bold text-rose-600 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-pink-500"
                        min="0"
                      />
                    </div>
                  </div>

                  {taxAmount() > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>GST Tax:</span>
                      <span className="font-semibold font-mono">{formatINR(taxAmount())}</span>
                    </div>
                  )}

                  {/* Applied Surcharges / Extra Charges Breakdown */}
                  {extraCharges.appliedCharges.length > 0 && (
                    <div className="space-y-1 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-700">
                      {extraCharges.appliedCharges.map((ec, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs text-amber-600 dark:text-amber-400 font-bold">
                          <span className="flex items-center gap-1 truncate max-w-[170px]" title={ec.description}>
                            <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                            {ec.name} ({ec.formattedRate}):
                          </span>
                          <span className="font-mono font-bold shrink-0">+₹{ec.chargeAmount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grand Total Display */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-lg shadow-slate-900/10 text-center">
                  <div className="flex items-center justify-center space-x-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-pink-400">
                      Total Payable ({selectedTenderMode === 'UPI' ? 'UPI / Online' : selectedTenderMode === 'CASH' ? 'Cash' : selectedTenderMode})
                    </span>
                    {extraCharges.totalCharges > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black">
                        +{formatINR(extraCharges.totalCharges)}
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-black font-mono tracking-tight mt-0.5">
                    {formatINR(livePayable)}
                  </div>
                </div>

                {/* Quick Action Payment Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => {
                      setPaymentModalInitialMode(selectedTenderMode);
                      setIsPaymentModalOpen(true);
                    }}
                    disabled={items.length === 0}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-500 hover:to-rose-500 text-white font-extrabold text-base shadow-xl shadow-pink-600/30 flex items-center justify-center space-x-2 transition-all active:scale-98 disabled:opacity-40"
                  >
                    <QrCode className="w-5 h-5" />
                    <span>PAY &amp; PRINT BILL ({selectedTenderMode === 'CASH' ? 'F8' : selectedTenderMode === 'UPI' ? 'F9' : 'F10'})</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleHoldBill}
                      disabled={items.length === 0}
                      className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-40"
                    >
                      <PauseCircle className="w-4 h-4 text-amber-500" />
                      <span>Hold Bill (F5)</span>
                    </button>

                    <button
                      onClick={clearActiveCart}
                      disabled={items.length === 0}
                      className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-40"
                    >
                      <ListRestart className="w-4 h-4 text-rose-500" />
                      <span>Reset Cart</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Modals & Drawers */}
      <SpeedDialsGrid
        isOpen={isSpeedDialsOpen}
        onClose={() => setIsSpeedDialsOpen(false)}
      />

      <UnlistedItemModal
        isOpen={isUnlistedModalOpen}
        onClose={() => setIsUnlistedModalOpen(false)}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
        initialMode={paymentModalInitialMode}
      />

      <HeldBillsDrawer
        isOpen={isHeldDrawerOpen}
        onClose={() => setIsHeldDrawerOpen(false)}
        onResumeBill={(billData) => {
          // Resume bill items into active cart
          billData.items.forEach((item: any) => {
            useBillingStore.getState().addItem({
              id: item.product_id,
              name: item.item_name,
              barcode: item.barcode,
              size: item.size,
              color: item.color,
              selling_price: item.unit_price,
              purchase_price: item.cost_price,
              stock_quantity: 99
            }, item.quantity);
          });
        }}
      />

      {thermalReceiptData && (
        <ThermalReceiptView
          receiptData={thermalReceiptData}
          onClose={() => setThermalReceiptData(null)}
        />
      )}
    </div>
  );
};
