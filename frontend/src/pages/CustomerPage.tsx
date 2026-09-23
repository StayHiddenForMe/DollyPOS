import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { Customer } from '../types';
import { useAuthStore } from '../store/authStore';
import { useSettingStore } from '../store/settingStore';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Cake, 
  CreditCard, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Edit3, 
  Check, 
  X,
  IndianRupee,
  BookOpen,
  MessageSquare,
  Send,
  Sparkles,
  Copy,
  ExternalLink,
  Share2,
  CheckCircle2,
  Play,
  SkipForward,
  Filter,
  ShoppingBag,
  Wallet,
  UserCheck
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const CustomerPage: React.FC = () => {
  const { isOwner } = useAuthStore();
  const { settings } = useSettingStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [creditOnly, setCreditOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  // 3-State Column Sorting State (Item 12)
  type SortField = 'name' | 'phone' | 'city' | 'total_spend' | 'visit_count' | 'credit_balance';
  type SortOrder = 'asc' | 'desc' | null;
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  const toggleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortField(null);
      setSortOrder(null);
    }
  };

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Khata Payment Modal
  const [khataCustomer, setKhataCustomer] = useState<Customer | null>(null);
  const [khataPayAmount, setKhataPayAmount] = useState<number>(0);
  const [khataPayMode, setKhataPayMode] = useState<string>('CASH');

  // Customer Form
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    alt_phone: '',
    email: '',
    city: 'Dhule',
    address: '',
    date_of_birth: '',
    anniversary_date: '',
    notes: '',
    opening_credit_balance: 0
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [search, creditOnly]);

  // Close active modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (khataCustomer) {
          e.preventDefault();
          setKhataCustomer(null);
        } else if (isImportModalOpen) {
          e.preventDefault();
          setIsImportModalOpen(false);
        } else if (isModalOpen) {
          e.preventDefault();
          setIsModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [khataCustomer, isImportModalOpen, isModalOpen]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let url = `/customers?credit_only=${creditOnly}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await api.get(url);
      setCustomers(res.data);
    } catch (e) {
      console.error('Failed to fetch customers', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      alt_phone: '',
      email: '',
      city: 'Dhule',
      address: '',
      date_of_birth: '',
      anniversary_date: '',
      notes: '',
      opening_credit_balance: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      phone: c.phone,
      alt_phone: c.alt_phone || '',
      email: c.email || '',
      city: c.city || 'Dhule',
      address: c.address || '',
      date_of_birth: c.date_of_birth || '',
      anniversary_date: c.anniversary_date || '',
      notes: c.notes || '',
      opening_credit_balance: 0
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const payload = {
      ...formData,
      name: formData.name.trim() || 'Customer'
    };
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, payload);
      } else {
        await api.post('/customers', payload);
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKhataPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!khataCustomer || khataPayAmount <= 0) return;
    try {
      await api.post('/customers/ledger/payment', {
        customer_id: khataCustomer.id,
        entry_type: 'PAYMENT_RECEIVED',
        amount: khataPayAmount,
        payment_mode: khataPayMode,
        notes: `Khata payment received via ${khataPayMode}`
      });
      alert(`Payment of ₹${khataPayAmount} recorded for ${khataCustomer.name}!`);
      setKhataCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to record payment');
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await api.get('/customers/export/excel', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DollyToys_Customers_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to export customer excel');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append('file', file);

    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await api.post('/customers/import/excel', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(res.data.message);
      fetchCustomers();
    } catch (err: any) {
      setImportResult(err.response?.data?.detail || 'Failed to import Excel file.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-pink-500" />
              Customer CRM & Khata Management
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 rounded-full border border-pink-200 dark:border-pink-800">
              {customers.length} Total Customers
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer lifetime loyalty • Khata credit balances • Payment receipts & contact directory.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
            title="Download Customer Database as Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          {isOwner() && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-300 font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
              title="Bulk Import Customers from Excel file"
            >
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Import Excel</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-pink-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Customer & Khata Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-950/50 text-pink-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Customers</div>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {customers.length} <span className="text-xs font-semibold text-slate-400 font-normal">Accounts</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Khata Accounts Due</div>
            <div className="text-lg font-black text-amber-600">
              {customers.filter(c => Number(c.credit_balance) > 0).length} <span className="text-xs font-semibold text-slate-400 font-normal">Accounts</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Khata Balance Due</div>
            <div className="text-lg font-black text-rose-600 font-mono">
              {formatINR(customers.reduce((acc, c) => acc + (Number(c.credit_balance) || 0), 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Customer Name, Mobile Phone, City..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-pink-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCreditOnly(!creditOnly)}
            className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1 font-semibold transition-colors ${
              creditOnly
                ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-amber-500" />
            <span>Credit Khata Due Only</span>
          </button>
          <span className="text-[11px] font-mono font-bold text-slate-400 px-2">
            Showing: {customers.length}
          </span>
        </div>
      </div>

      {/* Customer Table */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase sticky top-0 z-10">
              <tr>
                <th 
                  onClick={() => toggleSort('name')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Customer Name</span>
                    <span className="text-[10px] text-pink-600">{sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('phone')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Mobile Phone</span>
                    <span className="text-[10px] text-pink-600">{sortField === 'phone' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('city')}
                  className="py-2.5 px-2 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>City</span>
                    <span className="text-[10px] text-pink-600">{sortField === 'city' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-2.5 px-2">Birthday</th>
                <th 
                  onClick={() => toggleSort('total_spend')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Lifetime Spend (₹)</span>
                    <span className="text-[10px] text-pink-600">{sortField === 'total_spend' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('visit_count')}
                  className="py-2.5 px-2 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Visits</span>
                    <span className="text-[10px] text-pink-600">{sortField === 'visit_count' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('credit_balance')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Khata Due (₹)</span>
                    <span className="text-[10px] text-pink-600">{sortField === 'credit_balance' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">Loading customers...</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">No customers found</td>
                </tr>
              ) : (
                [...customers].sort((a: any, b: any) => {
                  if (!sortField || !sortOrder) return 0;
                  const aVal = a[sortField] ?? '';
                  const bVal = b[sortField] ?? '';
                  if (typeof aVal === 'string') {
                    const cmp = aVal.localeCompare(bVal as string);
                    return sortOrder === 'asc' ? cmp : -cmp;
                  }
                  const cmp = (Number(aVal) || 0) - (Number(bVal) || 0);
                  return sortOrder === 'asc' ? cmp : -cmp;
                }).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                      {c.name}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                      {c.phone}
                    </td>

                    <td className="py-2.5 px-2 text-slate-500">
                      {c.city || 'Dhule'}
                    </td>

                    <td className="py-2.5 px-2 text-slate-500 font-mono text-[11px]">
                      {c.date_of_birth || '-'}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-white">
                      {formatINR(c.total_spend)}
                    </td>

                    <td className="py-2.5 px-2 text-center font-mono">
                      {c.visit_count}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-black text-sm">
                      <span className={c.credit_balance > 0 ? 'text-rose-600' : 'text-slate-400'}>
                        {formatINR(c.credit_balance)}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {/* Direct WhatsApp Action */}
                        <button
                          type="button"
                          onClick={() => {
                            const cleanName = (!c.name || /^Customer(\s*\(\d+\))?$/i.test(c.name.trim())) ? 'Customer' : c.name.trim();
                            const shop = settings?.shop_name || 'our store';
                            const addr = settings?.address || 'Agra Road, Near MG Statue, Dhule';
                            const phone = settings?.mobile || '7972558842';
                            const msg = `Hello ${cleanName},\n\nGreetings from *${shop}*! 🛍️✨\nVisit our showroom for brand new festive arrivals & exciting offers!\n\n📍 *${addr}* | 📞 ${phone}`;
                            const cleanPhone = (c.phone || '').replace(/\D/g, '');
                            const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                            window.open(`https://api.whatsapp.com/send/?phone=${finalPhone}&text=${encodeURIComponent(msg)}&type=phone_number&app_absent=0`, '_blank');
                          }}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Send Direct WhatsApp Message"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        {c.credit_balance > 0 && (
                          <button
                            onClick={() => { setKhataCustomer(c); setKhataPayAmount(c.credit_balance); }}
                            className="px-2 py-1 bg-amber-500 text-white rounded-lg font-bold text-[10px] hover:bg-amber-600 transition-colors"
                            title="Collect Khata Payment"
                          >
                            Collect
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Customer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Excel Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 text-xs animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                Bulk Import Customers from Excel
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-500 text-xs">
              Upload an Excel (.xlsx / .xls / .csv) with columns: <strong>Name, Phone, City, Opening Balance</strong>.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
            />

            {importResult && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-[11px]">
                {importResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 text-xs animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-base text-slate-800 dark:text-white">
                {editingCustomer ? 'Edit Customer Profile' : 'Add New Customer'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Mobile Phone (10-Digit) *</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="9822000000"
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Dhule"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
              </div>

              {!editingCustomer && (
                <div>
                  <label className="block font-bold mb-1">Opening Khata Credit Balance (₹)</label>
                  <input
                    type="number"
                    value={formData.opening_credit_balance || ''}
                    onChange={(e) => setFormData({ ...formData, opening_credit_balance: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 font-mono font-bold text-rose-600 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                    min="0"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold mb-1">Birthday (For Festival & Birthday Offers)</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs"
                >
                  {isSaving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Khata Payment Modal */}
      {khataCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-base text-slate-800 dark:text-white">Record Khata Credit Payment</h3>
              <button onClick={() => setKhataCustomer(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <p>Customer: <strong>{khataCustomer.name}</strong> • Current Outstanding: <strong className="text-rose-600">{formatINR(khataCustomer.credit_balance)}</strong></p>
            <form onSubmit={handleKhataPayment} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  value={khataPayAmount}
                  onChange={(e) => setKhataPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 font-mono font-bold text-lg text-emerald-600 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                  min="1"
                  max={khataCustomer.credit_balance}
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Payment Mode</label>
                <select
                  value={khataPayMode}
                  onChange={(e) => setKhataPayMode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end space-x-2 border-t">
                <button type="button" onClick={() => setKhataCustomer(null)} className="px-4 py-2 border rounded-xl font-bold">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
