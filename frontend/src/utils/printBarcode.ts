export interface PrintStickerItem {
  productName: string;
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
    ["ProductName", "Size", "Color", "Barcode", "MRP"],
    ...items.map(i => [
      `"${(i.productName || '').replace(/"/g, '""')}"`,
      `"${(i.size || '').replace(/"/g, '""')}"`,
      `"${(i.color || '').replace(/"/g, '""')}"`,
      `"${i.barcode}"`,
      `"${Number(i.mrp || 0).toFixed(2)}"`
    ])
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
    ["ProductName", "Size", "Color", "Barcode", "MRP"],
    ...items.map(i => [
      `"${(i.productName || '').replace(/"/g, '""')}"`,
      `"${(i.size || '').replace(/"/g, '""')}"`,
      `"${(i.color || '').replace(/"/g, '""')}"`,
      `"${i.barcode}"`,
      `"${Number(i.mrp || 0).toFixed(2)}"`
    ])
  ];
  const csvContent = csvRows.map(r => r.join(',')).join('\n');

  // Render individual sticker HTML
  const renderSingleSticker = (item: PrintStickerItem | null) => {
    if (!item) {
      return `<div class="sticker empty-slot"></div>`;
    }
    return `
      <div class="sticker">
        <div class="product-name">${item.productName}</div>
        <div class="sub-row">
          <div class="variants">
            ${item.size ? `<span>Sz: ${item.size}</span>` : ''}
            ${item.size && item.color ? '<span>•</span>' : ''}
            ${item.color ? `<span>${item.color}</span>` : ''}
            ${!item.size && !item.color ? '<span>Standard</span>' : ''}
          </div>
          <div class="mrp">MRP ₹${Number(item.mrp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="barcode-container">
          <img class="barcode-img" src="${item.barcodeImage}" alt="${item.barcode}" />
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
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial Black", Arial, sans-serif;
          background: #f1f5f9;
          color: #000;
          margin: 0;
          padding: 0;
          font-weight: 900;
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
          font-weight: 900;
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
          font-weight: 900;
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
          font-weight: 800;
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

        /* BORDER-FREE EXTRA-BOLD STICKER LAYOUT (95% WIDE BARCODE) */
        .sticker {
          border: none !important;
          border-radius: 0;
          padding: 0.5mm 0.8mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          text-align: center;
          background: white;
          overflow: hidden;
          box-sizing: border-box;
          font-weight: 900 !important;
        }
        .empty-slot {
          visibility: hidden !important;
        }
        .product-name {
          font-size: 8.2pt;
          font-weight: 900 !important;
          line-height: 1.1;
          width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #000;
          text-align: center;
          letter-spacing: -0.2px;
        }
        .sub-row {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0.5mm;
          margin-top: 0.3mm;
          line-height: 1.0;
          font-weight: 900 !important;
        }
        .variants {
          font-size: 7.2pt;
          font-weight: 900 !important;
          color: #000;
          display: flex;
          align-items: center;
          gap: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 27mm;
        }
        .mrp {
          font-size: 8.5pt;
          font-weight: 900 !important;
          color: #000;
          white-space: nowrap;
        }
        .barcode-container {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 0.4mm;
          flex: 1;
        }
        .barcode-img {
          width: 96% !important;
          max-width: 48mm !important;
          height: auto !important;
          max-height: 13.5mm !important;
          object-fit: contain !important;
          display: block !important;
          margin: 0 auto !important;
          image-rendering: -webkit-optimize-contrast !important;
          image-rendering: crisp-edges !important;
          image-rendering: pixelated !important;
        }

        @media print {
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            font-weight: 900 !important;
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
          .sticker, .product-name, .sub-row, .variants, .mrp {
            font-weight: 900 !important;
            color: #000 !important;
            border: none !important;
            box-shadow: none !important;
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
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
