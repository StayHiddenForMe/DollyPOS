import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Invoice } from '../types';
import { useAuthStore } from '../store/authStore';
import { 
  Receipt, 
  Search, 
  Eye, 
  Printer, 
  XCircle, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  ArrowUpDown,
  FileSpreadsheet,
  RotateCcw,
  CreditCard,
  Banknote,
  Smartphone
} from 'lucide-react';
import { formatINR, formatISTDate } from '../utils/formatters';
import { ThermalReceiptView } from '../components/billing/ThermalReceiptView';

export const BillsPage: React.FC = () => {
  const { isOwner } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<number | null>(null);

  // Date Range & Export State (Item 14)
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const handleExportExcel = async (allTime: boolean = false) => {
    try {
      let url = `/billing/export-excel?all_time=${allTime}`;
      if (!allTime) {
        if (!filterStartDate || !filterEndDate) {
          alert('Please select both "From" and "To" dates to export a specific date range. Or click "All-Time Excel" to export complete sales history.');
          return;
        }
        url += `&start_date=${filterStartDate}&end_date=${filterEndDate}`;
      }
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `DollyToys_Bills_${allTime ? 'All_Time_Full_History' : `${filterStartDate}_to_${filterEndDate}`}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to export invoices to Excel');
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [limit]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/billing/history?limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      setInvoices(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  const handleViewReceipt = async (inv: Invoice) => {
    setSelectedInvoice(inv);
    setIsReceiptLoading(true);
    try {
      const res = await api.get(`/billing/receipt/${inv.id}`);
      setReceiptData(res.data);
    } catch (e) {
      alert('Failed to load bill receipt details');
    } finally {
      setIsReceiptLoading(false);
    }
  };

  const handleChangePaymentMode = async (inv: Invoice, newMode: string) => {
    if (inv.is_cancelled) return;
    try {
      setUpdatingInvoiceId(inv.id);
      await api.put(`/billing/${inv.id}/payment-mode`, {
        payment_mode: newMode,
        notes: 'Mode adjusted by cashier'
      });
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, payment_mode: newMode as any } : i));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update payment mode');
    } finally {
      setUpdatingInvoiceId(null);
    }
  };

  const handleCancelBill = async (inv: Invoice) => {
    if (!isOwner()) {
      alert('Only store owner can cancel generated bills.');
      return;
    }
    const confirmCancel = window.confirm(`Are you sure you want to CANCEL bill "${inv.bill_number}"? This will automatically restock items.`);
    if (!confirmCancel) return;

    try {
      await api.post(`/billing/cancel/${inv.id}`);
      alert(`Bill ${inv.bill_number} cancelled and items restocked!`);
      fetchInvoices();
      if (selectedInvoice?.id === inv.id) {
        setSelectedInvoice(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel bill');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-hidden select-none">
      {/* Top Header */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              Bills & Invoices Ledger
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 font-mono">
                {invoices.length} Bills
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Audit past invoices, switch payment modes (Cash ⇄ UPI), view thermal receipts, and reprint.
            </p>
          </div>
        </div>

        {/* Search, Date Range & Export Controls */}
        <div className="flex items-center space-x-2">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Bill No / Phone / Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-pink-500 w-52 text-slate-800 dark:text-white"
            />
          </form>

          {/* Date Range Inputs */}
          <div className="flex items-center space-x-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="px-2 py-1 bg-transparent text-slate-700 dark:text-slate-300 font-mono text-xs focus:outline-none"
              title="Filter Start Date"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-2 py-1 bg-transparent text-slate-700 dark:text-slate-300 font-mono text-xs focus:outline-none"
              title="Filter End Date"
            />
          </div>

          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>

          {/* Export Buttons */}
          <button
            onClick={() => handleExportExcel(false)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-all active:scale-95"
            title="Export bills matching current date range or recent 500"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => handleExportExcel(true)}
            className="px-3 py-2 bg-pink-50 hover:bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300 border border-pink-300 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-all active:scale-95"
            title="Export all-time historical bills from inception"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-pink-600" />
            <span>All-Time Excel</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Bill Number</th>
                <th className="py-3 px-3">Date & Time (IST)</th>
                <th className="py-3 px-3">Customer Details</th>
                <th className="py-3 px-2 text-center">Items</th>
                <th className="py-3 px-3 text-right">Grand Total</th>
                <th className="py-3 px-3 text-center">Payment Tender (Click to Switch)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-center w-28">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">Loading bills...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">No invoices found matching criteria</td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  return (
                    <tr 
                      key={inv.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        inv.is_cancelled ? 'opacity-60 bg-rose-50/10 line-through' : ''
                      }`}
                    >
                      {/* Bill No */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-white">
                        {inv.bill_number}
                      </td>

                      {/* Date & Time in IST */}
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {formatISTDate(inv.created_at)}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">
                        <div>{inv.customer_name || 'Walk-in Customer'}</div>
                        {inv.customer_phone && (
                          <div className="text-[10px] text-slate-400 font-mono">{inv.customer_phone}</div>
                        )}
                      </td>

                      {/* Items count */}
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                        {inv.items?.length || 0}
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-sm text-pink-600 dark:text-pink-400">
                        {formatINR(inv.grand_total)}
                      </td>

                      {/* Payment Mode with 1-Click Switcher */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            disabled={inv.is_cancelled || updatingInvoiceId === inv.id}
                            onClick={() => handleChangePaymentMode(inv, inv.payment_mode === 'CASH' ? 'UPI' : 'CASH')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center space-x-1 ${
                              inv.payment_mode === 'CASH'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                : inv.payment_mode === 'UPI'
                                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-300'
                                  : 'bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-300'
                            }`}
                            title="Click to Switch Payment Mode (Cash ⇄ UPI)"
                          >
                            {inv.payment_mode === 'CASH' && <Banknote className="w-3 h-3" />}
                            {inv.payment_mode === 'UPI' && <Smartphone className="w-3 h-3" />}
                            {inv.payment_mode === 'CARD' && <CreditCard className="w-3 h-3" />}
                            <span>{inv.payment_mode}</span>
                            <span className="text-[9px] text-slate-400 ml-0.5">⇄</span>
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {inv.is_cancelled ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                            CANCELLED
                          </span>
                        ) : inv.due_amount > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            KHATA DUE: {formatINR(inv.due_amount)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                            PAID
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleViewReceipt(inv)}
                            className="p-1.5 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                            title="View Thermal Receipt & Reprint"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isOwner() && !inv.is_cancelled && (
                            <button
                              onClick={() => handleCancelBill(inv)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Cancel Bill & Restock Products"
                            >
                              <XCircle className="w-4 h-4" />
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
      </div>

      {/* Bill View & Thermal Reprint Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-pink-500" />
                  Bill: {selectedInvoice.bill_number}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {formatISTDate(selectedInvoice.created_at)} • {selectedInvoice.payment_mode}
                </p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950 flex justify-center">
              {receiptData && <ThermalReceiptView receiptData={receiptData} onClose={() => setSelectedInvoice(null)} />}
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 border-t flex justify-end space-x-2">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 border rounded-xl font-bold text-xs text-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
