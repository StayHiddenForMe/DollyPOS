import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Expense } from '../types';
import { useAuthStore } from '../store/authStore';
import { 
  Wallet, 
  Plus, 
  Trash2, 
  IndianRupee, 
  PieChart, 
  Filter, 
  X,
  Calendar,
  Layers,
  Search,
  RotateCcw
} from 'lucide-react';
import { formatINR, formatISTDate } from '../utils/formatters';

const EXPENSE_CATEGORIES = [
  'ELECTRICITY',
  'TRANSPORT',
  'FOOD',
  'MISCELLANEOUS',
  'MARKETING',
  'REPAIRS',
  'STAFF_SALARY',
  'SHOP_RENT',
  'OTHER'
];

export const ExpensePage: React.FC = () => {
  const { isOwner } = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filters State
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly' | 'custom' | 'all'>('monthly');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    category: 'MISCELLANEOUS',
    amount: '',
    payment_mode: 'CASH',
    paid_to: '',
    notes: ''
  });

  useEffect(() => {
    fetchExpenses();
  }, [period, selectedCategory, startDate, endDate]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isAddModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsAddModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      let url = `/expenses?period=${period}&limit=500`;
      if (selectedCategory !== 'ALL') {
        url += `&category=${selectedCategory}`;
      }
      if (period === 'custom') {
        if (startDate) url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;
      }
      const res = await api.get(url);
      setExpenses(res.data);
    } catch (e) {
      console.error('Failed to fetch expenses', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setPeriod('monthly');
    setSelectedCategory('ALL');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  const isFilterActive = period !== 'monthly' || selectedCategory !== 'ALL' || startDate !== '' || endDate !== '' || searchQuery !== '';

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) return;

    try {
      await api.post('/expenses', {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      setIsAddModalOpen(false);
      setFormData({ title: '', category: 'MISCELLANEOUS', amount: '', payment_mode: 'CASH', paid_to: '', notes: '' });
      fetchExpenses();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add expense');
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!isOwner()) {
      alert('Only store owners can delete expenses');
      return;
    }
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchExpenses();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkDelete = async () => {
    if (!isOwner()) {
      alert('Only store owners can perform bulk deletions.');
      return;
    }
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected expenses?`)) return;

    try {
      await api.post('/expenses/bulk-delete', { expense_ids: selectedIds });
      setSelectedIds([]);
      fetchExpenses();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredExpenses.map(e => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Filtered expenses based on search query
  const filteredExpenses = expenses.filter(e => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchTitle = e.title && e.title.toLowerCase().includes(q);
    const matchPayee = e.paid_to && e.paid_to.toLowerCase().includes(q);
    const matchNotes = e.notes && e.notes.toLowerCase().includes(q);
    const matchCat = e.category && e.category.toLowerCase().includes(q);
    return matchTitle || matchPayee || matchNotes || matchCat;
  });

  const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Compute Category Spend Breakdown
  const categoryBreakdown = filteredExpenses.reduce((acc: Record<string, number>, exp) => {
    const cat = exp.category || 'MISCELLANEOUS';
    acc[cat] = (acc[cat] || 0) + exp.amount;
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-pink-500" />
            Operating Expense Tracker
          </h1>
          <p className="text-xs text-slate-500">
            Log showroom rent, electricity bills, staff salary, refreshments, and auto-deduct from P&L gross trading profit.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isOwner() && selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Bulk Delete ({selectedIds.length})</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-pink-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Filter Control Bar (Daily, Monthly, Yearly, Custom Range + Search + Category + Clear) */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Period Selector Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {[
            { id: 'daily', label: 'Today / Daily' },
            { id: 'monthly', label: 'This Month' },
            { id: 'yearly', label: 'This Year' },
            { id: 'custom', label: '📅 Custom Range' },
            { id: 'all', label: 'All Time' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                period === p.id
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Pickers (if Custom Range selected) */}
        {period === 'custom' && (
          <div className="flex items-center space-x-2 bg-pink-50/60 dark:bg-pink-950/20 p-1 px-2.5 rounded-xl border border-pink-200 dark:border-pink-800 animate-in fade-in duration-150">
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-bold text-slate-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-bold text-slate-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
          <input
            type="text"
            placeholder="Search title, payee, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-pink-500 font-mono"
          />
        </div>

        {/* Category Filter Dropdown */}
        <div className="flex items-center space-x-1.5">
          <span className="font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-pink-500" />
            Category:
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold text-slate-700 dark:text-slate-200 focus:outline-none text-xs"
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Clear Filters Button */}
        {isFilterActive && (
          <button
            onClick={handleClearFilters}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
            title="Reset all date, search, and category filters"
          >
            <RotateCcw className="w-3.5 h-3.5 text-pink-600" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Summary KPI Cards & Category Spend Breakdown */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">
            Total {period === 'daily' ? 'Today' : (period === 'monthly' ? 'This Month' : (period === 'yearly' ? 'This Year' : (period === 'custom' ? 'Custom Range' : 'All')))} Expenses
          </span>
          <div className="text-2xl font-black font-mono text-rose-600 mt-0.5">{formatINR(totalExpense)}</div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            Showing {filteredExpenses.length} of {expenses.length} voucher(s)
          </span>
        </div>

        {/* Category Spend Breakdown Chips */}
        <div className="col-span-9 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Spend By Category Breakdown ({period === 'custom' ? 'Custom Range' : period})
          </span>
          <div className="flex flex-wrap gap-2 max-h-16 overflow-y-auto">
            {Object.keys(categoryBreakdown).length === 0 ? (
              <div className="text-xs text-slate-400">No expenses recorded for this filter criteria</div>
            ) : (
              Object.entries(categoryBreakdown).map(([cat, amt]) => (
                <div
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
                  className={`px-2.5 py-1 rounded-xl border text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer transition-all ${
                    selectedCategory === cat
                      ? 'border-pink-600 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  <span className="font-sans font-semibold">{cat}:</span>
                  <span className="text-rose-600">{formatINR(amt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase sticky top-0 z-10">
              <tr>
                {isOwner() && (
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="rounded text-pink-600"
                    />
                  </th>
                )}
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Title / Details</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Paid To</th>
                <th className="py-2.5 px-3">Payment Mode</th>
                <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                <th className="py-2.5 px-3">Logged By</th>
                {isOwner() && <th className="py-2.5 px-3 text-center w-12">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading expenses...</td></tr>
              ) : filteredExpenses.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No expenses recorded for this filter criteria</td></tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {isOwner() && (
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(exp.id)}
                          onChange={() => toggleSelectOne(exp.id)}
                          className="rounded text-pink-600"
                        />
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{formatISTDate(exp.expense_date)}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-white">{exp.title}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full font-bold text-[10px] text-slate-600 dark:text-slate-300">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{exp.paid_to || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{exp.payment_mode || 'CASH'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">{formatINR(exp.amount)}</td>
                    <td className="py-2.5 px-3 text-slate-400">{exp.logged_by_name || 'Owner'}</td>
                    {isOwner() && (
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-slate-300 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-slate-800 dark:text-white">Record Daily Expense</h3>
              <button onClick={() => setIsAddModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Expense Title / Description *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Electricity Bill, Staff Lunch, Transport Rickshaw"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 font-bold font-mono text-rose-600 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                    required
                    min="1"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Paid To / Recipient</label>
                <input
                  type="text"
                  value={formData.paid_to}
                  onChange={(e) => setFormData({ ...formData, paid_to: e.target.value })}
                  placeholder="e.g. MSEB Dhule, Chaiwala, Transporter"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Payment Mode</label>
                <select
                  value={formData.payment_mode}
                  onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl border">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded-xl bg-pink-600 text-white font-bold">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
