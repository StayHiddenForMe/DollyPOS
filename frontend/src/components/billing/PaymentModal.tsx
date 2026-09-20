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
  Share2,
  Zap
} from 'lucide-react';
import { formatINR, playSuccessChime } from '../../utils/formatters';
import { computeExtraCharges } from '../../utils/extraCharges';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (invoice: any) => void;
  initialMode?: PaymentMode;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess,
  initialMode = 'CASH'
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

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');

  // Dynamically evaluate extra charges based on the selected payment mode
  const extraCharges = computeExtraCharges(subtotal(), discountVal(), paymentMode, settings);
  const total = Math.max(0, Math.round(subtotal() - discountVal() + taxAmount() + extraCharges.totalCharges));

  const currentTab = tabs.find(t => t.id === activeTabId);

  const [tenderAmount, setTenderAmount] = useState<number>(total);
  const [creditCustomerName, setCreditCustomerName] = useState<string>(currentTab?.customerName || '');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState<string>(currentTab?.customerPhone || '');
  const [creditPaidNow, setCreditPaidNow] = useState<number>(0);
  const [creditPaidMode, setCreditPaidMode] = useState<'CASH' | 'UPI'>('CASH');
  const [upiQrData, setUpiQrData] = useState<any>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Split Payment Multi-Tender State
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUpi, setSplitUpi] = useState<number>(0);
  const [splitCard, setSplitCard] = useState<number>(0);
  const [splitDue, setSplitDue] = useState<number>(0);
  const [splitUpiQrData, setSplitUpiQrData] = useState<any>(null);
  const [loadingSplitQr, setLoadingSplitQr] = useState(false);

  // Customer Autocomplete Dropdown State
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);

  // Set initial tender amount and customer info when modal opens
  useEffect(() => {
    if (isOpen) {
      const mode = initialMode || 'CASH';
      setPaymentMode(mode);
      const initialCharges = computeExtraCharges(subtotal(), discountVal(), mode, settings);
      const initialTotal = Math.max(0, Math.round(subtotal() - discountVal() + taxAmount() + initialCharges.totalCharges));

      setTenderAmount(initialTotal);
      setCreditPaidNow(0);
      setCreditCustomerName(currentTab?.customerName || '');
      setCreditCustomerPhone(currentTab?.customerPhone || '');
      setShowSuggestions(false);
      
      // Default split preset: 50% Cash + 50% UPI or full cash
      setSplitCash(initialTotal);
      setSplitUpi(0);
      setSplitCard(0);
      setSplitDue(0);

      if (mode === 'UPI') {
        loadUpiQr(initialTotal);
      }
    }
  }, [isOpen, initialMode, currentTab]);

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

  const loadUpiQr = async (amountToCharge: number) => {
    if (amountToCharge <= 0) {
      setUpiQrData(null);
      return;
    }
    setLoadingQr(true);
    try {
      const billPlaceholder = `DLY-${Date.now().toString().slice(-6)}`;
      const res = await api.get(`/billing/dynamic-upi-qr?amount=${amountToCharge}&bill_number=${billPlaceholder}`);
      setUpiQrData(res.data);
    } catch (e) {
      console.error('Failed to generate UPI QR', e);
    } finally {
      setLoadingQr(false);
    }
  };

  const loadSplitUpiQr = async (amountToCharge: number) => {
    if (amountToCharge <= 0) {
      setSplitUpiQrData(null);
      return;
    }
    setLoadingSplitQr(true);
    try {
      const billPlaceholder = `SPLIT-${Date.now().toString().slice(-6)}`;
      const res = await api.get(`/billing/dynamic-upi-qr?amount=${amountToCharge}&bill_number=${billPlaceholder}`);
      setSplitUpiQrData(res.data);
    } catch (e) {
      console.error('Failed to generate Split UPI QR', e);
    } finally {
      setLoadingSplitQr(false);
    }
  };

  useEffect(() => {
    if (paymentMode === 'SPLIT' && splitUpi > 0) {
      loadSplitUpiQr(splitUpi);
    }
  }, [paymentMode, splitUpi]);

  const handleModeChange = (mode: PaymentMode) => {
    setPaymentMode(mode);
    const newCharges = computeExtraCharges(subtotal(), discountVal(), mode, settings);
    const newTotal = Math.max(0, Math.round(subtotal() - discountVal() + taxAmount() + newCharges.totalCharges));
    setTenderAmount(newTotal);
    if (mode === 'UPI') {
      loadUpiQr(newTotal);
    } else if (mode === 'SPLIT') {
      setSplitCash(Math.round(newTotal / 2));
      setSplitUpi(newTotal - Math.round(newTotal / 2));
      setSplitCard(0);
      setSplitDue(0);
    }
  };

  const changeAmount = Math.max(0, tenderAmount - total);
  const dueAmount = Math.max(0, total - tenderAmount);
  const creditDueRemaining = Math.max(0, total - (Number(creditPaidNow) || 0));

  // Split Calculations
  const totalSplitPaid = (Number(splitCash) || 0) + (Number(splitUpi) || 0) + (Number(splitCard) || 0);
  const totalSplitAllocated = totalSplitPaid + (Number(splitDue) || 0);
  const splitUnallocated = Math.max(0, total - totalSplitAllocated);
  const splitChangeAmount = Math.max(0, totalSplitAllocated - total);

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

      let finalPaidAmount = 0;
      let finalDueAmount = 0;
      let finalChangeAmount = 0;
      let paymentsList: any[] | undefined = undefined;

      if (paymentMode === 'SPLIT') {
        const splitPayments = [];
        if (splitCash > 0) splitPayments.push({ payment_mode: 'CASH', amount: Number(splitCash) });
        if (splitUpi > 0) splitPayments.push({ payment_mode: 'UPI', amount: Number(splitUpi) });
        if (splitCard > 0) splitPayments.push({ payment_mode: 'CARD', amount: Number(splitCard) });

        finalPaidAmount = Math.min(total, totalSplitPaid);
        finalDueAmount = splitDue;
        finalChangeAmount = splitChangeAmount;
        paymentsList = splitPayments;
      } else if (paymentMode === 'CREDIT_KHATA') {
        finalPaidAmount = Math.min(total, Number(creditPaidNow) || 0);
        finalDueAmount = creditDueRemaining;
        finalChangeAmount = 0;
      } else {
        finalPaidAmount = Math.min(total, tenderAmount);
        finalDueAmount = dueAmount;
        finalChangeAmount = changeAmount;
      }

      const finalCustomerName = (paymentMode === 'CREDIT_KHATA' || (paymentMode === 'SPLIT' && splitDue > 0))
        ? (creditCustomerName.trim() || currentTab?.customerName || undefined)
        : (currentTab?.customerName || undefined);

      const finalCustomerPhone = (paymentMode === 'CREDIT_KHATA' || (paymentMode === 'SPLIT' && splitDue > 0))
        ? (creditCustomerPhone.trim() || currentTab?.customerPhone || undefined)
        : (currentTab?.customerPhone || undefined);

      const payload = {
        customer_name: finalCustomerName,
        customer_phone: finalCustomerPhone,
        subtotal: subtotal(),
        discount_amount: discountVal(),
        discount_type: currentTab?.discountType || 'FLAT',
        tax_amount: taxAmount(),
        extra_charges_amount: extraCharges.totalCharges,
        extra_charges_breakdown: extraCharges.breakdownJson,
        round_off: 0,
        grand_total: total,
        paid_amount: finalPaidAmount,
        change_amount: finalChangeAmount,
        due_amount: finalDueAmount,
        payment_mode: paymentMode,
        payment_status: finalDueAmount === 0 ? 'PAID' : (finalPaidAmount > 0 ? 'PARTIAL' : 'CREDIT'),
        is_gift_receipt: currentTab?.isGiftReceipt || false,
        notes: currentTab?.notes || undefined,
        items: itemsPayload,
        payments: paymentsList
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

  // Keyboard Navigation: Enter to Pay & Print, Escape to Cancel, F8/F9/F10 modes
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
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleModeChange('SPLIT');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, total, tenderAmount, paymentMode, isProcessing, splitCash, splitUpi, splitCard, splitDue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-150 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-bold text-pink-400">
                Settle Payment &amp; Print
              </span>
              {extraCharges.appliedCharges.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  +{formatINR(extraCharges.totalCharges)} Surcharge Applied
                </span>
              )}
            </div>
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

        {/* Quick Discount & Surcharge summary */}
        {(() => {
          const currentDisc = discountVal();
          return (
            <div className="bg-slate-50 dark:bg-slate-800/80 px-5 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2 text-xs shrink-0">
              <div className="flex items-center justify-between">
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
                  <span className="text-[11px] text-slate-400">Base: {formatINR(subtotal())}</span>
                  {currentDisc > 0 && <span className="text-[11px] text-rose-600 ml-2 font-bold">-₹{currentDisc}</span>}
                </div>
              </div>

              {/* Itemized Extra Charges Pill Bar */}
              {extraCharges.appliedCharges.length > 0 && (
                <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    Applied Surcharges ({paymentMode}):
                  </span>
                  {extraCharges.appliedCharges.map((ac, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800 text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1 font-mono"
                    >
                      <span>{ac.name} ({ac.formattedRate})</span>
                      <strong className="font-black">+₹{ac.chargeAmount.toFixed(2)}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
              Select Payment Tender
            </label>
            <div className="grid grid-cols-5 gap-2.5">
              {[
                { id: 'CASH', label: 'Cash (F8)', icon: Banknote, color: 'text-emerald-500' },
                { id: 'UPI', label: 'UPI QR (F9)', icon: QrCode, color: 'text-pink-500' },
                { id: 'SPLIT', label: 'Split (F10)', icon: Share2, color: 'text-purple-500' },
                { id: 'CARD', label: 'Card POS', icon: CreditCard, color: 'text-blue-500' },
                { id: 'CREDIT_KHATA', label: 'Khata Due', icon: Users, color: 'text-amber-500' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModeChange(m.id as PaymentMode)}
                  className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center space-y-1 transition-all text-xs font-bold ${
                    paymentMode === m.id
                      ? 'border-pink-600 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 shadow-md scale-102'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                  <span className="text-[11px]">{m.label}</span>
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

              {/* Partial Cash Detection & Quick Switch to Split */}
              {tenderAmount > 0 && tenderAmount < total && (
                <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 p-3 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
                  <div className="space-y-0.5">
                    <span className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                      <span>💡</span> Partial Cash: {formatINR(tenderAmount)} | Remaining Due: {formatINR(dueAmount)}
                    </span>
                    <p className="text-[11px] text-purple-700 dark:text-purple-300">
                      Customer paid ₹{tenderAmount} cash. Pay remaining ₹{dueAmount} via Dynamic UPI QR or Card?
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitCash(tenderAmount);
                      setSplitUpi(dueAmount);
                      setSplitCard(0);
                      setSplitDue(0);
                      setPaymentMode('SPLIT');
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-xs text-xs flex items-center gap-1.5 transition-transform active:scale-95 shrink-0"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Split: Pay ₹{dueAmount} via UPI QR</span>
                  </button>
                </div>
              )}

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
                <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                  Generating dynamic NPCI UPI QR Code for {formatINR(total)}...
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
                  <div className="space-y-1.5 text-xs">
                    <span className="font-bold text-slate-800 dark:text-white text-sm block">
                      Scan via PhonePe, GPay, Paytm, BHIM
                    </span>
                    <p className="text-slate-500 font-mono">
                      Pay to: {settings?.upi_id || '7972558842@upi'}
                    </p>
                    <p className="text-xl font-black text-pink-600 font-mono">
                      Amount: {formatINR(total)}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-bold block bg-emerald-50 px-2 py-0.5 rounded w-fit">
                      ✓ Exact bill amount automatically pre-filled in customer app
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* SPLIT MULTI-TENDER MODE */}
          {paymentMode === 'SPLIT' && (
            <div className="space-y-4 bg-purple-50/50 dark:bg-purple-950/20 p-5 rounded-2xl border border-purple-200 dark:border-purple-800/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-purple-600" />
                  Split Payment Breakdown (Multi-Tender)
                </span>
                <span className="text-[11px] font-mono font-bold text-purple-700 dark:text-purple-300">
                  Bill Total: {formatINR(total)}
                </span>
              </div>

              {/* Split Inputs Grid */}
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1">
                    <Banknote className="w-3 h-3" /> Cash (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={splitCash || ''}
                    placeholder="0"
                    onChange={(e) => setSplitCash(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border-2 border-emerald-400 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-pink-700 dark:text-pink-300 mb-1 flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> UPI QR (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={splitUpi || ''}
                    placeholder="0"
                    onChange={(e) => setSplitUpi(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border-2 border-pink-400 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Card (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={splitCard || ''}
                    placeholder="0"
                    onChange={(e) => setSplitCard(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border-2 border-blue-400 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Khata Due (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={splitDue || ''}
                    placeholder="0"
                    onChange={(e) => setSplitDue(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border-2 border-amber-400 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Split Helpers */}
              <div className="flex items-center space-x-2 pt-1">
                <span className="text-[11px] font-semibold text-slate-400">Quick Split:</span>
                <button
                  type="button"
                  onClick={() => {
                    const half = Math.round(total / 2);
                    setSplitCash(half);
                    setSplitUpi(total - half);
                    setSplitCard(0);
                    setSplitDue(0);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border text-[11px] font-bold hover:border-pink-500 transition-colors"
                >
                  50% Cash + 50% UPI
                </button>
                {splitUnallocated > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSplitUpi(prev => prev + splitUnallocated)}
                      className="px-2.5 py-1 rounded-lg bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300 border border-pink-300 text-[11px] font-bold hover:bg-pink-200 transition-colors"
                    >
                      Put Remaining ₹{splitUnallocated} into UPI QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitCash(prev => prev + splitUnallocated)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 text-[11px] font-bold hover:bg-emerald-200 transition-colors"
                    >
                      Put Remaining ₹{splitUnallocated} into Cash
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSplitCash(0);
                    setSplitUpi(0);
                    setSplitCard(0);
                    setSplitDue(0);
                  }}
                  className="px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 ml-auto"
                >
                  Reset
                </button>
              </div>

              {/* Dynamic QR Preview for UPI Split Portion */}
              {splitUpi > 0 && (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-pink-300 dark:border-pink-900 flex items-center space-x-4 animate-in fade-in duration-200">
                  {loadingSplitQr ? (
                    <div className="text-xs text-slate-400 py-4 px-6 animate-pulse">Generating Split UPI QR for ₹{splitUpi}...</div>
                  ) : splitUpiQrData?.qr_image_base64 ? (
                    <>
                      <img src={splitUpiQrData.qr_image_base64} alt="Split UPI QR" className="w-24 h-24 object-contain border p-1 rounded-lg shadow-xs" />
                      <div className="space-y-1 text-xs">
                        <span className="font-bold text-pink-600 block text-sm">
                          Dynamic QR for UPI Split: {formatINR(splitUpi)}
                        </span>
                        <p className="text-[11px] text-slate-500 font-mono">Pay to: {settings?.upi_id || '7972558842@upi'}</p>
                        <span className="text-[10px] text-emerald-600 font-semibold block">Customer scans & pays exactly ₹{splitUpi} via PhonePe/GPay</span>
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {/* Live Split Status Summary */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span className="text-slate-500">Allocated: <strong>{formatINR(totalSplitAllocated)}</strong> / {formatINR(total)}</span>
                  {splitUnallocated > 0 && (
                    <span className="text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                      ⚠ ₹{splitUnallocated} Unallocated
                    </span>
                  )}
                  {totalSplitAllocated === total && (
                    <span className="text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 100% Balanced
                    </span>
                  )}
                  {splitChangeAmount > 0 && (
                    <span className="text-blue-600 font-bold bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">
                      Change to Return: {formatINR(splitChangeAmount)}
                    </span>
                  )}
                </div>
              </div>
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
