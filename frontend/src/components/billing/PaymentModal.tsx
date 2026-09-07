import React, { useState, useEffect } from 'react';
import { useBillingStore } from '../../store/billingStore';
import { useSettingStore } from '../../store/settingStore';
import api from '../../utils/api';
import { PaymentMode } from '../../types';
import { 
  Banknote, 
  QrCode, 
  CreditCard, 
  Users, 
  Printer, 
  CheckCircle2, 
  X, 
  IndianRupee,
  Share2
} from 'lucide-react';
import { formatINR, playSuccessChime } from '../../utils/formatters';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (invoice: any) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess
}) => {
  const { 
    activeItems, 
    subtotal, 
    discountVal, 
    taxAmount, 
    grandTotal, 
    tabs, 
    activeTabId, 
    clearActiveCart,
    setBillDiscount 
  } = useBillingStore();
  
  const { settings } = useSettingStore();

  const total = grandTotal();
  const currentTab = tabs.find(t => t.id === activeTabId);

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [tenderAmount, setTenderAmount] = useState<number>(total);
  const [creditCustomerName, setCreditCustomerName] = useState<string>(currentTab?.customerName || '');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState<string>(currentTab?.customerPhone || '');
  const [creditPaidNow, setCreditPaidNow] = useState<number>(0);
  const [creditPaidMode, setCreditPaidMode] = useState<'CASH' | 'UPI'>('CASH');
  const [upiQrData, setUpiQrData] = useState<any>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Customer Autocomplete Dropdown State
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);

  // Set initial tender amount and customer info when modal opens
  useEffect(() => {
    if (isOpen) {
      setTenderAmount(total);
      setCreditPaidNow(0);
      setCreditCustomerName(currentTab?.customerName || '');
      setCreditCustomerPhone(currentTab?.customerPhone || '');
      setShowSuggestions(false);
      if (paymentMode === 'UPI') {
        loadUpiQr();
      }
    }
  }, [isOpen, total, paymentMode, currentTab]);

  // Close modal on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  const handleCustomerNameChange = async (val: string) => {
    setCreditCustomerName(val);
    if (val.trim().length >= 1) {
      try {
        const res = await api.get(`/customers?search=${encodeURIComponent(val.trim())}`);
        setCustomerSuggestions(res.data || []);
        setShowSuggestions((res.data || []).length > 0);
        setSelectedSuggestionIdx(-1);
      } catch (err) {
        setCustomerSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectCustomer = (c: any) => {
    setCreditCustomerName(c.name);
    setCreditCustomerPhone(c.phone || '');
    setShowSuggestions(false);
  };

  const loadUpiQr = async () => {
    setLoadingQr(true);
    try {
      const billPlaceholder = `DLY-${Date.now().toString().slice(-6)}`;
      const res = await api.get(`/billing/dynamic-upi-qr?amount=${total}&bill_number=${billPlaceholder}`);
      setUpiQrData(res.data);
    } catch (e) {
      console.error('Failed to generate UPI QR', e);
    } finally {
      setLoadingQr(false);
    }
  };

  const handleModeChange = (mode: PaymentMode) => {
    setPaymentMode(mode);
    if (mode === 'UPI') {
      loadUpiQr();
    }
  };

  const changeAmount = Math.max(0, tenderAmount - total);
  const dueAmount = Math.max(0, total - tenderAmount);
  const creditDueRemaining = Math.max(0, total - (Number(creditPaidNow) || 0));

  const cashSuggestions = [
    total,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 500) * 500
  ].filter((v, i, arr) => v >= total && arr.indexOf(v) === i);

  const handleCompletePayment = async () => {
    if (total <= 0 || isProcessing) return;
    setIsProcessing(true);

    try {
      const itemsPayload = activeItems().map(item => ({
        product_id: item.product_id,
        item_name: item.item_name,
        barcode: item.barcode,
        sku: item.sku,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.cost_price,
        discount_amount: item.discount_amount,
        tax_percent: item.tax_percent,
        tax_amount: item.tax_amount,
        total_price: item.total_price,
        is_unlisted: item.is_unlisted
      }));

      const finalPaidAmount = paymentMode === 'CREDIT_KHATA' 
        ? Math.min(total, Number(creditPaidNow) || 0)
        : Math.min(total, tenderAmount);

      const finalDueAmount = paymentMode === 'CREDIT_KHATA'
        ? creditDueRemaining
        : dueAmount;

      const finalCustomerName = paymentMode === 'CREDIT_KHATA'
        ? (creditCustomerName.trim() || currentTab?.customerName || undefined)
        : (currentTab?.customerName || undefined);

      const finalCustomerPhone = paymentMode === 'CREDIT_KHATA'
        ? (creditCustomerPhone.trim() || currentTab?.customerPhone || undefined)
        : (currentTab?.customerPhone || undefined);

      const payload = {
        customer_name: finalCustomerName,
        customer_phone: finalCustomerPhone,
        subtotal: subtotal(),
        discount_amount: discountVal(),
        discount_type: currentTab?.discountType || 'FLAT',
        tax_amount: taxAmount(),
        round_off: 0,
        grand_total: total,
        paid_amount: finalPaidAmount,
        change_amount: changeAmount,
        due_amount: finalDueAmount,
        payment_mode: paymentMode,
        payment_status: finalDueAmount === 0 ? 'PAID' : (finalPaidAmount > 0 ? 'PARTIAL' : 'CREDIT'),
        is_gift_receipt: currentTab?.isGiftReceipt || false,
        notes: currentTab?.notes || undefined,
        items: itemsPayload
      };

      const res = await api.post('/billing/checkout', payload);
      playSuccessChime();
      clearActiveCart();
      onPaymentSuccess(res.data);
      onClose();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to complete checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard Navigation: Enter to Pay & Print, Escape to Cancel, F8/F9 modes
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleCompletePayment();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleModeChange('CASH');
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleModeChange('UPI');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, total, tenderAmount, paymentMode, isProcessing]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-pink-400">
              Settle Payment & Print
            </span>
            <h2 className="text-2xl font-black font-mono mt-0.5">
              {formatINR(total)}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Discount in Pay & Print (Item 7) */}
        {(() => {
          const currentDisc = discountVal();
          return (
            <div className="bg-slate-50 dark:bg-slate-800/80 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">Bill Discount:</span>
                <div className="flex items-center space-x-1">
                  <span className="text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={currentDisc || ''}
                    placeholder="0"
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    onChange={(e) => setBillDiscount(Math.max(0, parseFloat(e.target.value) || 0), 'FLAT')}
                    className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-mono font-bold text-xs text-rose-600 focus:outline-none focus:border-pink-500 text-right"
                  />
                </div>
                <div className="flex items-center space-x-1">
                  {[20, 50, 100, 200].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setBillDiscount(d, 'FLAT')}
                      className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border transition-colors ${
                        currentDisc === d 
                          ? 'bg-rose-50 border-rose-400 text-rose-700 dark:bg-rose-950 dark:text-rose-300 shadow-xs' 
                          : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      -₹{d}
                    </button>
                  ))}
                  {currentDisc > 0 && (
                    <button
                      type="button"
                      onClick={() => setBillDiscount(0, 'FLAT')}
                      className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-rose-600 font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-400">Subtotal: {formatINR(subtotal())}</span>
                {currentDisc > 0 && <span className="text-[11px] text-rose-600 ml-2 font-bold">-₹{currentDisc}</span>}
              </div>
            </div>
          );
        })()}

        <div className="p-6 space-y-6">
          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
              Select Payment Tender
            </label>
            <div className="grid grid-cols-4 gap-3">
              {[
                { id: 'CASH', label: 'Cash (F8)', icon: Banknote, color: 'text-emerald-500' },
                { id: 'UPI', label: 'Dynamic UPI QR (F9)', icon: QrCode, color: 'text-pink-500' },
                { id: 'CARD', label: 'POS Card Machine', icon: CreditCard, color: 'text-blue-500' },
                { id: 'CREDIT_KHATA', label: 'Credit Khata Book', icon: Users, color: 'text-amber-500' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModeChange(m.id as PaymentMode)}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center space-y-1.5 transition-all text-xs font-bold ${
                    paymentMode === m.id
                      ? 'border-pink-600 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 shadow-md scale-102'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CASH TENDER MODE */}
          {paymentMode === 'CASH' && (
            <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    Cash Tendered (₹)
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="number"
                      value={tenderAmount || ''}
                      onChange={(e) => setTenderAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-3 py-2 text-xl font-bold font-mono bg-white dark:bg-slate-900 border-2 border-pink-500 rounded-xl focus:outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    Change to Return
                  </label>
                  <div className={`text-2xl font-black font-mono py-1.5 px-3 rounded-xl ${
                    changeAmount > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}>
                    {formatINR(changeAmount)}
                  </div>
                </div>
              </div>

              {/* Quick Cash Chips */}
              <div className="flex items-center space-x-2 pt-1">
                <span className="text-xs text-slate-400 font-semibold">Quick Notes:</span>
                {cashSuggestions.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTenderAmount(amt)}
                    className="px-3 py-1 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono font-bold text-xs hover:border-pink-500 transition-colors"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DYNAMIC UPI QR MODE */}
          {paymentMode === 'UPI' && (
            <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
              {loadingQr ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Generating dynamic NPCI UPI QR Code...
                </div>
              ) : upiQrData?.qr_image_base64 ? (
                <div className="flex items-center space-x-6">
                  <div className="p-3 bg-white rounded-2xl shadow-md border-2 border-pink-500">
                    <img
                      src={upiQrData.qr_image_base64}
                      alt="UPI QR"
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-slate-800 dark:text-white text-sm block">
                      Scan via PhonePe, GPay, Paytm
                    </span>
                    <p className="text-slate-500 font-mono">
                      Pay to: {settings?.upi_id || '7972558842@upi'}
                    </p>
                    <p className="text-lg font-black text-pink-600 font-mono">
                      Amount: {formatINR(total)}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-bold block bg-emerald-50 px-2 py-0.5 rounded w-fit">
                      ✓ Exact amount automatically pre-filled
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* CREDIT KHATA MODE */}
          {paymentMode === 'CREDIT_KHATA' && (
            <div className="space-y-4 bg-amber-50/60 dark:bg-amber-950/30 p-5 rounded-2xl border border-amber-200 dark:border-amber-800/60">
              {/* Customer Identification */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-600" />
                    Customer Khata Account Details (Required for Credit)
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
                    Auto-Syncs to Customers / Khata
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={creditCustomerName}
                      onChange={(e) => handleCustomerNameChange(e.target.value)}
                      onFocus={() => {
                        if (creditCustomerName.trim().length >= 1 && customerSuggestions.length > 0) {
                          setShowSuggestions(true);
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onKeyDown={(e) => {
                        if (showSuggestions && customerSuggestions.length > 0) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedSuggestionIdx(prev => Math.min(prev + 1, customerSuggestions.length - 1));
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedSuggestionIdx(prev => Math.max(prev - 1, 0));
                          } else if (e.key === 'Enter') {
                            if (selectedSuggestionIdx >= 0 && selectedSuggestionIdx < customerSuggestions.length) {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectCustomer(customerSuggestions[selectedSuggestionIdx]);
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowSuggestions(false);
                          }
                        }
                      }}
                      placeholder="e.g. Raju Bhai, Suresh Patel..."
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      autoFocus
                    />

                    {/* Autocomplete Dropdown List */}
                    {showSuggestions && customerSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 animate-in fade-in zoom-in duration-100">
                        <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-[10px] font-bold text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-amber-900 flex justify-between">
                          <span>Select Existing Customer (↑ ↓ ↵)</span>
                          <span className="text-slate-400 font-normal">Esc to ignore</span>
                        </div>
                        {customerSuggestions.map((c, idx) => (
                          <div
                            key={c.id || idx}
                            onClick={() => handleSelectCustomer(c)}
                            className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                              idx === selectedSuggestionIdx
                                ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div>
                              <span className="font-bold block">{c.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {c.phone ? `Ph: ${c.phone}` : 'No phone'} {c.city ? `• ${c.city}` : ''}
                              </span>
                            </div>
                            {c.credit_balance > 0 ? (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded">
                                Khata Due: {formatINR(c.credit_balance)}
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

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mobile Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={creditCustomerPhone}
                      onChange={(e) => setCreditCustomerPhone(e.target.value)}
                      placeholder="10-digit Mobile (e.g. 9823000000)"
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Settlement & Partial Payment Breakdown */}
              <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  {/* Paid Now Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                      Paid Now / Advance (₹)
                    </label>
                    <div className="relative">
                      <IndianRupee className="w-4 h-4 absolute left-3 top-2.5 text-emerald-500" />
                      <input
                        type="number"
                        value={creditPaidNow || ''}
                        onChange={(e) => setCreditPaidNow(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full pl-9 pr-3 py-2 text-lg font-bold font-mono bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-xl focus:outline-none"
                        min="0"
                        max={total}
                      />
                    </div>
                  </div>

                  {/* Remaining Due Display */}
                  <div>
                    <label className="block text-[11px] font-bold text-rose-800 dark:text-rose-300 mb-1">
                      Remaining Khata Due (Credit)
                    </label>
                    <div className="py-2 px-3.5 text-lg font-black font-mono bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 rounded-xl border border-rose-300 dark:border-rose-900">
                      {formatINR(creditDueRemaining)}
                    </div>
                  </div>
                </div>

                {/* Quick Advance Chips */}
                <div className="flex items-center space-x-1.5 pt-1 text-xs">
                  <span className="text-[11px] font-bold text-slate-400">Quick Advance:</span>
                  <button
                    type="button"
                    onClick={() => setCreditPaidNow(0)}
                    className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] transition-colors ${
                      creditPaidNow === 0 ? 'bg-amber-600 text-white border-amber-600' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    ₹0 (100% Khata)
                  </button>
                  {total > 100 && (
                    <button
                      type="button"
                      onClick={() => setCreditPaidNow(Math.round(total / 2))}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border hover:border-pink-500 font-bold text-[11px]"
                    >
                      50% ({formatINR(Math.round(total / 2))})
                    </button>
                  )}
                  {[100, 200, 500, 1000].filter(v => v < total).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCreditPaidNow(v)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border hover:border-pink-500 font-mono font-bold text-[11px]"
                    >
                      ₹{v}
                    </button>
                  ))}
                </div>

                {/* Summary Info Banner */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900 flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300">
                    Total Bill: <strong>{formatINR(total)}</strong>
                  </span>
                  <div className="flex items-center space-x-3 font-bold">
                    <span className="text-emerald-600">✓ Received: {formatINR(creditPaidNow)}</span>
                    <span className="text-rose-600">⚠ Added to Khata: {formatINR(creditDueRemaining)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <span>Cancel</span>
            <kbd className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">Esc</kbd>
          </button>

          <button
            type="button"
            onClick={handleCompletePayment}
            disabled={isProcessing}
            className="px-8 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{isProcessing ? 'Processing...' : 'Complete & Print Bill'}</span>
            <kbd className="text-[10px] bg-black/20 text-white px-1.5 py-0.5 rounded ml-1">Enter ↵</kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
