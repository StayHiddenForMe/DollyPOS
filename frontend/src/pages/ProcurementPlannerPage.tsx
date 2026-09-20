import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { 
  ClipboardList, 
  Truck, 
  UserX, 
  Calendar, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Phone, 
  ShoppingBag, 
  ArrowUpRight, 
  Clock, 
  RotateCw,
  Trash2,
  Check,
  Tag,
  Printer,
  FileText,
  Filter,
  ArrowUpDown,
  Edit3,
  Share2,
  CheckSquare,
  Square,
  Flame,
  Sparkles,
  CheckCircle,
  XCircle,
  Send,
  ListPlus,
  IndianRupee,
  Package
} from 'lucide-react';
import { formatINR } from '../utils/formatters';
import { ProcurementNote } from '../types';
import { buildWhatsAppUrl } from '../utils/whatsappFormatter';

export const ProcurementPlannerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'LOW_STOCK' | 'BUYING_NOTES' | 'LOST_DEMAND'>('LOW_STOCK');
  const [lowStockData, setLowStockData] = useState<any>(null);
  const [lostDemandList, setLostDemandList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter & Sorting for Low Stock Sheet
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'CRITICAL' | 'BUDGET' | 'QTY' | 'NAME'>('CRITICAL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Buying Notes State (Hotkey: F10)
  const [notesList, setNotesList] = useState<ProcurementNote[]>([]);
  const [notesSummary, setNotesSummary] = useState<any>({
    total_count: 0,
    pending_count: 0,
    ordered_count: 0,
    completed_count: 0,
    total_units: 0,
    total_estimated_budget: 0
  });
  const [vendorOptions, setVendorOptions] = useState<string[]>([]);
  const [notesSearch, setNotesSearch] = useState<string>('');
  const [notesStatusFilter, setNotesStatusFilter] = useState<'ALL' | 'PENDING' | 'ORDERED' | 'COMPLETED'>('ALL');
  const [notesVendorFilter, setNotesVendorFilter] = useState<string>('ALL');

  // Quick Add Buying Note Form State
  const [newNoteItemName, setNewNoteItemName] = useState<string>('');
  const [newNoteQty, setNewNoteQty] = useState<number>(1);
  const [newNoteDesc, setNewNoteDesc] = useState<string>('');
  const [newNoteVendor, setNewNoteVendor] = useState<string>('');
  const [newNoteEstPrice, setNewNoteEstPrice] = useState<string>('');
  const [newNotePriority, setNewNotePriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [isAddingNote, setIsAddingNote] = useState<boolean>(false);
  const itemNameInputRef = useRef<HTMLInputElement>(null);

  // Edit Buying Note Modal State
  const [editingNote, setEditingNote] = useState<ProcurementNote | null>(null);
  const [editItemName, setEditItemName] = useState<string>('');
  const [editQty, setEditQty] = useState<number>(1);
  const [editDesc, setEditDesc] = useState<string>('');
  const [editVendor, setEditVendor] = useState<string>('');
  const [editEstPrice, setEditEstPrice] = useState<string>('');
  const [editPriority, setEditPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [editStatus, setEditStatus] = useState<'PENDING' | 'ORDERED' | 'COMPLETED' | 'CANCELLED'>('PENDING');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Lost Demand Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [itemDesc, setItemDesc] = useState('');
  const [categoryName, setCategoryName] = useState('Kids Wear');
  const [preferredSize, setPreferredSize] = useState('');
  const [preferredColor, setPreferredColor] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [urgency, setUrgency] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [notes, setNotes] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab, notesStatusFilter, notesVendorFilter, notesSearch]);

  // Global Keydown Handler: F10 switches to Buying Notes and focuses Item Name input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        setActiveTab('BUYING_NOTES');
        setTimeout(() => {
          itemNameInputRef.current?.focus();
          itemNameInputRef.current?.select();
        }, 60);
      } else if (e.key === 'Escape') {
        if (isLogModalOpen) {
          e.preventDefault();
          setIsLogModalOpen(false);
        }
        if (editingNote) {
          e.preventDefault();
          setEditingNote(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLogModalOpen, editingNote]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'LOW_STOCK') {
        const res = await api.get('/procurement/low-stock-sheet');
        setLowStockData(res.data);
      } else if (activeTab === 'BUYING_NOTES') {
        const params: any = {};
        if (notesStatusFilter !== 'ALL') params.status = notesStatusFilter;
        if (notesVendorFilter !== 'ALL') params.vendor = notesVendorFilter;
        if (notesSearch.trim()) params.search = notesSearch.trim();
        const res = await api.get('/procurement/notes', { params });
        setNotesList(res.data.notes || []);
        setNotesSummary(res.data.summary || {});
        if (res.data.vendor_options) {
          setVendorOptions(res.data.vendor_options);
        }
      } else if (activeTab === 'LOST_DEMAND') {
        const res = await api.get('/procurement/lost-demand');
        setLostDemandList(res.data);
      }
    } catch (e) {
      console.error('Failed to load procurement data', e);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // BUYING NOTES HANDLERS (HOTKEY: F10)
  // -------------------------------------------------------------
  const handleCreateNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newNoteItemName.trim()) return;

    setIsAddingNote(true);
    try {
      await api.post('/procurement/notes', {
        item_name: newNoteItemName.trim(),
        quantity: newNoteQty || 1,
        description: newNoteDesc.trim() || undefined,
        vendor_name: newNoteVendor.trim() || undefined,
        estimated_price: newNoteEstPrice ? parseFloat(newNoteEstPrice) : 0.0,
        priority: newNotePriority
      });

      // Reset form
      setNewNoteItemName('');
      setNewNoteQty(1);
      setNewNoteDesc('');
      setNewNoteVendor('');
      setNewNoteEstPrice('');
      setNewNotePriority('NORMAL');

      // Refresh notes
      const res = await api.get('/procurement/notes');
      setNotesList(res.data.notes || []);
      setNotesSummary(res.data.summary || {});
      if (res.data.vendor_options) setVendorOptions(res.data.vendor_options);

      // Re-focus input for fast consecutive additions
      setTimeout(() => {
        itemNameInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.detail || 'Failed to add buying note'}`);
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleToggleNoteStatus = async (note: ProcurementNote) => {
    const nextStatus = 
      note.status === 'PENDING' ? 'ORDERED' :
      note.status === 'ORDERED' ? 'COMPLETED' : 'PENDING';

    // Optimistic UI update
    setNotesList(prev => prev.map(n => n.id === note.id ? { ...n, status: nextStatus as any } : n));

    try {
      await api.patch(`/procurement/notes/${note.id}/status`, { status: nextStatus });
      const res = await api.get('/procurement/notes');
      setNotesSummary(res.data.summary || {});
    } catch (err) {
      console.error('Failed to update status', err);
      fetchData();
    }
  };

  const handleDeleteNote = async (id: number) => {
    if (!window.confirm('Delete this buying note?')) return;
    setNotesList(prev => prev.filter(n => n.id !== id));
    try {
      await api.delete(`/procurement/notes/${id}`);
      const res = await api.get('/procurement/notes');
      setNotesSummary(res.data.summary || {});
    } catch (err) {
      console.error('Failed to delete note', err);
      fetchData();
    }
  };

  const handleClearCompletedNotes = async () => {
    if (!window.confirm('Clear all completed and cancelled buying notes?')) return;
    try {
      await api.delete('/procurement/notes/clear/completed');
      fetchData();
    } catch (err) {
      console.error('Failed to clear completed notes', err);
    }
  };

  const handleStartEditNote = (note: ProcurementNote) => {
    setEditingNote(note);
    setEditItemName(note.item_name);
    setEditQty(note.quantity);
    setEditDesc(note.description || '');
    setEditVendor(note.vendor_name || '');
    setEditEstPrice(note.estimated_price ? String(note.estimated_price) : '');
    setEditPriority(note.priority);
    setEditStatus(note.status);
  };

  const handleSaveEditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editItemName.trim()) return;

    setIsSavingEdit(true);
    try {
      await api.put(`/procurement/notes/${editingNote.id}`, {
        item_name: editItemName.trim(),
        quantity: editQty || 1,
        description: editDesc.trim() || undefined,
        vendor_name: editVendor.trim() || undefined,
        estimated_price: editEstPrice ? parseFloat(editEstPrice) : 0.0,
        priority: editPriority,
        status: editStatus
      });

      setEditingNote(null);
      fetchData();
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.detail || 'Failed to update buying note'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handlePrintBuyingNotes = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print buying notes');
      return;
    }

    const rows = notesList.map((n, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
        <td>
          <span style="font-weight: bold; font-size: 12px;">${n.item_name}</span>
          ${n.description ? `<br/><span style="color: #64748b; font-size: 10px;">${n.description}</span>` : ''}
        </td>
        <td style="text-align: center; font-weight: bold; font-size: 12px; color: #059669;">${n.quantity} pcs</td>
        <td>${n.vendor_name || 'General / Any'}</td>
        <td style="text-align: center; font-weight: bold; text-transform: uppercase;">${n.priority}</td>
        <td style="text-align: right; font-family: monospace;">₹${Number(n.estimated_price || 0).toFixed(2)}</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold;">₹${Number(n.total_estimated_cost || 0).toFixed(2)}</td>
        <td style="text-align: center;">[ ${n.status} ]</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Buying Notes & Purchase Wishlist — Dolly Toys & Kids Wear</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1e293b; font-size: 11px; }
          .header { border-bottom: 2px solid #ec4899; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 17px; font-weight: bold; color: #be185d; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #f1f5f9; padding: 7px 8px; text-align: left; border-bottom: 2px solid #cbd5e1; }
          td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
          .summary-box { margin-top: 20px; padding: 10px; background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; font-weight: bold; text-align: right; font-size: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">DOLLY TOYS AND KIDS WEAR — BUYING NOTES & PURCHASE WISHLIST</div>
          <div class="subtitle">Agra Road, Near Mahatma Gandhi Statue, Dhule | Phone: 7972558842</div>
          <div class="subtitle">Generated on: ${new Date().toLocaleString('en-IN')} | Filter: ${notesStatusFilter} | Vendor: ${notesVendorFilter}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Item / Product Name & Description</th>
              <th style="text-align: center;">Qty</th>
              <th>Supplier / Vendor</th>
              <th style="text-align: center;">Priority</th>
              <th style="text-align: right;">Est. Rate (₹)</th>
              <th style="text-align: right;">Est. Total (₹)</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="summary-box">
          Total Items: ${notesList.length} | Total Units to Buy: ${notesSummary.total_units || 0} pcs | Estimated Budget: ₹${(notesSummary.total_estimated_budget || 0).toLocaleString('en-IN')}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const handleShareNotesWhatsApp = () => {
    if (notesList.length === 0) {
      alert('No buying notes to share.');
      return;
    }

    const itemsText = notesList.map((n, idx) => 
      `${idx + 1}. *${n.item_name}* (Qty: ${n.quantity} pcs)${n.vendor_name ? ` [Vendor: ${n.vendor_name}]` : ''}${n.description ? `\n   - Note: ${n.description}` : ''}`
    ).join('\n');

    const message = `🛍️ *DOLLY TOYS & KIDS WEAR — MARKET PURCHASE WISHLIST*\n📅 Date: ${new Date().toLocaleDateString('en-IN')}\n------------------------------------\n${itemsText}\n------------------------------------\n📦 Total Items: ${notesList.length} | Units: ${notesSummary.total_units || 0} pcs\n💰 Est. Budget: ₹${(notesSummary.total_estimated_budget || 0).toLocaleString('en-IN')}\n\n_Generated from Dolly POS Buying Planner_`;

    const url = buildWhatsAppUrl('7972558842', message);
    window.open(url, '_blank');
  };

  const handleCreateLostDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDesc.trim()) return;

    setSubmittingLog(true);
    try {
      await api.post('/procurement/lost-demand', {
        item_description: itemDesc.trim(),
        category_name: categoryName,
        preferred_size: preferredSize || undefined,
        preferred_color: preferredColor || undefined,
        customer_name: custName || undefined,
        customer_phone: custPhone || undefined,
        urgency,
        notes: notes || undefined
      });

      setIsLogModalOpen(false);
      setItemDesc('');
      setPreferredSize('');
      setPreferredColor('');
      setCustName('');
      setCustPhone('');
      setNotes('');
      const res = await api.get('/procurement/lost-demand');
      setLostDemandList(res.data);
    } catch (e: any) {
      alert(`Error: ${e.response?.data?.detail || 'Failed to log customer request'}`);
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleUpdateDemandStatus = async (id: number, status: string) => {
    try {
      await api.put(`/procurement/lost-demand/${id}/status`, { status });
      const res = await api.get('/procurement/lost-demand');
      setLostDemandList(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDemand = async (id: number) => {
    if (!confirm('Remove this customer demand log?')) return;
    try {
      await api.delete(`/procurement/lost-demand/${id}`);
      setLostDemandList(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // Filter and sort vendor groups and items
  const getProcessedVendorGroups = () => {
    if (!lowStockData?.vendor_groups) return [];

    let groups = lowStockData.vendor_groups;

    // Filter by Vendor
    if (selectedVendorFilter !== 'ALL') {
      groups = groups.filter((g: any) => g.vendor_code === selectedVendorFilter || g.vendor_name === selectedVendorFilter);
    }

    // Filter items by search term
    return groups.map((g: any) => {
      let filteredItems = g.items;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filteredItems = filteredItems.filter((i: any) => 
          i.name.toLowerCase().includes(q) || 
          i.barcode.toLowerCase().includes(q) ||
          i.size.toLowerCase().includes(q)
        );
      }

      // Sort items
      const sortedItems = [...filteredItems].sort((a: any, b: any) => {
        if (sortBy === 'CRITICAL') return a.current_stock - b.current_stock;
        if (sortBy === 'BUDGET') return b.estimated_cost - a.estimated_cost;
        if (sortBy === 'QTY') return b.suggested_reorder_qty - a.suggested_reorder_qty;
        return a.name.localeCompare(b.name);
      });

      return {
        ...g,
        items: sortedItems,
        total_items_count: sortedItems.length,
        total_estimated_budget: sortedItems.reduce((acc: number, item: any) => acc + item.estimated_cost, 0)
      };
    }).filter((g: any) => g.items.length > 0);
  };

  const processedGroups = getProcessedVendorGroups();
  const totalFilteredUnits = processedGroups.reduce((acc, g) => acc + g.items.reduce((s: number, i: any) => s + i.suggested_reorder_qty, 0), 0);
  const totalFilteredBudget = processedGroups.reduce((acc, g) => acc + g.total_estimated_budget, 0);

  // Print PDF Sheet Function
  const handlePrintBuyingSheet = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to generate print sheet');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Procurement Buying Sheet — Dolly Toys & Kids Wear</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1e293b; font-size: 12px; }
          .header { border-bottom: 2px solid #ec4899; padding-bottom: 10px; margin-bottom: 15px; }
          .title { font-size: 18px; font-weight: bold; color: #be185d; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 3px; }
          .vendor-section { margin-top: 20px; page-break-inside: avoid; }
          .vendor-title { font-size: 14px; font-weight: bold; background: #fdf2f8; padding: 6px 10px; border-left: 4px solid #ec4899; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
          th { background: #f1f5f9; padding: 6px 8px; text-align: left; border-bottom: 1px solid #cbd5e1; }
          td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .font-mono { font-family: monospace; }
          .grand-total { margin-top: 25px; border-top: 2px solid #0f172a; padding-top: 10px; font-size: 13px; font-weight: bold; text-align: right; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">DOLLY TOYS AND KIDS WEAR — WHOLESALE BUYING SHEET</div>
          <div class="subtitle">Agra Road, Near Mahatma Gandhi Statue, Dhule | Phone: 7972558842</div>
          <div class="subtitle">Generated on: ${new Date().toLocaleString('en-IN')} | Scope: ${selectedVendorFilter === 'ALL' ? 'All Vendors & General Stock' : selectedVendorFilter}</div>
        </div>

        ${processedGroups.map(g => `
          <div class="vendor-section">
            <div class="vendor-title">
              [${g.vendor_code}] ${g.vendor_name} — Phone: ${g.vendor_phone} | Budget: ₹${g.total_estimated_budget.toLocaleString('en-IN')}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th class="text-center">Barcode</th>
                  <th class="text-center">Size</th>
                  <th class="text-center">Color</th>
                  <th class="text-right">Stock Left</th>
                  <th class="text-right">Cost (₹)</th>
                  <th class="text-right">Order Qty</th>
                  <th class="text-right">Est. Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${g.items.map((i: any) => `
                  <tr>
                    <td class="bold">${i.name}</td>
                    <td class="text-center font-mono">${i.barcode}</td>
                    <td class="text-center bold">${i.size}</td>
                    <td class="text-center">${i.color}</td>
                    <td class="text-right font-mono">${i.current_stock}</td>
                    <td class="text-right font-mono">₹${i.purchase_price}</td>
                    <td class="text-right font-mono bold" style="color: #059669;">+${i.suggested_reorder_qty} pcs</td>
                    <td class="text-right font-mono bold">₹${i.estimated_cost.toLocaleString('en-IN')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}

        <div class="grand-total">
          Total Order Quantity: +${totalFilteredUnits} pcs | Total Estimated PO Budget: ₹${totalFilteredBudget.toLocaleString('en-IN')}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-pink-500" />
            Smart Procurement & Market Buying Planner
          </h1>
          <p className="text-xs text-slate-500">
            Supplier Buying Sheet by Vendor Code, General Unlinked Stock, Lost Customer Demand Logger & Festival Checklists.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'LOW_STOCK' && (
            <button
              onClick={handlePrintBuyingSheet}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              title="Print / Save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-pink-400" />
              <span>Print / PDF Buying Sheet</span>
            </button>
          )}

          {activeTab === 'BUYING_NOTES' && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrintBuyingNotes}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                title="Print Buying Notes"
              >
                <Printer className="w-3.5 h-3.5 text-pink-400" />
                <span>Print Notes</span>
              </button>

              <button
                onClick={handleShareNotesWhatsApp}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                title="Share Buying List on WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share WhatsApp</span>
              </button>

              {notesSummary.completed_count > 0 && (
                <button
                  onClick={handleClearCompletedNotes}
                  className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95"
                  title="Clear Completed Notes"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Done ({notesSummary.completed_count})</span>
                </button>
              )}
            </div>
          )}

          {activeTab === 'LOST_DEMAND' && (
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="px-3.5 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-pink-600/30 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Lost Customer Request</span>
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold hover:text-pink-600"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-pink-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit text-xs font-bold">
        {[
          { id: 'LOW_STOCK', label: 'Low Stock Buying Sheet', icon: Truck },
          { id: 'BUYING_NOTES', label: 'Buying Notes & Wishlist', icon: FileText, hotkey: 'F10', count: notesSummary.pending_count },
          { id: 'LOST_DEMAND', label: 'Customer Lost Demand Log', icon: UserX },
        ].map((tab: any) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {tab.hotkey && (
              <kbd className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                activeTab === tab.id ? 'bg-pink-700/80 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                {tab.hotkey}
              </kbd>
            )}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === tab.id ? 'bg-white text-pink-700' : 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col p-4">
        {/* TAB 1: LOW STOCK PROCUREMENT SHEET BY VENDOR */}
        {activeTab === 'LOW_STOCK' && lowStockData && (
          <div className="h-full flex flex-col space-y-3 overflow-hidden">
            {/* Filter & Sorting Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-xs">
              <div className="flex items-center space-x-2 flex-1">
                {/* Vendor Filter Dropdown */}
                <div className="flex items-center space-x-1.5 min-w-[220px]">
                  <Truck className="w-3.5 h-3.5 text-pink-500" />
                  <select
                    value={selectedVendorFilter}
                    onChange={(e) => setSelectedVendorFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs focus:outline-none focus:border-pink-500"
                  >
                    <option value="ALL">All Vendors & General ({lowStockData.total_low_stock_products} items)</option>
                    {lowStockData.vendor_groups.map((vg: any, idx: number) => (
                      <option key={idx} value={vg.vendor_code || vg.vendor_name}>
                        {vg.vendor_code === 'GENERAL' ? '🏷️ General / Unassigned Market Stock' : `[${vg.vendor_code}] ${vg.vendor_name} (${vg.total_items_count} items)`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search in low stock */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter by product name, barcode, size..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-xl text-xs font-medium focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              {/* Sorting Options */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3" /> Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-xl font-bold text-xs focus:outline-none"
                >
                  <option value="CRITICAL">⚠️ Lowest Stock First (Most Critical)</option>
                  <option value="BUDGET">💰 Highest Estimated Cost First</option>
                  <option value="QTY">📦 Highest Order Quantity First</option>
                  <option value="NAME">🔤 Product Name (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border bg-rose-50/40 dark:bg-rose-950/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-rose-600 uppercase block">Filtered Items to Buy</span>
                  <div className="text-xl font-black font-mono text-rose-600">
                    {processedGroups.reduce((acc, g) => acc + g.total_items_count, 0)} SKUs
                  </div>
                </div>
                <Tag className="w-5 h-5 text-rose-400" />
              </div>

              <div className="p-3 rounded-xl border bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Units to Order</span>
                  <div className="text-xl font-black font-mono text-emerald-600">
                    +{totalFilteredUnits} pcs
                  </div>
                </div>
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
              </div>

              <div className="p-3 rounded-xl border bg-pink-50/40 dark:bg-pink-950/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-pink-600 uppercase block">Estimated Procurement Budget</span>
                  <div className="text-xl font-black font-mono text-pink-600">
                    {formatINR(totalFilteredBudget)}
                  </div>
                </div>
                <Truck className="w-5 h-5 text-pink-400" />
              </div>
            </div>

            {/* Vendor Groups List */}
            <div className="flex-1 overflow-y-auto space-y-3 pt-1">
              {processedGroups.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  ✓ No low-stock products matching the selected filter.
                </div>
              ) : (
                processedGroups.map((vGroup: any, idx: number) => (
                  <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-slate-50/50 dark:bg-slate-950/30 space-y-2">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded font-mono font-black text-xs ${vGroup.vendor_code === 'GENERAL' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300'}`}>
                          {vGroup.vendor_code === 'GENERAL' ? 'GENERAL' : vGroup.vendor_code}
                        </span>
                        <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                          {vGroup.vendor_name}
                        </h3>
                        {vGroup.vendor_phone !== 'N/A' && (
                          <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-500" /> {vGroup.vendor_phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-4 text-xs font-mono">
                        <span className="text-slate-500 font-bold">{vGroup.total_items_count} SKUs</span>
                        <span className="text-emerald-600 font-black">Budget: {formatINR(vGroup.total_estimated_budget)}</span>
                      </div>
                    </div>

                    {/* Vendor Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="text-[10px] font-bold text-slate-400 uppercase">
                          <tr>
                            <th className="py-1 px-2">Product Name</th>
                            <th className="py-1 px-2 text-center">Barcode</th>
                            <th className="py-1 px-2 text-center">Size</th>
                            <th className="py-1 px-2 text-center">Color</th>
                            <th className="py-1 px-2 text-right text-rose-600">Stock Left</th>
                            <th className="py-1 px-2 text-right">Cost (₹)</th>
                            <th className="py-1 px-2 text-right font-bold text-emerald-600">Order Qty</th>
                            <th className="py-1 px-2 text-right font-mono font-bold">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {vGroup.items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                              <td className="py-2 px-2 font-bold text-slate-800 dark:text-white">
                                {item.name}
                              </td>
                              <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-400">
                                {item.barcode}
                              </td>
                              <td className="py-2 px-2 text-center font-mono font-bold">
                                {item.size}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-500">
                                {item.color}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-rose-600">
                                {item.current_stock} pcs (Min: {item.min_stock_alert})
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {formatINR(item.purchase_price)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-black text-emerald-600">
                                +{item.suggested_reorder_qty} pcs
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-slate-800 dark:text-white">
                                {formatINR(item.estimated_cost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOM BUYING NOTES & PURCHASE WISHLIST (HOTKEY: F10) */}
        {activeTab === 'BUYING_NOTES' && (
          <div className="h-full flex flex-col space-y-3 overflow-hidden">
            {/* Top Stat Metrics */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-pink-50/60 dark:bg-pink-950/30 rounded-2xl border border-pink-200 dark:border-pink-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider block">Pending Notes</span>
                  <span className="text-xl font-black text-slate-800 dark:text-white font-mono">{notesSummary.pending_count || 0} items</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-900/60 text-pink-600 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Total Units to Buy</span>
                  <span className="text-xl font-black text-emerald-600 font-mono">{notesSummary.total_units || 0} pcs</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Est. PO Budget</span>
                  <span className="text-xl font-black text-indigo-600 font-mono">{formatINR(notesSummary.total_estimated_budget || 0)}</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 flex items-center justify-center font-bold">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Ordered / With Vendor</span>
                  <span className="text-xl font-black text-amber-600 font-mono">{notesSummary.ordered_count || 0} items</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 flex items-center justify-center font-bold">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Fast Entry Quick Add Bar (F10 Focus Target) */}
            <form 
              onSubmit={handleCreateNote}
              className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border-2 border-pink-500/40 dark:border-pink-500/30 space-y-2 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ListPlus className="w-4 h-4 text-pink-500" />
                  ⚡ Quick Add Buying Note
                  <kbd className="ml-1 px-1.5 py-0.2 bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 rounded font-mono text-[10px]">F10</kbd>
                </span>
                <span className="text-[10.5px] text-slate-400">
                  Type what you want to buy, quantity & description • Press <strong className="text-slate-600 dark:text-slate-300">Enter</strong> to save
                </span>
              </div>

              <div className="grid grid-cols-12 gap-2 text-xs">
                {/* 1. Item Name */}
                <div className="col-span-4">
                  <input
                    ref={itemNameInputRef}
                    type="text"
                    required
                    placeholder="Product / Item Name to buy * (e.g. Barbie Doctor Set, Boys Velvet Coat)"
                    value={newNoteItemName}
                    onChange={(e) => setNewNoteItemName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                  />
                </div>

                {/* 2. Quantity */}
                <div className="col-span-1">
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Qty"
                    value={newNoteQty}
                    onChange={(e) => setNewNoteQty(parseInt(e.target.value) || 1)}
                    className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-center text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                    title="Quantity to Buy (Pieces / Packs)"
                  />
                </div>

                {/* 3. Description / Size / Color */}
                <div className="col-span-3">
                  <input
                    type="text"
                    placeholder="Description / size / color (e.g. Size 28-32, festive red)"
                    value={newNoteDesc}
                    onChange={(e) => setNewNoteDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* 4. Vendor (Optional) */}
                <div className="col-span-2">
                  <input
                    type="text"
                    list="procurement-vendor-suggestions"
                    placeholder="Vendor (Optional)"
                    value={newNoteVendor}
                    onChange={(e) => setNewNoteVendor(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:border-pink-500"
                  />
                  <datalist id="procurement-vendor-suggestions">
                    {vendorOptions.map((v, i) => (
                      <option key={i} value={v} />
                    ))}
                  </datalist>
                </div>

                {/* 5. Est. Price */}
                <div className="col-span-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="₹ Est."
                    value={newNoteEstPrice}
                    onChange={(e) => setNewNoteEstPrice(e.target.value)}
                    className="w-full px-2 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-white focus:outline-none focus:border-pink-500 text-right"
                    title="Estimated Price per unit (₹)"
                  />
                </div>

                {/* 6. Submit Button */}
                <div className="col-span-1 flex items-center">
                  <button
                    type="submit"
                    disabled={isAddingNote || !newNoteItemName.trim()}
                    className="w-full h-full py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-1 shadow-md shadow-pink-600/30 transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Filter & Search Bar */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-1.5">
                {[
                  { id: 'ALL', label: `All (${notesSummary.total_count || 0})` },
                  { id: 'PENDING', label: `⏳ Pending (${notesSummary.pending_count || 0})` },
                  { id: 'ORDERED', label: `🚚 Ordered (${notesSummary.ordered_count || 0})` },
                  { id: 'COMPLETED', label: `✓ Completed (${notesSummary.completed_count || 0})` },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setNotesStatusFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                      notesStatusFilter === f.id
                        ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-md">
                {vendorOptions.length > 0 && (
                  <select
                    value={notesVendorFilter}
                    onChange={(e) => setNotesVendorFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-semibold text-xs focus:outline-none"
                  >
                    <option value="ALL">All Vendors ({vendorOptions.length})</option>
                    {vendorOptions.map((v, i) => (
                      <option key={i} value={v}>{v}</option>
                    ))}
                  </select>
                )}

                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search buying notes..."
                    value={notesSearch}
                    onChange={(e) => setNotesSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-semibold focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>
            </div>

            {/* Buying Notes Table List */}
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10.5px] font-bold text-slate-400 uppercase sticky top-0 z-10 border-b">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center">Status</th>
                    <th className="py-2.5 px-3">Item / Product Name & Notes</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3">Supplier / Vendor</th>
                    <th className="py-2.5 px-3 text-center">Priority</th>
                    <th className="py-2.5 px-3 text-right">Est. Unit (₹)</th>
                    <th className="py-2.5 px-3 text-right">Est. Total (₹)</th>
                    <th className="py-2.5 px-3 text-center">Added Time</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {notesList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-slate-400 text-xs">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600 opacity-60" />
                        <span className="font-bold block">No buying notes found</span>
                        <span className="text-[11px]">Press <strong>F10</strong> or type above to add items to your purchase wishlist.</span>
                      </td>
                    </tr>
                  ) : (
                    notesList.map((note) => {
                      const isCompleted = note.status === 'COMPLETED';
                      const isOrdered = note.status === 'ORDERED';
                      return (
                        <tr 
                          key={note.id} 
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            isCompleted ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/20' : ''
                          }`}
                        >
                          {/* 1. Status Toggle Checkbox */}
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleNoteStatus(note)}
                              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-90"
                              title={`Click to cycle status (Current: ${note.status})`}
                            >
                              {isCompleted ? (
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                              ) : isOrdered ? (
                                <Truck className="w-4 h-4 text-amber-500" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                              )}
                            </button>
                          </td>

                          {/* 2. Item Name & Description */}
                          <td className="py-2 px-3">
                            <span className={`font-bold text-xs block ${
                              isCompleted 
                                ? 'line-through text-slate-400 dark:text-slate-500' 
                                : 'text-slate-900 dark:text-white'
                            }`}>
                              {note.item_name}
                            </span>
                            {note.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                                {note.description}
                              </p>
                            )}
                          </td>

                          {/* 3. Quantity */}
                          <td className="py-2 px-3 text-center font-mono font-black text-xs text-emerald-600">
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                              {note.quantity} pcs
                            </span>
                          </td>

                          {/* 4. Vendor */}
                          <td className="py-2 px-3">
                            {note.vendor_name ? (
                              <span className="font-semibold text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800/60">
                                🏢 {note.vendor_name}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">General Market</span>
                            )}
                          </td>

                          {/* 5. Priority Badge */}
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              note.priority === 'URGENT' 
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : note.priority === 'HIGH'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : note.priority === 'LOW'
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              {note.priority}
                            </span>
                          </td>

                          {/* 6. Est. Unit Price */}
                          <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300 text-xs">
                            {note.estimated_price ? formatINR(note.estimated_price) : '—'}
                          </td>

                          {/* 7. Est. Total */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {note.total_estimated_cost ? formatINR(note.total_estimated_cost) : '—'}
                          </td>

                          {/* 8. Timestamp */}
                          <td className="py-2 px-3 text-center text-[10.5px] font-mono text-slate-400">
                            {note.created_at || '—'}
                          </td>

                          {/* 9. Actions */}
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Quick Cycle Status Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleNoteStatus(note)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                  note.status === 'PENDING'
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200'
                                    : note.status === 'ORDERED'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                                title="Advance status"
                              >
                                {note.status === 'PENDING' ? 'Mark Ordered' : note.status === 'ORDERED' ? 'Mark Done ✓' : 'Reopen'}
                              </button>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleStartEditNote(note)}
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                                title="Edit note"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                title="Delete note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
        )}

        {/* TAB 3: CUSTOMER LOST DEMAND LOG */}
        {activeTab === 'LOST_DEMAND' && (
          <div className="h-full flex flex-col space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Customer Out-of-Stock & Unmet Requests ({lostDemandList.length} items logged)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Track exact items customers asked for so you never miss buying them when visiting supplier wholesale markets.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase sticky top-0 z-10 border-b">
                  <tr>
                    <th className="py-2 px-3">Item Requested / Need Description</th>
                    <th className="py-2 px-2 text-center">Category</th>
                    <th className="py-2 px-2 text-center">Size / Color</th>
                    <th className="py-2 px-2 text-center">Demand Count</th>
                    <th className="py-2 px-2 text-center">Customer</th>
                    <th className="py-2 px-2 text-center">Urgency</th>
                    <th className="py-2 px-2 text-center">Procurement Status</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {lostDemandList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        No customer lost demand logged yet. Click "+ Log Lost Customer Request" above when a customer asks for a missing item!
                      </td>
                    </tr>
                  ) : (
                    lostDemandList.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800 dark:text-white block">{log.item_description}</span>
                          {log.notes && <span className="text-[10px] text-slate-400 italic">{log.notes}</span>}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500">
                          {log.category_name}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {log.preferred_size} • {log.preferred_color}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950 font-black text-pink-700 dark:text-pink-300 font-mono text-[11px]">
                            {log.request_count}x Asked
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-[11px]">
                          <span className="font-semibold block">{log.customer_name}</span>
                          {log.customer_phone !== 'N/A' && <span className="font-mono text-slate-400">{log.customer_phone}</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.urgency === 'URGENT' ? 'bg-rose-100 text-rose-800' : (log.urgency === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')}`}>
                            {log.urgency}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <select
                            value={log.status}
                            onChange={(e) => handleUpdateDemandStatus(log.id, e.target.value)}
                            className={`px-2 py-1 rounded-xl text-[10px] font-bold border ${log.status === 'FULFILLED' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : (log.status === 'ORDERED_WITH_VENDOR' ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-amber-50 text-amber-800 border-amber-300')}`}
                          >
                            <option value="PENDING_PROCUREMENT">⏳ Pending Buy</option>
                            <option value="ORDERED_WITH_VENDOR">📦 Ordered with Vendor</option>
                            <option value="FULFILLED">✓ Stock Arrived & Fulfilled</option>
                          </select>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            onClick={() => handleDeleteDemand(log.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* QUICK LOG LOST DEMAND MODAL */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-pink-500" />
                  Log Customer Out-of-Stock / Missing Demand
                </h2>
                <p className="text-xs text-slate-400">
                  Quickly record what a customer wanted so the owner can procure it in market.
                </p>
              </div>
              <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateLostDemand} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Item Description / What did the customer ask for? *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Size 28 Black Tuxedo Suit, Frozen Character Raincoat, Hot Wheels Monster Truck"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-pink-400 rounded-xl font-bold focus:outline-none focus:border-pink-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Category</label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Boys Wear"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Size Needed</label>
                  <input
                    type="text"
                    value={preferredSize}
                    onChange={(e) => setPreferredSize(e.target.value)}
                    placeholder="Size 28 / 4-5Y"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Color</label>
                  <input
                    type="text"
                    value={preferredColor}
                    onChange={(e) => setPreferredColor(e.target.value)}
                    placeholder="Black / Navy"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Customer Name (Optional)</label>
                  <input
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Customer Mobile (Optional)</label>
                  <input
                    type="text"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">Notes / Extra details</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Customer needed for wedding on Friday"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLog}
                  className="px-5 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl shadow-md shadow-pink-600/30"
                >
                  {submittingLog ? 'Saving...' : 'Save Demand Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BUYING NOTE MODAL */}
      {editingNote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-pink-500" />
                  Edit Buying Note #{editingNote.id}
                </h2>
                <p className="text-xs text-slate-400">
                  Update item requirements, quantity, supplier or procurement status.
                </p>
              </div>
              <button onClick={() => setEditingNote(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveEditNote} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Item / Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-pink-400 rounded-xl font-bold focus:outline-none focus:border-pink-600 text-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Quantity to Buy (pcs) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editQty}
                    onChange={(e) => setEditQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono font-bold text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Est. Price per unit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editEstPrice}
                    onChange={(e) => setEditEstPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">Supplier / Vendor</label>
                <input
                  type="text"
                  list="edit-vendor-suggestions"
                  value={editVendor}
                  onChange={(e) => setEditVendor(e.target.value)}
                  placeholder="e.g. Mahavir Garments, Mumbai Toy Market"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-800 dark:text-white"
                />
                <datalist id="edit-vendor-suggestions">
                  {vendorOptions.map((v, i) => (
                    <option key={i} value={v} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">Description / Size / Color Notes</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Additional specifications or customer notes..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-800 dark:text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">🚨 Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Procurement Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                  >
                    <option value="PENDING">⏳ Pending</option>
                    <option value="ORDERED">🚚 Ordered with Vendor</option>
                    <option value="COMPLETED">✓ Completed / Stocked</option>
                    <option value="CANCELLED">✕ Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl shadow-md shadow-pink-600/30"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
