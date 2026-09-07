import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Vendor } from '../types';
import { useAuthStore } from '../store/authStore';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  Building2, 
  Edit3, 
  X,
  StickyNote,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Calendar,
  History,
  CreditCard,
  Banknote
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const VendorPage: React.FC = () => {
  const { isOwner } = useAuthStore();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Add/Edit Profile Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Vendor Due / Ledger Note Modal State (Item 22)
  const [selectedVendorForLedger, setSelectedVendorForLedger] = useState<Vendor | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  // Quick Purchase Bill / Note Form State
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [billInvoiceNo, setBillInvoiceNo] = useState('');
  const [billTotalAmount, setBillTotalAmount] = useState<number>(0);
  const [billPaidAmount, setBillPaidAmount] = useState<number>(0);
  const [billPaymentMode, setBillPaymentMode] = useState('CASH');
  const [billNotes, setBillNotes] = useState('');
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);

  // Settle Due Form State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10));
  const [settleMode, setSettleMode] = useState('UPI');
  const [settleNotes, setSettleNotes] = useState('Due settled with vendor');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // Form State for Profile Edit
  const [formData, setFormData] = useState({
    vendor_code: '',
    name: '',
    company_name: '',
    phone: '',
    alt_phone: '',
    email: '',
    gstin: '',
    address: '',
    city: 'Surat',
    state: 'Gujarat',
    notes: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    bank_holder_name: '',
    vendor_upi_id: '',
    opening_due: 0
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, [search]);

  // Close active modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSettleModalOpen) {
          e.preventDefault();
          setIsSettleModalOpen(false);
        } else if (selectedVendorForLedger) {
          e.preventDefault();
          setSelectedVendorForLedger(null);
        } else if (isModalOpen) {
          e.preventDefault();
          setIsModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettleModalOpen, selectedVendorForLedger, isModalOpen]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/vendors${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setVendors(res.data);
      setSelectedVendorForLedger(prev => {
        if (!prev) return null;
        const match = res.data.find((v: Vendor) => v.id === prev.id);
        return match || prev;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingVendor(null);
    setFormData({
      vendor_code: `V${vendors.length + 1}`,
      name: '',
      company_name: '',
      phone: '',
      alt_phone: '',
      email: '',
      gstin: '',
      address: '',
      city: 'Surat',
      state: 'Gujarat',
      notes: '',
      bank_name: '',
      bank_account_no: '',
      bank_ifsc: '',
      bank_holder_name: '',
      vendor_upi_id: '',
      opening_due: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: Vendor) => {
    setEditingVendor(v);
    setFormData({
      vendor_code: v.vendor_code || '',
      name: v.name,
      company_name: v.company_name || '',
      phone: v.phone,
      alt_phone: v.alt_phone || '',
      email: v.email || '',
      gstin: v.gstin || '',
      address: v.address || '',
      city: v.city || '',
      state: v.state || '',
      notes: v.notes || '',
      bank_name: v.bank_name || '',
      bank_account_no: v.bank_account_no || '',
      bank_ifsc: v.bank_ifsc || '',
      bank_holder_name: v.bank_holder_name || '',
      vendor_upi_id: v.vendor_upi_id || '',
      opening_due: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenLedger = async (v: Vendor) => {
    setSelectedVendorForLedger(v);
    setBillTotalAmount(0);
    setBillPaidAmount(0);
    setBillInvoiceNo('');
    setBillNotes('');
    setSettleAmount(v.outstanding_due);
    fetchLedger(v.id);
  };

  const fetchLedger = async (vendorId: number) => {
    setIsLedgerLoading(true);
    try {
      const res = await api.get(`/vendors/${vendorId}/ledger`);
      setLedgerEntries(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLedgerLoading(false);
    }
  };

  const handleRecordQuickBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorForLedger) return;
    if (billTotalAmount <= 0) {
      alert('Purchase Amount must be greater than 0');
      return;
    }

    setIsSubmittingBill(true);
    try {
      await api.post('/vendors/quick-bill', {
        vendor_id: selectedVendorForLedger.id,
        invoice_no: billInvoiceNo.trim() || undefined,
        bill_date: billDate,
        total_amount: billTotalAmount,
        paid_amount: billPaidAmount,
        payment_mode: billPaymentMode,
        notes: billNotes.trim() || undefined
      });

      alert('Purchase bill note recorded successfully!');
      setBillTotalAmount(0);
      setBillPaidAmount(0);
      setBillInvoiceNo('');
      setBillNotes('');
      
      // Refresh
      fetchLedger(selectedVendorForLedger.id);
      fetchVendors();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to record purchase bill');
    } finally {
      setIsSubmittingBill(false);
    }
  };

  const handleSettleDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorForLedger) return;
    if (settleAmount <= 0) {
      alert('Payment amount must be greater than 0');
      return;
    }

    setIsSubmittingSettle(true);
    try {
      await api.post('/vendors/ledger/payment', {
        vendor_id: selectedVendorForLedger.id,
        entry_type: 'PAYMENT_MADE',
        amount: settleAmount,
        payment_mode: settleMode,
        reference_no: `PAY-${Date.now()}`,
        notes: `${settleNotes} (Date: ${settleDate})`
      });

      alert(`Successfully paid ₹${settleAmount} to ${selectedVendorForLedger.name}!`);
      setIsSettleModalOpen(false);
      fetchLedger(selectedVendorForLedger.id);
      fetchVendors();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to settle due');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingVendor) {
        await api.put(`/vendors/${editingVendor.id}`, formData);
      } else {
        await api.post('/vendors', formData);
      }
      setIsModalOpen(false);
      fetchVendors();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save vendor');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-pink-500" />
            Suppliers & Vendor Management
          </h1>
          <p className="text-xs text-slate-500">
            Supplier shortcodes, Bank & UPI profiles, outstanding dues ledger & purchase notes.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-pink-600/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Supplier / Vendor</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Supplier by Name, Firm, Shortcode (SUR01), Phone, City..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-xs focus:outline-none focus:border-pink-500"
          />
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-3">
          {loading ? (
            <div className="col-span-3 text-center py-12 text-slate-400 text-xs">Loading suppliers...</div>
          ) : vendors.length === 0 ? (
            <div className="col-span-3 text-center py-12 text-slate-400 text-xs">No suppliers found</div>
          ) : (
            vendors.map((v) => (
              <div 
                key={v.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-pink-300 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 font-mono text-[10px] font-black">
                          {v.vendor_code || `V${v.id}`}
                        </span>
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                          {v.name}
                        </h3>
                      </div>
                      {v.company_name && (
                        <p className="text-xs text-slate-500 font-medium">{v.company_name}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenEdit(v)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Vendor Profile"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1 pt-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{v.phone}</span>
                    </div>

                    {v.city && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{v.city}, {v.state || 'India'}</span>
                      </div>
                    )}

                    {v.bank_account_no && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-mono text-[11px] space-y-0.5 mt-2 border">
                        <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-pink-500" />
                          {v.bank_name || 'Bank Account'}
                        </div>
                        <div>A/C: {v.bank_account_no} (IFSC: {v.bank_ifsc || 'N/A'})</div>
                        {v.vendor_upi_id && <div className="text-pink-600 font-bold">UPI: {v.vendor_upi_id}</div>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Outstanding Due & Interactive Ledger Button (Item 22) */}
                <div className="border-t pt-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Outstanding Due</span>
                    <span className={`font-mono font-black text-sm ${
                      v.outstanding_due > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {formatINR(v.outstanding_due)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {v.outstanding_due > 0 && (
                      <button
                        onClick={() => {
                          setSelectedVendorForLedger(v);
                          setSettleAmount(v.outstanding_due);
                          setSettleNotes(`Payment against outstanding due`);
                          setIsSettleModalOpen(true);
                          fetchLedger(v.id);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1 shadow-xs transition-all active:scale-95"
                        title="Mark as Paid / Settle Due"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Pay Due</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenLedger(v)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center space-x-1 shadow-xs transition-all active:scale-95"
                      title="Open purchase notes and payment history"
                    >
                      <Receipt className="w-3.5 h-3.5 text-pink-400" />
                      <span>Ledger</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ITEM 22: Comprehensive Vendor Purchase Notes & Dues Ledger Modal */}
      {selectedVendorForLedger && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-pink-100 dark:bg-pink-900/50 text-pink-600 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{selectedVendorForLedger.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 font-mono text-slate-700 dark:text-slate-300">
                      {selectedVendorForLedger.vendor_code || `V${selectedVendorForLedger.id}`}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Outstanding Due: <strong className="text-rose-600 font-mono">{formatINR(selectedVendorForLedger.outstanding_due)}</strong> • Record new purchases and track payment history.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {selectedVendorForLedger.outstanding_due > 0 && (
                  <button
                    onClick={() => { setSettleAmount(selectedVendorForLedger.outstanding_due); setIsSettleModalOpen(true); }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    ✓ Mark / Settle Due as Paid
                  </button>
                )}
                <button 
                  onClick={() => setSelectedVendorForLedger(null)} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
              
              {/* Quick Purchase Entry Form */}
              <form onSubmit={handleRecordQuickBill} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-pink-500" />
                  <span>+ Record New Purchase Invoice / Bill Note</span>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-xl font-mono text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Total Buy Amount (₹) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="0"
                      value={billTotalAmount || ''}
                      onChange={(e) => setBillTotalAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-xl font-mono font-bold text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Amount Paid Upfront (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={billPaidAmount || ''}
                      onChange={(e) => setBillPaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-xl font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={billPaymentMode}
                      onChange={(e) => setBillPaymentMode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-xl text-xs font-semibold"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / GPay</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Supplier Bill / Invoice No (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. INV-8891"
                      value={billInvoiceNo}
                      onChange={(e) => setBillInvoiceNo(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-xl font-mono text-xs"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Purchase Notes / Products Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 50 pcs baby frocks, 20 pcs ride-on cars"
                      value={billNotes}
                      onChange={(e) => setBillNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="font-mono text-[11px] text-slate-500">
                    Remaining Due from this Bill:{' '}
                    <strong className="text-rose-600">
                      ₹{Math.max(0, billTotalAmount - billPaidAmount).toFixed(2)}
                    </strong>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingBill}
                    className="px-5 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
                  >
                    {isSubmittingBill ? 'Recording...' : '+ Record Purchase Bill'}
                  </button>
                </div>
              </form>

              {/* Chronological Ledger History (Scrollable container - Point 9) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-pink-500" />
                    <span>Purchase & Payment History Ledger</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {ledgerEntries.length} Total Transaction(s)
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase border-b sticky top-0 z-10 shadow-xs">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Transaction Type</th>
                        <th className="py-2.5 px-3">Ref / Bill No</th>
                        <th className="py-2.5 px-3 text-right">Debit (Paid)</th>
                        <th className="py-2.5 px-3 text-right">Credit (Billed)</th>
                        <th className="py-2.5 px-3 text-right">Balance Due</th>
                        <th className="py-2.5 px-3 text-center">Status / Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {isLedgerLoading ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400">Loading ledger...</td>
                        </tr>
                      ) : ledgerEntries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400">No purchase or payment history found</td>
                        </tr>
                      ) : (
                        ledgerEntries.map((entry: any, idx: number) => {
                          const isPaidEntry = entry.debit_amount > 0;
                          const hasDueOnRow = !isPaidEntry && entry.credit_amount > 0;
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                                {new Date(entry.created_at).toLocaleDateString('en-GB')}
                              </td>
                              <td className="py-2.5 px-3 font-semibold">
                                {entry.notes || (isPaidEntry ? 'Payment to Vendor' : 'Purchase Inward')}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                {entry.reference_no || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                                {entry.debit_amount > 0 ? formatINR(entry.debit_amount) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                                {entry.credit_amount > 0 ? formatINR(entry.credit_amount) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                {formatINR(entry.balance_after)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {hasDueOnRow && selectedVendorForLedger.outstanding_due > 0 ? (
                                  <button
                                    onClick={() => {
                                      setSettleAmount(Math.min(entry.credit_amount, selectedVendorForLedger.outstanding_due));
                                      setSettleNotes(`Payment against Bill #${entry.reference_no || ''}`);
                                      setIsSettleModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1 mx-auto"
                                    title="Click to record payment against this due bill"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Mark as Paid</span>
                                  </button>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isPaidEntry 
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                      : (entry.balance_after > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')
                                  }`}>
                                    {isPaidEntry ? '✓ Paid' : (entry.balance_after > 0 ? 'Due' : 'Settled')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settle Due Modal */}
      {isSettleModalOpen && selectedVendorForLedger && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 select-none animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Settle Outstanding Due
              </h3>
              <button onClick={() => setIsSettleModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSettleDue} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Amount Paying (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={settleAmount || ''}
                  onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono font-black text-emerald-600 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Tender
                </label>
                <select
                  value={settleMode}
                  onChange={(e) => setSettleMode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                >
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettle}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs"
                >
                  {isSubmittingSettle ? 'Saving...' : '✓ Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Vendor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-pink-500" />
                {editingVendor ? 'Edit Supplier Profile' : 'Add New Supplier / Vendor'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vendor Shortcode (e.g. SUR01)
                  </label>
                  <input
                    type="text"
                    value={formData.vendor_code}
                    onChange={(e) => setFormData({ ...formData, vendor_code: e.target.value.toUpperCase() })}
                    placeholder="SUR01, DEL01"
                    className="w-full px-3 py-2 uppercase font-mono font-bold text-pink-600 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vendor Contact Person Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Company / Firm Name
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
              </div>

              {/* Bank & Settlement Details */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border space-y-2.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">Bank Account & Settlement Details</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="HDFC Bank, SBI"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-700 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Account Number</label>
                    <input
                      type="text"
                      value={formData.bank_account_no}
                      onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
                      className="w-full px-2.5 py-1.5 font-mono bg-white dark:bg-slate-700 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={formData.bank_ifsc}
                      onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 font-mono uppercase bg-white dark:bg-slate-700 border rounded-xl"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block font-semibold mb-1">Vendor UPI ID (GPay/PhonePe)</label>
                    <input
                      type="text"
                      value={formData.vendor_upi_id}
                      onChange={(e) => setFormData({ ...formData, vendor_upi_id: e.target.value })}
                      placeholder="vendor@okhdfcbank"
                      className="w-full px-2.5 py-1.5 font-mono text-pink-600 bg-white dark:bg-slate-700 border rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Vendor Notes Section */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor Notes & Terms (Editable)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Delivers via Dhule Transport, 15 days credit term, delivers seasonal ethnic wear..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-pink-600 text-white rounded-xl font-bold shadow-md shadow-pink-600/30 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Vendor Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
