import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Product } from '../types';
import { Barcode as BarcodeIcon, Printer, Plus, Trash2, Tag, Search, RotateCcw, FileSpreadsheet, Sparkles } from 'lucide-react';
import { formatINR } from '../utils/formatters';
import { BarcodeSticker } from '../components/barcode/BarcodeSticker';
import { printBarcodeStickers, exportBarTenderCsv, PrintStickerItem, LabelRollType, StartSlot } from '../utils/printBarcode';
import { useSettingStore } from '../store/settingStore';
import { useBarcodeStore } from '../store/barcodeStore';

export const BarcodePage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [rollType, setRollType] = useState<LabelRollType>('2UP_50x25');
  const [startSlot, setStartSlot] = useState<StartSlot>('left');
  const [generatedLabels, setGeneratedLabels] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { queue, addToQueue, updateCopies, removeFromQueue, clearQueue } = useBarcodeStore();
  const { settings, fetchSettings } = useSettingStore();

  useEffect(() => {
    if (!settings) {
      fetchSettings();
    }
  }, [settings]);

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const fetchProducts = async () => {
    try {
      const res = await api.get(`/inventory/search?q=${encodeURIComponent(search)}&limit=30`);
      setProducts(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateBatch = async () => {
    if (queue.length === 0) return;
    setIsGenerating(true);
    try {
      const payload = {
        label_size_mm: rollType.includes('38x25') ? '38x25mm' : rollType.includes('50x35') ? '50x35mm' : '50x25mm',
        items: queue.map(q => ({ product_id: q.product.id, copies: q.copies }))
      };
      const res = await api.post('/barcode/batch-labels', payload);
      setGeneratedLabels(res.data.labels);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (generatedLabels.length === 0) return;
    const stickerItems: PrintStickerItem[] = generatedLabels.map(lbl => ({
      productName: lbl.product_name,
      size: lbl.size || undefined,
      color: lbl.color || undefined,
      barcode: lbl.barcode,
      mrp: lbl.mrp || lbl.selling_price,
      barcodeImage: lbl.barcode_image
    }));

    printBarcodeStickers(stickerItems, rollType, startSlot);
  };

  const handleExportDirectCsv = () => {
    if (queue.length === 0) return;
    const stickerItems: PrintStickerItem[] = [];
    queue.forEach(q => {
      const displayMrp = q.product.mrp || q.product.selling_price || 0;
      for (let i = 0; i < q.copies; i++) {
        stickerItems.push({
          productName: q.product.name,
          size: q.product.size || undefined,
          color: q.product.color || undefined,
          barcode: q.product.barcode,
          mrp: displayMrp,
          barcodeImage: ''
        });
      }
    });

    exportBarTenderCsv(stickerItems, 'DollyToys_BarTender_Batch.csv');
  };

  const handleClearQueue = () => {
    clearQueue();
    setGeneratedLabels([]);
  };

  const handleRemoveFromQueue = (prodId: number) => {
    removeFromQueue(prodId);
    setGeneratedLabels([]);
  };

  const totalCopies = queue.reduce((a, b) => a + b.copies, 0);

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BarcodeIcon className="w-5 h-5 text-pink-500" />
            1D Code128 Barcode Sticker Studio
          </h1>
          <p className="text-xs text-slate-500">
            Batch print 50x25 mm stickers on TSC TE244 thermal printer or export directly to BarTender.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {queue.length > 0 && (
            <>
              <button
                onClick={handleExportDirectCsv}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center space-x-1.5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all shadow-xs"
                title="Download spreadsheet to open directly in BarTender desktop application"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export BarTender CSV ({totalCopies})</span>
              </button>

              <button
                onClick={handleClearQueue}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center space-x-1.5 hover:text-rose-600"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Queue</span>
              </button>
            </>
          )}

          {generatedLabels.length > 0 && (
            <button
              onClick={handlePrint}
              className="px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-pink-600/30 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print {generatedLabels.length} Sticker(s)</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* Left Col: Product Selector (Newest Inventory Products on Top) */}
        <div className="col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col p-4 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-500" />
              <span>Inventory Products (Latest on top)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{products.length} items</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Barcode, Name, SKU, Size, Category..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-pink-500 font-medium"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {products.map(p => (
              <div key={p.id} className="py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 rounded-xl transition-colors">
                <div className="flex flex-col pr-2">
                  <span className="font-black text-xs text-slate-900 dark:text-white line-clamp-1">
                    {p.name}
                  </span>
                  <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-2 mt-0.5">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{p.barcode}</span>
                    {p.size && <span className="text-blue-600 font-black">Sz: {p.size}</span>}
                    {p.color && <span>{p.color}</span>}
                    <span className="font-black text-pink-600">MRP ₹{p.mrp || p.selling_price}</span>
                  </div>
                </div>

                <button
                  onClick={() => addToQueue(p, 1)}
                  className="p-1.5 rounded-lg bg-pink-50 text-pink-600 hover:bg-pink-600 hover:text-white transition-colors shrink-0 shadow-xs"
                  title="Add to Print Queue"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Print Queue & Live Preview */}
        <div className="col-span-7 flex flex-col space-y-3 min-h-0">
          {/* Queue Config Bar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">Format:</span>
              <select
                value={rollType}
                onChange={(e) => setRollType(e.target.value as LabelRollType)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
              >
                <option value="2UP_50x25">🏷️ 50×25 mm 2-UP (Dual Column - 104×25mm Roll)</option>
                <option value="1UP_50x25">🏷️ 50×25 mm 1-UP (Single Column - 50×25mm Roll)</option>
                <option value="2UP_38x25">🏷️ 38×25 mm 2-UP (Dual Column - 80×25mm Roll)</option>
                <option value="1UP_38x25">🏷️ 38×25 mm 1-UP (Single Column - 38×25mm Roll)</option>
                <option value="1UP_50x35">🏷️ 50×35 mm 1-UP (Single Column - 50×35mm Roll)</option>
                <option value="1UP_75x50">🏷️ 75×50 mm 1-UP (Large Tag - 75×50mm Roll)</option>
                <option value="A4_SHEET">📄 A4 Sticker Sheet (Grid Layout)</option>
              </select>
            </div>

            {/* 2-UP Slot Position Selector */}
            {(rollType === '2UP_50x25' || rollType === '2UP_38x25') && (
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-500 text-[11px]">Start:</span>
                <button
                  type="button"
                  onClick={() => setStartSlot('left')}
                  className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-all ${
                    startSlot === 'left' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 border'
                  }`}
                >
                  Left
                </button>
                <button
                  type="button"
                  onClick={() => setStartSlot('right')}
                  className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-all ${
                    startSlot === 'right' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 border'
                  }`}
                  title="Use when left sticker on current row is already used"
                >
                  Right 🔄
                </button>
              </div>
            )}

            <button
              onClick={handleGenerateBatch}
              disabled={queue.length === 0 || isGenerating}
              className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-md hover:bg-slate-800 disabled:opacity-40 transition-all active:scale-95"
            >
              {isGenerating ? 'Generating...' : `Generate ${totalCopies} Stickers`}
            </button>
          </div>

          {/* Queue List / Generated Preview Container */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 overflow-y-auto flex flex-col">
            {generatedLabels.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium border-b pb-1">
                  <span>Generated {generatedLabels.length} Sticker(s)</span>
                  <span className="text-pink-600 font-bold">
                    {rollType.startsWith('2UP') ? `${Math.ceil((generatedLabels.length + (startSlot === 'right' ? 1 : 0)) / 2)} rows on 2-UP roll` : `${generatedLabels.length} rows on 1-UP roll`}
                  </span>
                </div>

                <div id="printable-barcode-sheet" className="flex flex-wrap gap-3 justify-center">
                  {generatedLabels.map((lbl, idx) => (
                    <BarcodeSticker
                      key={idx}
                      productName={lbl.product_name}
                      size={lbl.size || undefined}
                      color={lbl.color || undefined}
                      barcode={lbl.barcode}
                      mrp={lbl.mrp || lbl.selling_price}
                      barcodeImage={lbl.barcode_image}
                      labelSize="50x25mm"
                    />
                  ))}
                </div>
              </div>
            ) : queue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Tag className="w-8 h-8 opacity-40" />
                <p className="text-xs font-semibold">Print queue is empty</p>
                <p className="text-[11px]">Select items on the left to add copies to the print queue (queue is saved automatically).</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b text-[11px] text-slate-500 font-medium">
                  <span>Queue: {queue.length} product(s) ({totalCopies} total labels)</span>
                  <span className="text-emerald-600 font-bold">Saved in Local Storage</span>
                </div>

                {queue.map(q => (
                  <div key={q.product.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{q.product.name}</span>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                        <span className="font-bold">{q.product.barcode}</span>
                        {q.product.size && <span>Sz: {q.product.size}</span>}
                        <span className="text-pink-600 font-bold">MRP ₹{q.product.mrp || q.product.selling_price}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <span className="text-slate-400 text-[11px]">Copies:</span>
                        <input
                          type="number"
                          value={q.copies}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            updateCopies(q.product.id, val);
                            setGeneratedLabels([]);
                          }}
                          className="w-14 px-2 py-1 font-bold font-mono text-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg"
                          min="1"
                        />
                      </div>

                      <button
                        onClick={() => handleRemoveFromQueue(q.product.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
