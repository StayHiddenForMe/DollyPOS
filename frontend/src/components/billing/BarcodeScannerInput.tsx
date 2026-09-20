import React, { useState, useEffect, useRef } from 'react';
import { useBillingStore } from '../../store/billingStore';
import api from '../../utils/api';
import { Product } from '../../types';
import { Scan, Plus, Sparkles } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface BarcodeScannerInputProps {
  onOpenUnlistedModal: () => void;
  onOpenSpeedDials: () => void;
}

export const BarcodeScannerInput: React.FC<BarcodeScannerInputProps> = ({
  onOpenUnlistedModal,
  onOpenSpeedDials
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { addItem } = useBillingStore();

  useEffect(() => {
    inputRef.current?.focus();
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Auto-scroll the dropdown list to keep the highlighted item visible when using arrow keys
  useEffect(() => {
    if (searchResults.length > 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex, searchResults]);

  // Debounced search with Exact-Match Priority Sorting (ultra-fast 60ms debounce)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSelectedIndex(0);
      itemRefs.current = [];
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/inventory/search?q=${encodeURIComponent(trimmed)}&limit=15`);
        const items: Product[] = res.data;

        // Custom Strict Sort: Exact Speed Dial or Exact Barcode strictly placed at index 0
        items.sort((a, b) => {
          const aExactSpeed = (a.speed_dial_code || '').toUpperCase() === trimmed.toUpperCase();
          const bExactSpeed = (b.speed_dial_code || '').toUpperCase() === trimmed.toUpperCase();
          const aExactBarcode = a.barcode === trimmed;
          const bExactBarcode = b.barcode === trimmed;

          if (aExactSpeed || aExactBarcode) return -1;
          if (bExactSpeed || bExactBarcode) return 1;
          return 0;
        });

        setSearchResults(items);
        setSelectedIndex(0);
        itemRefs.current = [];
      } catch (e) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      // 1. If dropdown search results exist, STRICTLY pick the currently highlighted item (searchResults[selectedIndex])
      if (searchResults.length > 0 && selectedIndex >= 0 && selectedIndex < searchResults.length) {
        const selected = searchResults[selectedIndex];
        addItem(selected);
        setQuery('');
        setSearchResults([]);
        return;
      }

      // 2. Direct exact lookup via backend endpoint (fast scan before debounce returns)
      try {
        const res = await api.get(`/inventory/barcode/${encodeURIComponent(trimmed)}`);
        if (res.data) {
          addItem(res.data);
          setQuery('');
          setSearchResults([]);
          return;
        }
      } catch (err) {
        // Not found by exact barcode/speed dial
      }

      // 3. Not found - open unlisted prompt
      onOpenUnlistedModal();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
      }
    } else if (e.key === 'Escape') {
      setSearchResults([]);
      setQuery('');
    }
  };

  const handleSelectProduct = (prod: Product) => {
    addItem(prod);
    setQuery('');
    setSearchResults([]);
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center space-x-2">
        {/* Main Barcode & Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-pink-500">
            <Scan className="w-5 h-5 animate-pulse" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scan barcode or type shortcode (e.g. 1, M10) / SKU / Name (F1)..."
            className="w-full pl-11 pr-24 py-3 bg-white dark:bg-slate-800 border-2 border-pink-400 focus:border-pink-600 dark:border-pink-500 rounded-xl text-base font-medium shadow-sm focus:outline-none focus:ring-4 focus:ring-pink-500/20 text-slate-900 dark:text-white placeholder-slate-400 transition-all font-mono"
            autoComplete="off"
            spellCheck="false"
          />

          <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-1.5">
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
              SCANNER READY
            </span>
          </div>
        </div>

        {/* Speed Dials & Unlisted Quick Action Buttons */}
        <button
          onClick={onOpenSpeedDials}
          className="px-3.5 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition-all whitespace-nowrap active:scale-95"
          title="Speed Dials (F2)"
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Speed Dials (F2)</span>
        </button>

        <button
          onClick={onOpenUnlistedModal}
          className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition-all whitespace-nowrap active:scale-95"
          title="Add Custom Item (F3)"
        >
          <Plus className="w-4 h-4 text-pink-400" />
          <span>Custom (F3)</span>
        </button>
      </div>

      {/* Live Dropdown Search Results */}
      {searchResults.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {searchResults.map((prod, idx) => {
            const isExactSpeedDial = prod.speed_dial_code && prod.speed_dial_code.toUpperCase() === query.trim().toUpperCase();
            return (
              <div
                key={prod.id}
                ref={(el) => { itemRefs.current[idx] = el; }}
                onClick={() => handleSelectProduct(prod)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                  idx === selectedIndex 
                    ? 'bg-pink-50 dark:bg-pink-950/60 border-l-4 border-pink-500' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    {isExactSpeedDial && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-black font-mono">
                        ⚡ EXACT CODE: {prod.speed_dial_code}
                      </span>
                    )}
                    <span className="font-semibold text-sm text-slate-800 dark:text-white">
                      {prod.name}
                    </span>
                    {prod.size && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-bold font-mono">
                        Size: {prod.size}
                      </span>
                    )}
                    {prod.color && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] font-bold">
                        {prod.color}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center space-x-3 mt-0.5 font-mono">
                    <span>Barcode: {prod.barcode}</span>
                    {prod.speed_dial_code && <span>Shortcode: ⚡{prod.speed_dial_code}</span>}
                    <span>Stock: {prod.stock_quantity} pcs</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-base text-pink-600 dark:text-pink-400 font-mono">
                    {formatINR(prod.selling_price)}
                  </div>
                  {prod.mrp > prod.selling_price && (
                    <div className="text-xs text-slate-400 line-through font-mono">
                      MRP {formatINR(prod.mrp)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
