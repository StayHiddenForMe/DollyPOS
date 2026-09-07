import React, { useState, useEffect } from 'react';
import { useBillingStore } from '../../store/billingStore';
import api from '../../utils/api';
import { Product } from '../../types';
import { Sparkles, X, Plus } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface SpeedDialsGridProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpeedDialsGrid: React.FC<SpeedDialsGridProps> = ({ isOpen, onClose }) => {
  const [speedDials, setSpeedDials] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const { addItem } = useBillingStore();

  useEffect(() => {
    if (isOpen) {
      fetchSpeedDials();
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

  const fetchSpeedDials = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/speed-dials');
      setSpeedDials(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                Quick Speed Dials (1-Click Add)
              </h2>
              <p className="text-xs text-slate-500">
                Frequently purchased accessories, toys, socks, and quick-pick items.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Grid */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading Speed Dials...</div>
          ) : speedDials.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm font-medium">No speed dial products configured yet.</p>
              <p className="text-xs text-slate-500 mt-1">
                You can tag any product as a speed dial in the Inventory page.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {speedDials.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => {
                    addItem(prod);
                    onClose();
                  }}
                  className="p-3.5 rounded-xl border-2 text-left transition-all active:scale-95 flex flex-col justify-between h-28 group relative overflow-hidden"
                  style={{
                    borderColor: prod.speed_dial_color ? `${prod.speed_dial_color}40` : '#e2e8f0',
                    backgroundColor: prod.speed_dial_color ? `${prod.speed_dial_color}10` : '#f8fafc'
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span 
                        className="w-3 h-3 rounded-full shadow-xs"
                        style={{ backgroundColor: prod.speed_dial_color || '#3B82F6' }}
                      />
                      {prod.speed_dial_code && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-mono font-black text-[10px] tracking-tight shadow-xs">
                          #{prod.speed_dial_code}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      Stock: {prod.stock_quantity}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-xs text-slate-800 dark:text-white line-clamp-2 leading-tight">
                      {prod.name}
                    </h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-pink-600 font-mono">
                        {formatINR(prod.selling_price)}
                      </span>
                      {prod.size && (
                        <span className="text-[9px] px-1 py-0.2 bg-slate-200 dark:bg-slate-700 rounded font-bold">
                          {prod.size}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
