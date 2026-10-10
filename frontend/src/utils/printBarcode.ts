export type GarmentStyleCode = string;

export const GARMENT_STYLE_OPTIONS: { code: string; label: string }[] = [
  { code: 'F/S', label: 'Full Sleeves' },
  { code: 'H/S', label: 'Half Sleeves' },
  { code: 'C/S', label: 'Cut Sleeves' },
  { code: 'R/N', label: 'Round Neck' },
  { code: 'FNY', label: 'Fancy' },
];

// Matches legacy trailing " . CODE" or " . CODE1,CODE2" if an older product had it in name
const DOT_STYLE_SUFFIX_REGEX = /\s+\.\s+([A-Za-z0-9\/\-]{1,8}(?:\s*,\s*[A-Za-z0-9\/\-]{1,8})?)\s*$/i;
const PRESET_FALLBACK_REGEX = /\s*(?:\.|-)\s*\b((?:F\/S|H\/S|C\/S|R\/N|FNY)(?:\s*,\s*(?:F\/S|H\/S|C\/S|R\/N|FNY))?)\s*$/i;

export function parseStyleCodeString(rawCodeStr?: string | null): string[] {
  if (!rawCodeStr || rawCodeStr === 'NONE') return [];
  return rawCodeStr
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 2);
}

/**
 * Toggles a short code inside the dedicated style/short-code string (supporting 1 or 2 codes, e.g. "FNY,H/S").
 * Does NOT modify the product name.
 */
export function toggleStyleCodeValue(currentCodeStr: string | undefined | null, codeToToggle: string | null): string {
  if (!codeToToggle) return '';
  const currentCodes = parseStyleCodeString(currentCodeStr);
  const cleanCode = codeToToggle.trim().toUpperCase();
  if (!cleanCode) return currentCodes.join(',');

  let nextCodes: string[];
  if (currentCodes.includes(cleanCode)) {
    nextCodes = currentCodes.filter(c => c !== cleanCode);
  } else if (currentCodes.length < 2) {
    nextCodes = [...currentCodes, cleanCode];
  } else {
    nextCodes = [currentCodes[0], cleanCode];
  }
  return nextCodes.join(',');
}

export function parseProductStyleCode(
  rawName: string,
  explicitStyleCode?: string | null
): {
  baseName: string;
  styleCodes: string[];
  styleCode: string | null;
} {
  const cleanRaw = (rawName || '').trim();
  const match = cleanRaw.match(DOT_STYLE_SUFFIX_REGEX) || cleanRaw.match(PRESET_FALLBACK_REGEX);

  let baseName = cleanRaw;
  let legacyCodes: string[] = [];

  if (match && match.index !== undefined) {
    legacyCodes = parseStyleCodeString(match[1]);
    baseName = cleanRaw.slice(0, match.index).trim();
  }

  let finalCodes = legacyCodes;
  if (explicitStyleCode === 'NONE') {
    finalCodes = [];
  } else if (explicitStyleCode && explicitStyleCode.trim()) {
    finalCodes = parseStyleCodeString(explicitStyleCode);
  }

  const finalCodeStr = finalCodes.length > 0 ? finalCodes.join(',') : null;

  return {
    baseName: baseName || cleanRaw,
    styleCodes: finalCodes,
    styleCode: finalCodeStr,
  };
}

export function formatSizeAndColor(size?: string, color?: string): string {
  const s = (size || '').trim();
  const c = (color || '').trim();
  if (s && c) return `Sz-${s}.${c}`;
  if (s) return `Sz-${s}`;
  if (c) return c;
  return '';
}

export function formatStickerRate(mrp: number): string {
  const num = Number(mrp || 0);
  return num % 1 === 0 ? `₹${num}` : `₹${num.toFixed(2)}`;
}

// ISO/IEC 15417 Code128 module width table (codes 0..106) for razor-sharp native vector SVG printing
const CODE128_WIDTHS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112'
];

export function generateCode128Bars(text: string): { rects: { x: number; w: number }[]; totalWidth: number } | null {
  const clean = (text || '').trim();
  if (!clean) return null;

  const codes: number[] = [];
  // Use Code128-C if even-length all digits >= 8 chars, otherwise Code128-B
  if (/^\d+$/.test(clean) && clean.length % 2 === 0 && clean.length >= 6) {
    codes.push(105); // Start C
    for (let i = 0; i < clean.length; i += 2) {
      codes.push(parseInt(clean.slice(i, i + 2), 10));
    }
  } else {
    codes.push(104); // Start B
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i) - 32;
      if (code < 0 || code > 94) return null;
      codes.push(code);
    }
  }

  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);
  codes.push(106); // Stop

  const quietZone = 6;
  let x = quietZone;
  const rects: { x: number; w: number }[] = [];

  for (const c of codes) {
    const pattern = CODE128_WIDTHS[c];
    if (!pattern) return null;
    for (let i = 0; i < pattern.length; i++) {
      const w = parseInt(pattern[i], 10);
      if (i % 2 === 0) {
        rects.push({ x, w });
      }
      x += w;
    }
  }
  const totalWidth = x + quietZone;
  return { rects, totalWidth };
}

export function renderCode128SvgHtml(barcodeText: string, fallbackImg?: string): string {
  const barData = generateCode128Bars(barcodeText);
  if (!barData) {
    return fallbackImg
      ? `<img class="barcode-img" src="${fallbackImg}" alt="${barcodeText}" />`
      : `<div class="barcode-number">${barcodeText}</div>`;
  }
  const rectsHtml = barData.rects
    .map(r => `<rect x="${r.x}" y="0" width="${r.w}" height="100" fill="#000000" shape-rendering="crispEdges" />`)
    .join('');

  return `
    <svg class="barcode-svg" viewBox="0 0 ${barData.totalWidth} 100" preserveAspectRatio="none" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      ${rectsHtml}
    </svg>
    <div class="barcode-number">${barcodeText}</div>
  `;
}

export interface PrintStickerItem {
  productName: string;
  styleCode?: string | 'NONE' | null;
  size?: string;
  color?: string;
  barcode: string;
  mrp: number;
  barcodeImage: string;
}

export type LabelRollType = 
  | '2UP_50x25' 
  | '1UP_50x25' 
  | '2UP_38x25' 
  | '1UP_38x25' 
  | '1UP_50x35' 
  | '1UP_75x50' 
  | 'A4_SHEET';

export type StartSlot = 'left' | 'right';

export function exportBarTenderCsv(items: PrintStickerItem[], filename = 'DollyToys_BarTender_Labels.csv') {
  if (!items || items.length === 0) return;

  const csvRows = [
    ["ProductName", "SizeColor", "ShortCode", "Barcode", "Rate"],
    ...items.map(i => {
      const parsed = parseProductStyleCode(i.productName, i.styleCode);
      return [
        `"${(parsed.baseName || '').replace(/"/g, '""')}"`,
        `"${formatSizeAndColor(i.size, i.color).replace(/"/g, '""')}"`,
        `"${(parsed.styleCode || '').replace(/"/g, '""')}"`,
        `"${i.barcode}"`,
        `"${Number(i.mrp || 0).toFixed(2)}"`
      ];
    })
  ];

  const csvContent = csvRows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printBarcodeStickers(
  items: PrintStickerItem[], 
  rollType: LabelRollType = '2UP_50x25',
  startSlot: StartSlot = 'left'
) {
  if (!items || items.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    window.print();
    return;
  }

  // Generate CSV data for 1-click BarTender export
  const csvRows = [
    ["ProductName", "SizeColor", "ShortCode", "Barcode", "Rate"],
    ...items.map(i => {
      const parsed = parseProductStyleCode(i.productName, i.styleCode);
      return [
        `"${(parsed.baseName || '').replace(/"/g, '""')}"`,
        `"${formatSizeAndColor(i.size, i.color).replace(/"/g, '""')}"`,
        `"${(parsed.styleCode || '').replace(/"/g, '""')}"`,
        `"${i.barcode}"`,
        `"${Number(i.mrp || 0).toFixed(2)}"`
      ];
    })
  ];
  const csvContent = csvRows.map(r => r.join(',')).join('\n');

  // Render individual sticker HTML
  const renderSingleSticker = (item: PrintStickerItem | null) => {
    if (!item) {
      return `<div class="sticker empty-slot"></div>`;
    }
    const parsed = parseProductStyleCode(item.productName, item.styleCode);
    const sizeColorText = formatSizeAndColor(item.size, item.color);
    const styleCodeText = parsed.styleCode || '';
    const rateText = formatStickerRate(item.mrp);

    return `
      <div class="sticker">
        <div class="product-name">${parsed.baseName}</div>
        <div class="sub-row">
          <div class="variants">${sizeColorText}</div>
          <div class="style-code">${styleCodeText}</div>
          <div class="mrp">${rateText}</div>
        </div>
        <div class="barcode-container">
          ${renderCode128SvgHtml(item.barcode, item.barcodeImage)}
        </div>
      </div>
    `;
  };

  let bodyContent = '';
  let pageStyle = '';

  if (rollType === '2UP_50x25') {
    // 2-UP Roll: Width 104mm (50mm + 4mm gap + 50mm), Height 25mm per row
    pageStyle = `
      @page {
        size: 104mm 25mm;
        margin: 0mm;
      }
      .page-row {
        width: 104mm;
        height: 25mm;
        max-height: 25mm;
        display: grid;
        grid-template-columns: 50mm 50mm;
        gap: 4mm;
        page-break-after: always;
        break-after: page;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .sticker {
        width: 50mm;
        height: 25mm;
        max-height: 25mm;
      }
    `;

    // Process items considering startSlot (if right, slot 1 is empty)
    const slotItems: (PrintStickerItem | null)[] = [];
    if (startSlot === 'right') {
      slotItems.push(null); // empty left slot
    }
    slotItems.push(...items);

    const rows = [];
    for (let i = 0; i < slotItems.length; i += 2) {
      const item1 = slotItems[i];
      const item2 = slotItems[i + 1] || null;
      rows.push(`
        <div class="page-row">
          ${renderSingleSticker(item1)}
          ${renderSingleSticker(item2)}
        </div>
      `);
    }
    bodyContent = rows.join('');
  } else if (rollType === '2UP_38x25') {
    // 2-UP 38x25 Roll: Width 80mm (38mm + 4mm gap + 38mm), Height 25mm per row
    pageStyle = `
      @page {
        size: 80mm 25mm;
        margin: 0mm;
      }
      .page-row {
        width: 80mm;
        height: 25mm;
        max-height: 25mm;
        display: grid;
        grid-template-columns: 38mm 38mm;
        gap: 4mm;
        page-break-after: always;
        break-after: page;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .sticker {
        width: 38mm;
        height: 25mm;
        max-height: 25mm;
      }
    `;

    const slotItems: (PrintStickerItem | null)[] = [];
    if (startSlot === 'right') {
      slotItems.push(null);
    }
    slotItems.push(...items);

    const rows = [];
    for (let i = 0; i < slotItems.length; i += 2) {
      const item1 = slotItems[i];
      const item2 = slotItems[i + 1] || null;
      rows.push(`
        <div class="page-row">
          ${renderSingleSticker(item1)}
          ${renderSingleSticker(item2)}
        </div>
      `);
    }
    bodyContent = rows.join('');
  } else if (rollType === '1UP_50x25') {
    pageStyle = `
      @page {
        size: 50mm 25mm;
        margin: 0mm;
      }
      .page-row {
        width: 50mm;
        height: 25mm;
        max-height: 25mm;
        page-break-after: always;
        break-after: page;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .sticker {
        width: 50mm;
        height: 25mm;
        max-height: 25mm;
      }
    `;
    bodyContent = items.map(item => `
      <div class="page-row">
        ${renderSingleSticker(item)}
      </div>
    `).join('');
  } else if (rollType === '1UP_38x25') {
    pageStyle = `
      @page {
        size: 38mm 25mm;
        margin: 0mm;
      }
      .page-row {
        width: 38mm;
        height: 25mm;
        max-height: 25mm;
        page-break-after: always;
        break-after: page;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .sticker {
        width: 38mm;
        height: 25mm;
        max-height: 25mm;
      }
    `;
    bodyContent = items.map(item => `
      <div class="page-row">
        ${renderSingleSticker(item)}
      </div>
    `).join('');
  } else if (rollType === '1UP_50x35') {
    pageStyle = `
      @page {
        size: 50mm 35mm;
        margin: 0mm;
      }
      .page-row {
        width: 50mm;
        height: 35mm;
        max-height: 35mm;
        page-break-after: always;
        break-after: page;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .sticker {
        width: 50mm;
        height: 35mm;
        max-height: 35mm;
      }
    `;
    bodyContent = items.map(item => `
      <div class="page-row">
        ${renderSingleSticker(item)}
      </div>
    `).join('');
  } else if (rollType === '1UP_75x50') {
    pageStyle = `
      @page {
        size: 75mm 50mm;
        margin: 0mm;
      }
      .page-row {
        width: 75mm;
        height: 50mm;
        max-height: 50mm;
        page-break-after: always;
        break-after: page;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .sticker {
        width: 75mm;
        height: 50mm;
        max-height: 50mm;
      }
    `;
    bodyContent = items.map(item => `
      <div class="page-row">
        ${renderSingleSticker(item)}
      </div>
    `).join('');
  } else {
    pageStyle = `
      @page {
        size: A4;
        margin: 8mm;
      }
      .stickers-grid {
        display: grid;
        grid-template-columns: repeat(4, 48mm);
        gap: 4mm;
      }
      .sticker {
        width: 48mm;
        height: 24.5mm;
        page-break-inside: avoid;
        break-inside: avoid;
      }
    `;
    bodyContent = `<div class="stickers-grid">${items.map(item => renderSingleSticker(item)).join('')}</div>`;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>TSC TE244 Thermal Barcode Print — Dolly Toys & Kids Wear</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: Arial, Helvetica, "Segoe UI", sans-serif;
          background: #f1f5f9;
          color: #000;
          margin: 0;
          padding: 0;
          font-weight: 400;
        }
        /* Top Action Bar (Screen Only) */
        .no-print {
          background: #0f172a;
          color: white;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .no-print .title {
          font-weight: 700;
          font-size: 14px;
          color: #f43f5e;
        }
        .no-print .actions {
          display: flex;
          gap: 10px;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: 0.15s;
        }
        .btn-primary {
          background: #e11d48;
          color: white;
        }
        .btn-primary:hover {
          background: #be123c;
        }
        .btn-secondary {
          background: #334155;
          color: white;
        }
        .btn-secondary:hover {
          background: #475569;
        }
        .tip-banner {
          background: #fff1f2;
          color: #9f1239;
          font-size: 11px;
          padding: 8px 20px;
          border-bottom: 1px solid #fecdd3;
          font-weight: 600;
        }

        /* Printable Area */
        .print-area {
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        ${pageStyle}

        /* CLEAN, RAZOR-SHARP 203-DPI THERMAL STICKER LAYOUT */
        .sticker {
          border: none !important;
          border-radius: 0;
          padding: 1.8mm 1.2mm 0.8mm 1.2mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          text-align: center;
          background: white;
          overflow: hidden;
          box-sizing: border-box;
          font-family: Tahoma, Verdana, Arial, sans-serif !important;
          font-weight: 500 !important;
          -webkit-font-smoothing: none !important;
          font-smooth: never !important;
          text-rendering: geometricPrecision !important;
          color: #000000 !important;
        }
        .empty-slot {
          visibility: hidden !important;
        }
        .product-name {
          font-size: 8.5pt;
          font-weight: 500 !important;
          line-height: 1.15;
          width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #000000 !important;
          text-align: center;
        }
        .sub-row {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 0 0.5mm;
          margin-top: 0.5mm;
          line-height: 1.15;
          font-size: 7.8pt;
          font-weight: 500 !important;
          color: #000000 !important;
        }
        .variants {
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500 !important;
          color: #000000 !important;
        }
        .style-code {
          text-align: center;
          padding: 0 1.5mm;
          white-space: nowrap;
          font-weight: 500 !important;
          color: #000000 !important;
        }
        .mrp {
          text-align: right;
          font-size: 8.2pt;
          font-weight: 500 !important;
          color: #000000 !important;
          white-space: nowrap;
        }
        .barcode-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
          margin-top: 1.0mm;
          flex: 1;
        }
        .barcode-svg {
          width: 94% !important;
          max-width: 47mm !important;
          height: 10.2mm !important;
          display: block !important;
          margin: 0 auto !important;
          shape-rendering: crispEdges !important;
        }
        .barcode-number {
          font-family: Tahoma, Verdana, Arial, sans-serif !important;
          font-size: 7.8pt;
          font-weight: 500 !important;
          line-height: 1.05;
          letter-spacing: 1.2px;
          color: #000000 !important;
          margin-top: 0.5mm;
          text-align: center;
          white-space: nowrap;
        }
        .barcode-img {
          width: 96% !important;
          max-width: 48mm !important;
          height: auto !important;
          max-height: 14.5mm !important;
          object-fit: contain !important;
          display: block !important;
          margin: 0 auto !important;
          image-rendering: pixelated !important;
        }

        @media print {
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: Tahoma, Verdana, Arial, sans-serif !important;
            font-weight: 500 !important;
            -webkit-font-smoothing: none !important;
            font-smooth: never !important;
            text-rendering: geometricPrecision !important;
          }
          .no-print, .tip-banner {
            display: none !important;
          }
          .print-area {
            padding: 0 !important;
            gap: 0 !important;
          }
          .empty-slot {
            visibility: hidden !important;
            display: block !important;
          }
          .sticker, .product-name, .sub-row, .variants, .style-code, .mrp, .barcode-number {
            font-family: Tahoma, Verdana, Arial, sans-serif !important;
            font-weight: 500 !important;
            -webkit-font-smoothing: none !important;
            font-smooth: never !important;
            text-rendering: geometricPrecision !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .barcode-svg, .barcode-svg rect {
            shape-rendering: crispEdges !important;
            fill: #000000 !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <div>
          <span class="title">DOLLY TOYS — TSC TE244 THERMAL PRINT STUDIO</span>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
            Total: ${items.length} Sticker(s) | Mode: ${rollType} | Start Slot: ${startSlot.toUpperCase()}
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-secondary" onclick="downloadBarTenderCSV()">
            📥 Download BarTender CSV
          </button>
          <button class="btn btn-primary" onclick="window.print()">
            🖨️ Click to Print Now
          </button>
        </div>
      </div>

      <div class="tip-banner">
        🔴 <strong>iBall LS392 Laser Scanner Tip:</strong> Hold scanner <strong>15–20 cm</strong> away and aim red laser line straight across the center of the vertical bars.
      </div>

      <div class="print-area">
        ${bodyContent}
      </div>

      <script>
        function downloadBarTenderCSV() {
          const csvData = ${JSON.stringify(csvContent)};
          const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'DollyToys_BarTender_Labels.csv';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        // Auto trigger print dialog
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 350);
        });

        // Automatically close print tab when user finishes or cancels printing
        window.addEventListener('afterprint', () => {
          setTimeout(() => {
            window.close();
          }, 100);
        });
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
