import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ReportResponse } from '../types';
import { formatINR } from '../utils/formatters';

export const exportReportToPDF = async (report: ReportResponse): Promise<void> => {
  try {
    let summaryHtml = '';
    if (report.report_type === 'SALES') {
      summaryHtml = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Bills</div>
            <div class="kpi-val">${report.summary.total_bills ?? 0}</div>
          </div>
          <div class="kpi-card highlight">
            <div class="kpi-label">Net Sales</div>
            <div class="kpi-val">${formatINR(report.summary.total_net ?? 0)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Gross Sales</div>
            <div class="kpi-val">${formatINR(report.summary.total_gross ?? 0)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Discounts</div>
            <div class="kpi-val">${formatINR(report.summary.total_discount ?? 0)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Tax Collected</div>
            <div class="kpi-val">${formatINR(report.summary.total_tax ?? 0)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Avg Daily Sales</div>
            <div class="kpi-val">${formatINR(report.summary.avg_daily_sales ?? 0)}</div>
          </div>
        </div>
      `;
    } else if (report.report_type === 'PAYMENTS') {
      summaryHtml = `
        <div class="kpi-grid">
          <div class="kpi-card highlight">
            <div class="kpi-label">Total Collected</div>
            <div class="kpi-val">${formatINR(report.summary.total_collected ?? 0)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Transactions</div>
            <div class="kpi-val">${report.summary.total_transactions ?? 0}</div>
          </div>
        </div>
      `;
    } else if (report.report_type === 'CATEGORIES') {
      summaryHtml = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Categories</div>
            <div class="kpi-val">${report.summary.total_categories ?? 0}</div>
          </div>
          <div class="kpi-card highlight">
            <div class="kpi-label">Total Revenue</div>
            <div class="kpi-val">${formatINR(report.summary.total_revenue ?? 0)}</div>
          </div>
        </div>
      `;
    } else if (report.report_type === 'EXPENSES') {
      summaryHtml = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Entries</div>
            <div class="kpi-val">${report.summary.total_entries ?? 0}</div>
          </div>
          <div class="kpi-card highlight-danger">
            <div class="kpi-label">Total Expenses</div>
            <div class="kpi-val">${formatINR(report.summary.total_expense ?? 0)}</div>
          </div>
        </div>
      `;
    } else if (report.report_type === 'DAMAGED') {
      summaryHtml = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Damaged Items</div>
            <div class="kpi-val">${report.summary.damaged_products_count ?? 0}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Units</div>
            <div class="kpi-val">${report.summary.total_damaged_units ?? 0}</div>
          </div>
          <div class="kpi-card highlight-danger">
            <div class="kpi-label">Total Cost Loss</div>
            <div class="kpi-val">${formatINR(report.summary.total_cost_loss ?? 0)}</div>
          </div>
        </div>
      `;
    } else if (report.report_type === 'PLANNER') {
      summaryHtml = `
        <div class="kpi-grid">
          <div class="kpi-card highlight-danger">
            <div class="kpi-label">Critical Low Stock Items</div>
            <div class="kpi-val">${report.summary.critical_items_count ?? 0}</div>
          </div>
          <div class="kpi-card highlight">
            <div class="kpi-label">Suggested Units to Order</div>
            <div class="kpi-val">${report.summary.total_suggested_units ?? 0}</div>
          </div>
        </div>
      `;
    }

    // Build Table Header
    const headerCols = report.columns.map((c) => `<th>${c}</th>`).join('');

    // Build Table Rows
    let rowsHtml = '';
    report.rows.forEach((r) => {
      if (report.report_type === 'SALES') {
        const timeHtml = r.time ? `<div style="font-size:10px; color:#64748b;">${r.time}</div>` : '';
        rowsHtml += `
          <tr>
            <td><strong>${r.date_display || r.date}</strong>${timeHtml}</td>
            <td><strong>${r.bill_number || r.bills || '—'}</strong></td>
            <td>${r.customer || 'Walk-in Customer'}</td>
            <td><span class="badge-cat">${r.payment_mode || 'CASH'}</span></td>
            <td style="text-align:right;">${formatINR(r.gross_amount)}</td>
            <td style="text-align:right; color:#ef4444;">-${formatINR(r.discount)}</td>
            <td style="text-align:right;">${formatINR(r.tax)}</td>
            <td style="text-align:right; font-weight:700; color:#0f172a;">${formatINR(r.net_amount)}</td>
          </tr>
        `;
      } else if (report.report_type === 'PAYMENTS') {
        rowsHtml += `
          <tr>
            <td><strong>${r.mode}</strong></td>
            <td style="text-align:center;">${r.bills}</td>
            <td style="text-align:right; font-weight:700;">${formatINR(r.amount)}</td>
            <td style="text-align:right;"><span class="badge">${r.share_pct}%</span></td>
          </tr>
        `;
      } else if (report.report_type === 'CATEGORIES') {
        rowsHtml += `
          <tr>
            <td><strong>${r.category}</strong></td>
            <td style="text-align:center;">${r.units_sold}</td>
            <td style="text-align:right; font-weight:700;">${formatINR(r.revenue)}</td>
            <td style="text-align:right;"><span class="badge">${r.share_pct}%</span></td>
          </tr>
        `;
      } else if (report.report_type === 'EXPENSES') {
        rowsHtml += `
          <tr>
            <td><strong>${r.date}</strong></td>
            <td><span class="badge-cat">${r.category}</span></td>
            <td>${r.description}</td>
            <td><span class="badge">${r.payment_mode || 'CASH'}</span></td>
            <td style="text-align:right; font-weight:700; color:#ef4444;">${formatINR(r.amount)}</td>
          </tr>
        `;
      } else if (report.report_type === 'DAMAGED') {
        rowsHtml += `
          <tr>
            <td><strong>${r.product_name}</strong></td>
            <td><code>${r.barcode}</code></td>
            <td style="text-align:center; color:#ef4444; font-weight:700;">${r.damaged_units}</td>
            <td style="text-align:right;">${formatINR(r.cost_price)}</td>
            <td style="text-align:right;">${formatINR(r.selling_price)}</td>
            <td style="text-align:right; font-weight:700; color:#ef4444;">${formatINR(r.total_cost_loss)}</td>
          </tr>
        `;
      } else if (report.report_type === 'PLANNER') {
        rowsHtml += `
          <tr>
            <td><strong>${r.product_name}</strong></td>
            <td><code>${r.barcode}</code></td>
            <td style="text-align:center; color:#ef4444; font-weight:700;">${r.current_stock}</td>
            <td style="text-align:center;">${r.min_alert}</td>
            <td style="text-align:center; font-weight:700; color:#2563eb;">${r.suggested_order}</td>
            <td style="text-align:right; font-weight:700;">${formatINR(r.est_cost)}</td>
          </tr>
        `;
      }
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 32px;
            background: #ffffff;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #ec4899;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .store-name {
            font-size: 24px;
            font-weight: 800;
            color: #db2777;
            margin: 0;
          }
          .report-title {
            font-size: 16px;
            font-weight: 600;
            color: #334155;
            margin-top: 4px;
          }
          .meta {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 24px;
          }
          .kpi-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
          }
          .kpi-card.highlight {
            background: #fdf2f8;
            border-color: #fbcfe8;
          }
          .kpi-card.highlight .kpi-val {
            color: #db2777;
          }
          .kpi-card.highlight-danger {
            background: #fef2f2;
            border-color: #fecaca;
          }
          .kpi-card.highlight-danger .kpi-val {
            color: #ef4444;
          }
          .kpi-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
          }
          .kpi-val {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 12px;
          }
          th {
            background: #f1f5f9;
            color: #475569;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 10px;
            padding: 10px 12px;
            border-bottom: 2px solid #cbd5e1;
            text-align: left;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #f1f5f9;
          }
          tr:nth-child(even) td {
            background: #fafafa;
          }
          code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 11px;
          }
          .badge {
            background: #ecfdf5;
            color: #059669;
            padding: 3px 8px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 11px;
          }
          .badge-cat {
            background: #eff6ff;
            color: #2563eb;
            padding: 3px 8px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 11px;
          }
          .footer {
            margin-top: 32px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            color: #94a3b8;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="store-name">${report.store_name}</div>
            <div class="report-title">${report.title}</div>
          </div>
          <div class="meta">
            <div><strong>Date Range:</strong> ${report.start_date} to ${report.end_date}</div>
            <div><strong>Generated:</strong> ${new Date().toLocaleString('en-IN')}</div>
          </div>
        </div>

        ${summaryHtml}

        <table>
          <thead>
            <tr>${headerCols}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>Dolly POS Mobile Companion Report • Confidential</div>
          <div>Page 1 of 1</div>
        </div>
      </body>
      </html>
    `;

    const { base64 } = await Print.printToFileAsync({
      html,
      base64: true,
    });

    if (!base64) {
      throw new Error('Could not generate PDF data');
    }

    const safeTitle = (report.report_type || 'report').toLowerCase();
    const pdfFilename = `DollyPOS_${safeTitle}_${report.start_date}_to_${report.end_date}.pdf`;
    const targetPdfUri = `${FileSystem.cacheDirectory}${pdfFilename}`;

    await FileSystem.writeAsStringAsync(targetPdfUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(targetPdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: report.title,
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error: any) {
    console.error('PDF Export Error:', error);
    throw new Error(error.message || 'Failed to export PDF report');
  }
};
