import React from 'react';
import { formatINR } from '../../utils/formatters';

export interface BarcodeStickerProps {
  productName: string;
  size?: string;
  color?: string;
  barcode: string;
  mrp: number;
  barcodeImage: string;
  labelSize?: string;
}

export const BarcodeSticker: React.FC<BarcodeStickerProps> = ({
  productName,
  size,
  color,
  barcode,
  mrp,
  barcodeImage,
  labelSize = '50x25mm'
}) => {
  return (
    <div 
      className="barcode-sticker-item w-[190px] h-[95px] bg-white text-black p-1 flex flex-col justify-between items-center text-center shadow-xs overflow-hidden select-none font-sans font-black"
      style={{ boxSizing: 'border-box', border: 'none' }}
    >
      {/* 1. Product Title (Larger & Extra Bold) */}
      <div className="w-full text-[10.5px] font-black text-black truncate leading-tight tracking-tight px-0.5">
        {productName}
      </div>

      {/* 2. Specs & MRP Row (Larger & Extra Bold) */}
      <div className="w-full flex items-center justify-between px-0.5 text-[9.5px] font-black text-black leading-none my-0.5">
        <div className="flex items-center gap-1 truncate max-w-[105px] font-black">
          {size && <span>Sz: {size}</span>}
          {size && color && <span>•</span>}
          {color && <span>{color}</span>}
          {!size && !color && <span>Standard</span>}
        </div>
        <span className="font-black text-[10.5px] text-black shrink-0">
          MRP {formatINR(mrp)}
        </span>
      </div>

      {/* 3. 95% Wide Barcode (Reduced Bar Height, Wider Spread across sticker) */}
      <div className="w-full flex-1 flex justify-center items-center overflow-hidden min-h-[42px]">
        {barcodeImage ? (
          <img 
            src={barcodeImage} 
            alt={`Barcode ${barcode}`} 
            className="w-[96%] h-auto max-h-[44px] object-contain block mx-auto"
            style={{
              imageRendering: 'pixelated'
            }}
          />
        ) : (
          <div className="h-[36px] flex items-center text-[10.5px] text-black font-mono font-black">
            {barcode}
          </div>
        )}
      </div>
    </div>
  );
};
