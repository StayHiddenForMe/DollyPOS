import React, { useRef, useState, useEffect } from 'react';
import { Product } from '../../types';
import api from '../../utils/api';
import { X, Printer, Check, Info, FileSpreadsheet } from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { useSettingStore } from '../../store/settingStore';
import { BarcodeSticker } from './BarcodeSticker';
import { printBarcodeStickers, exportBarTenderCsv, PrintStickerItem, LabelRollType, StartSlot } from '../../utils/printBarcode';

interface LabelPreviewModalProps {
  isOpen: boolean;
  product: Product | null;
  copies?: number;
  barcodeImageBase64?: string;
  onClose: () => void;
}

export const LabelPreviewModal: React.FC<LabelPreviewModalProps> = ({
  isOpen,
  product,
  copies = 1,
  barcodeImageBase64,
  onClose
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [b64, setB64] = useState<string>(barcodeImageBase64 || '');
  const [numCopies, setNumCopies] = useState<number>(copies);
  const [rollType, setRollType] = useState<LabelRollType>('2UP_50x25');
  const [startSlot, setStartSlot] = useState<StartSlot>('left');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const { settings, fetchSettings } = useSettingStore();

  useEffect(() => {
    if (!settings) {
      fetchSettings();
    }
  }, [settings]);

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

  useEffect(() => {
    if (barcodeImageBase64) {
      setB64(barcodeImageBase64);
    } else if (isOpen && product) {
      fetchBarcode();
    }
  }, [isOpen, product, barcodeImageBase64]);

  const fetchBarcode = async () => {
    if (!product) return;
    setIsGenerating(true);
    try {
      const res = await api.get(`/barcode/preview/${encodeURIComponent(product.barcode)}`);
      setB64(res.data.barcode_base64 || res.data.image_data_url);
    } catch (e) {
      console.error('Failed to fetch barcode preview', e);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen || !product) return null;

  const displayMrp = product.mrp || product.selling_price || 0;

  const getStickerItems = (): PrintStickerItem[] => {
    return Array.from({ length: numCopies }, () => ({
      productName: product.name,
      size: product.size || undefined,
      color: product.color || undefined,
      barcode: product.barcode,
      mrp: displayMrp,
      barcodeImage: b64
    }));
  };

  const handlePrint = () => {
    if (!b64) return;
    const stickerItems = getStickerItems();
    printBarcodeStickers(stickerItems, rollType, startSlot);
  };

  const handleExportCsv = () => {
    const stickerItems = getStickerItems();
    exportBarTenderCsv(stickerItems, `${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_BarTender.csv`);
  };

  const labelsArray = Array.from({ length: numCopies });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
              <span>Barcode Sticker Print Preview</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-600 font-bold">
                TSC TE244 Ready
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              High-readability 50x25 mm thermal barcode sticker layout.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printer & Roll Format Config */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 dark:text-slate-300">Sticker Format:</span>
            <select
              value={rollType}
              onChange={(e) => setRollType(e.target.value as LabelRollType)}
              className="px-2.5 py-1 bg-white dark:bg-slate-700 border rounded-lg font-bold text-xs focus:outline-none"
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

          {/* 2-UP Slot Position Selector (Left vs Right) */}
          {(rollType === '2UP_50x25' || rollType === '2UP_38x25') && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-700 dark:text-slate-300">Start Slot (Roll Position):</span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setStartSlot('left')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    startSlot === 'left' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white dark:bg-slate-700 border text-slate-600'
                  }`}
                >
                  Left Sticker (Slot 1)
                </button>
                <button
                  type="button"
                  onClick={() => setStartSlot('right')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    startSlot === 'right' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white dark:bg-slate-700 border text-slate-600'
                  }`}
                  title="Use when left sticker is already used/rolled back"
                >
                  Right Sticker (Slot 2) 🔄
                </button>
              </div>
            </div>
          )}

          {/* Copies */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
            <span className="font-bold text-slate-600 dark:text-slate-300">Number of Copies:</span>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max="1000"
                value={numCopies}
                onChange={(e) => setNumCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 font-mono font-bold text-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
              />
              <div className="flex items-center space-x-1">
                {[1, 2, 5, 10, 20, 50].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNumCopies(c)}
                    className={`px-2 py-1 rounded-lg font-mono font-bold text-xs transition-all ${
                      numCopies === c ? 'bg-pink-600 text-white shadow-xs' : 'bg-white dark:bg-slate-700 border text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950 flex flex-col items-center gap-3">
          <div className="text-[11px] text-slate-500 font-medium text-center">
            {rollType.startsWith('2UP') ? (
              <span>2-UP Roll Mode ({startSlot === 'right' ? 'Starts Right Slot' : 'Starts Left Slot'}): {Math.ceil((numCopies + (startSlot === 'right' ? 1 : 0)) / 2)} row(s) will be fed ({numCopies} sticker{numCopies > 1 ? 's' : ''})</span>
            ) : (
              <span>1-UP Roll Mode: {numCopies} sticker(s) will be printed</span>
            )}
          </div>

          <div id="printable-barcode-sheet" ref={printRef} className="flex flex-wrap gap-3 justify-center">
            {labelsArray.map((_, idx) => (
              <BarcodeSticker
                key={idx}
                productName={product.name}
                size={product.size || undefined}
                color={product.color || undefined}
                barcode={product.barcode}
                mrp={displayMrp}
                barcodeImage={b64}
                labelSize="50x25mm"
              />
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            onClick={handlePrint}
            disabled={isGenerating || !b64}
            className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-pink-600/20 active:scale-95 disabled:opacity-50 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>{isGenerating ? 'Generating...' : `Print ${numCopies} Sticker${numCopies > 1 ? 's' : ''}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
