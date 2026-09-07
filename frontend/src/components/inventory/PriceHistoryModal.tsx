import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Product, ProductPriceHistory } from '../../types';
import { History, X, TrendingUp, Calendar, User, IndianRupee } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface PriceHistoryModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  isOpen,
  product,
  onClose
}) => {
  const [history, setHistory] = useState<ProductPriceHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      fetchHistory();
    }
  }, [isOpen, product]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchHistory = async () => {
    if (!product) return;
    setLoading(true);
    try {
      const res = await api.get(`/inventory/${product.id}/price-history`);
      setHistory(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
              <History className="w-4 h-4 text-pink-500" />
              Price Evolution History
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              {product.name} ({product.size || 'No Size'} • {product.color || 'No Color'})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Price Summary */}
        <div className="p-3 bg-pink-50/50 dark:bg-slate-800/40 border-b grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Cost</span>
            <span className="font-mono font-bold">{formatINR(product.purchase_price)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Selling Price</span>
            <span className="font-mono font-black text-pink-600 text-sm">{formatINR(product.selling_price)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Current MRP</span>
            <span className="font-mono font-bold">{formatINR(product.mrp)}</span>
          </div>
        </div>

        {/* History Timeline */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-xs text-slate-400">Loading price logs...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No price change logs found for this product yet.</div>
          ) : (
            history.map((h, idx) => (
              <div key={idx} className="p-3 rounded-2xl border bg-slate-50 dark:bg-slate-800/50 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-500 border-b pb-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3 text-pink-500" />
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 font-semibold">
                    <User className="w-3 h-3 text-slate-400" />
                    {h.changed_by || 'Admin'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Cost Price</span>
                    <span className="font-mono font-bold">
                      {h.old_purchase_price > 0 ? `₹${h.old_purchase_price} → ` : ''}₹{h.new_purchase_price}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Selling Price</span>
                    <span className="font-mono font-bold text-pink-600">
                      {h.old_selling_price > 0 ? `₹${h.old_selling_price} → ` : ''}₹{h.new_selling_price}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">MRP</span>
                    <span className="font-mono font-bold">
                      {h.old_mrp > 0 ? `₹${h.old_mrp} → ` : ''}₹{h.new_mrp}
                    </span>
                  </div>
                </div>

                {h.reason && (
                  <p className="text-[10px] text-slate-400 italic mt-0.5">Note: {h.reason}</p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
