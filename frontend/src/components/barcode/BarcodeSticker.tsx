import React from 'react';
import {
  parseProductStyleCode,
  formatSizeAndColor,
  formatStickerRate,
  generateCode128Bars,
  GarmentStyleCode
} from '../../utils/printBarcode';

export interface BarcodeStickerProps {
  productName: string;
  styleCode?: GarmentStyleCode | 'NONE' | null;
  size?: string;
  color?: string;
  barcode: string;
  mrp: number;
  barcodeImage: string;
  labelSize?: string;
}

export const BarcodeSticker: React.FC<BarcodeStickerProps> = ({
  productName,
  styleCode,
  size,
  color,
  barcode,
  mrp,
  barcodeImage
}) => {
  const parsed = parseProductStyleCode(productName, styleCode);
  const sizeColorText = formatSizeAndColor(size, color);
  const styleCodeText = parsed.styleCode || '';
  const rateText = formatStickerRate(mrp);
  const barData = generateCode128Bars(barcode);

  return (
    <div 
      className="barcode-sticker-item w-[190px] h-[95px] bg-white text-black pt-[7px] px-[4.5px] pb-[3px] flex flex-col justify-between items-center text-center shadow-xs overflow-hidden select-none"
      style={{
        boxSizing: 'border-box',
        border: 'none',
        fontFamily: 'Tahoma, Verdana, Arial, sans-serif',
        fontWeight: 500
      }}
    >
      {/* 1. Product Name Only (Whole 1st Line) */}
      <div className="w-full text-[11px] font-medium text-black truncate leading-tight px-0.5">
        {parsed.baseName}
      </div>

      {/* 2. Second Line: Size.Color | Short Code (F/S, FNY,H/S) | Rate (₹100) */}
      <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center px-0.5 mt-[2px] text-[10px] font-medium text-black leading-tight">
        <div className="text-left truncate">
          {sizeColorText}
        </div>
        <div className="text-center px-1.5 whitespace-nowrap">
          {styleCodeText}
        </div>
        <div className="text-right text-[10.5px] whitespace-nowrap">
          {rateText}
        </div>
      </div>

      {/* 3. Crisp Vector SVG Barcode Bars & Barcode Number at Bottom */}
      <div className="w-full flex-1 flex flex-col justify-end items-center overflow-hidden mt-[3px]">
        {barData ? (
          <>
            <svg
              className="w-[94%] h-[38px] block mx-auto"
              viewBox={`0 0 ${barData.totalWidth} 100`}
              preserveAspectRatio="none"
              shapeRendering="crispEdges"
            >
              {barData.rects.map((r, i) => (
                <rect
                  key={i}
                  x={r.x}
                  y={0}
                  width={r.w}
                  height={100}
                  fill="#000000"
                  shapeRendering="crispEdges"
                />
              ))}
            </svg>
            <div className="text-[10px] font-medium text-black tracking-[1.2px] leading-none mt-[2px]">
              {barcode}
            </div>
          </>
        ) : barcodeImage ? (
          <img 
            src={barcodeImage} 
            alt={`Barcode ${barcode}`} 
            className="w-[96%] h-auto max-h-[50px] object-contain block mx-auto"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <div className="h-[42px] flex items-center text-[10.5px] text-black font-mono font-medium">
            {barcode}
          </div>
        )}
      </div>
    </div>
  );
};


