import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { HeldBillSummary } from '../../types';
import { PauseCircle, Play, Trash2, X, Clock } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface HeldBillsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onResumeBill: (billData: any) => void;
}

export const HeldBillsDrawer: React.FC<HeldBillsDrawerProps> = ({
  isOpen,
  onClose,
  onResumeBill
}) => {
  const [heldBills, setHeldBills] = useState<HeldBillSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchHeldBills();
    }
  }, [isOpen]);

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

  const fetchHeldBills = async () => {
    setLoading(true);
    try {
      const res = await api.get('/billing/held-bills');
      setHeldBills(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async (id: number) => {
    try {
      const res = await api.get(`/billing/held-bills/${id}`);
      onResumeBill(res.data);
      // Delete held bill record from backend since it's now resumed
      await api.delete(`/billing/held-bills/${id}`);
      onClose();
    } catch (e) {
      console.error('Failed to resume held bill', e);
    }
  };

  const handleDiscard = async (id: number) => {
    if (!confirm('Discard this held bill?')) return;
    try {
      await api.delete(`/billing/held-bills/${id}`);
      setHeldBills(prev => prev.filter(b => b.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex justify-end z-50 select-none">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PauseCircle className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">
              Parked / Held Bills ({heldBills.length})
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading held bills...</div>
          ) : heldBills.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <PauseCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold">No parked bills</p>
              <p className="text-xs text-slate-500 mt-1">Press F5 or Hold Bill button to park active cart.</p>
            </div>
          ) : (
            heldBills.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-xs hover:border-pink-300 transition-all"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-slate-800 dark:text-white">
                      {b.customer_name || 'Walk-in Customer'}
                    </span>
                    <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                      {b.item_count} items
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center space-x-2 mt-1">
                    <span className="font-mono">{b.bill_number}</span>
                    <span>•</span>
                    <span className="font-bold text-pink-600 dark:text-pink-400 font-mono">
                      {formatINR(b.grand_total)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDiscard(b.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Discard"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleResume(b.id)}
                    className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-1 shadow-xs"
                    title="Resume Bill"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
