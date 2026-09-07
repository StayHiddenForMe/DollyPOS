import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Vendor, Product } from '../types';
import { Truck, Plus, Trash2, CheckCircle2, History, Package } from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const PurchasePage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<number | undefined>();
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [shippingCharges, setShippingCharges] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [viewTab, setViewTab] = useState<'NEW' | 'HISTORY'>('NEW');

  useEffect(() => {
    fetchVendors();
    fetchProducts();
    fetchHistory();
  }, []);

  const fetchVendors = async () => {
    try {
      const res = await api.get('/vendors');
      setVendors(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/inventory?page=1&page_size=200');
      setProducts(res.data.items);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/vendors/purchases/history');
      setHistory(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const addItemRow = (prodId: number) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    setItems(prev => [
      ...prev,
      {
        product_id: prod.id,
        name: prod.name,
        barcode: prod.barcode,
        quantity: 10,
        cost_price: prod.purchase_price,
        selling_price: prod.selling_price,
        gst_percent: prod.gst_percent || 0
      }
    ]);
  };

  const removeItemRow = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, i) => sum + (i.cost_price * i.quantity), 0);
  const taxTotal = items.reduce((sum, i) => sum + ((i.cost_price * i.quantity) * (i.gst_percent / 100)), 0);
  const grandTotal = Math.round(subtotal + taxTotal + shippingCharges - discountAmount);

  const handleSubmitInward = async () => {
    if (!selectedVendor) {
      alert('Please select a vendor/supplier');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        vendor_id: selectedVendor,
        supplier_invoice_no: supplierInvoiceNo || undefined,
        shipping_charges: shippingCharges,
        discount_amount: discountAmount,
        paid_amount: paidAmount,
        payment_mode: paymentMode,
        notes: notes || undefined,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          cost_price: i.cost_price,
          selling_price: i.selling_price,
          gst_percent: i.gst_percent
        }))
      };

      await api.post('/vendors/purchases', payload);
      alert('Stock inward recorded! Inventory counts and vendor dues updated.');
      setItems([]);
      setSupplierInvoiceNo('');
      setPaidAmount(0);
      fetchHistory();
      setViewTab('HISTORY');
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to record purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-pink-500" />
            Stock Inward & Purchase Orders
          </h1>
          <p className="text-xs text-slate-500">
            Record incoming stock shipments from Surat, Delhi, Mumbai vendors and update stock.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setViewTab('NEW')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewTab === 'NEW' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            New Stock Inward
          </button>
          <button
            onClick={() => setViewTab('HISTORY')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewTab === 'HISTORY' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Purchase History
          </button>
        </div>
      </div>

      {viewTab === 'NEW' ? (
        <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
          {/* Left Column: Vendor & Item Selection */}
          <div className="col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col p-4 space-y-4 overflow-hidden">
            {/* Vendor & Supplier Bill Details */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor / Supplier *
                </label>
                <select
                  value={selectedVendor || ''}
                  onChange={(e) => setSelectedVendor(parseInt(e.target.value) || undefined)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                >
                  <option value="">Select Vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.city || 'India'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier Invoice / Bill No
                </label>
                <input
                  type="text"
                  value={supplierInvoiceNo}
                  onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                  placeholder="e.g. INV-8821"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Add Product to Inward
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addItemRow(parseInt(e.target.value));
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-3 py-2 bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 border border-pink-300 rounded-xl font-semibold focus:outline-none"
                >
                  <option value="">+ Choose Product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.barcode})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inward Items Table */}
            <div className="flex-1 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                  <Package className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs font-semibold">No items added to this inward shipment</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3 w-24">Inward Qty</th>
                      <th className="py-2 px-3 text-right w-28">Cost Price (₹)</th>
                      <th className="py-2 px-3 text-right w-28">Selling Price (₹)</th>
                      <th className="py-2 px-3 text-right w-28">Total (₹)</th>
                      <th className="py-2 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-white">
                          {row.name}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => {
                              const q = parseInt(e.target.value) || 1;
                              setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: q } : it));
                            }}
                            className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded font-mono font-bold text-center"
                            min="1"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={row.cost_price}
                            onChange={(e) => {
                              const cp = parseFloat(e.target.value) || 0;
                              setItems(prev => prev.map((it, i) => i === idx ? { ...it, cost_price: cp } : it));
                            }}
                            className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded font-mono text-right"
                            min="0"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={row.selling_price}
                            onChange={(e) => {
                              const sp = parseFloat(e.target.value) || 0;
                              setItems(prev => prev.map((it, i) => i === idx ? { ...it, selling_price: sp } : it));
                            }}
                            className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded font-mono text-right font-bold text-pink-600"
                            min="0"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-bold font-mono">
                          {formatINR(row.cost_price * row.quantity)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button onClick={() => removeItemRow(idx)} className="text-slate-400 hover:text-rose-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Column: Financials & Settlement */}
          <div className="col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3 text-xs">
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                Purchase Order Summary
              </h3>

              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Items Subtotal:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{formatINR(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>Shipping / Transport:</span>
                <input
                  type="number"
                  value={shippingCharges || ''}
                  onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-24 px-2 py-1 text-right bg-slate-50 dark:bg-slate-800 border rounded-lg font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-between">
                <span>Discount / Rebate:</span>
                <input
                  type="number"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-24 px-2 py-1 text-right bg-slate-50 dark:bg-slate-800 border rounded-lg font-mono text-xs text-rose-600"
                />
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-pink-400">Grand Total Cost</span>
                <div className="text-2xl font-black font-mono mt-0.5">{formatINR(grandTotal)}</div>
              </div>

              <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Paid Now:</span>
                  <input
                    type="number"
                    value={paidAmount || ''}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-28 px-2 py-1 text-right bg-emerald-50 dark:bg-slate-800 border border-emerald-300 rounded-lg font-bold font-mono text-emerald-700"
                  />
                </div>

                <div className="flex justify-between text-xs font-bold text-amber-600">
                  <span>Vendor Due Added:</span>
                  <span className="font-mono">{formatINR(Math.max(0, grandTotal - paidAmount))}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmitInward}
              disabled={isSubmitting || items.length === 0}
              className="w-full py-3.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md shadow-pink-600/30 flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Record Inward Stock</span>
            </button>
          </div>
        </div>
      ) : (
        /* Purchase History View */
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col p-4">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">PO Number</th>
                  <th className="py-2.5 px-3">Vendor Name</th>
                  <th className="py-2.5 px-3">Supplier Inv</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Total Amount (₹)</th>
                  <th className="py-2.5 px-3 text-right">Paid Amount (₹)</th>
                  <th className="py-2.5 px-3 text-right">Due (₹)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map(po => (
                  <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-white">{po.purchase_number}</td>
                    <td className="py-2.5 px-3 font-medium">{po.vendor_name || 'Vendor'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{po.supplier_invoice_no || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-500">{new Date(po.created_at).toLocaleDateString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">{formatINR(po.total_amount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600">{formatINR(po.paid_amount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-600">{formatINR(po.due_amount)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        po.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {po.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
