import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ReportResponse } from '../types';

export const exportReportToExcel = async (report: ReportResponse): Promise<void> => {
  try {
    // 1. Prepare worksheet data
    const wsData: any[][] = [];

    // Header info
    wsData.push([report.store_name]);
    wsData.push([report.title]);
    wsData.push([`Period: ${report.start_date} to ${report.end_date}`]);
    wsData.push([`Exported on: ${new Date().toLocaleString('en-IN')}`]);
    wsData.push([]); // blank line

    // Summary Box
    wsData.push(['--- SUMMARY METRICS ---']);
    if (report.report_type === 'SALES') {
      wsData.push(['Total Bills', report.summary.total_bills ?? 0]);
      wsData.push(['Gross Amount (₹)', report.summary.total_gross ?? 0]);
      wsData.push(['Discounts (₹)', report.summary.total_discount ?? 0]);
      wsData.push(['Tax Amount (₹)', report.summary.total_tax ?? 0]);
      wsData.push(['Net Sales (₹)', report.summary.total_net ?? 0]);
      wsData.push(['Avg Daily Sales (₹)', report.summary.avg_daily_sales ?? 0]);
    } else if (report.report_type === 'PAYMENTS') {
      wsData.push(['Total Collected (₹)', report.summary.total_collected ?? 0]);
      wsData.push(['Total Transactions', report.summary.total_transactions ?? 0]);
    } else if (report.report_type === 'CATEGORIES') {
      wsData.push(['Total Categories', report.summary.total_categories ?? 0]);
      wsData.push(['Total Category Revenue (₹)', report.summary.total_revenue ?? 0]);
    } else if (report.report_type === 'EXPENSES') {
      wsData.push(['Total Expense Entries', report.summary.total_entries ?? 0]);
      wsData.push(['Total Expenses (₹)', report.summary.total_expense ?? 0]);
    } else if (report.report_type === 'DAMAGED') {
      wsData.push(['Damaged Products Count', report.summary.damaged_products_count ?? 0]);
      wsData.push(['Total Damaged Units', report.summary.total_damaged_units ?? 0]);
      wsData.push(['Total Cost Loss (₹)', report.summary.total_cost_loss ?? 0]);
    } else if (report.report_type === 'PLANNER') {
      wsData.push(['Critical Low Stock Items', report.summary.critical_items_count ?? 0]);
      wsData.push(['Total Suggested Order Units', report.summary.total_suggested_units ?? 0]);
    }
    wsData.push([]); // blank line

    // Table Header
    wsData.push(report.columns);

    // Table Rows
    report.rows.forEach((row) => {
      if (report.report_type === 'SALES') {
        const dateStr = row.time ? `${row.date} ${row.time}` : (row.date_display || row.date);
        wsData.push([
          dateStr,
          row.bill_number || row.bills || '—',
          row.customer || 'Walk-in Customer',
          row.payment_mode || 'CASH',
          row.gross_amount ?? 0,
          row.discount ?? 0,
          row.tax ?? 0,
          row.net_amount ?? 0,
        ]);
      } else if (report.report_type === 'PAYMENTS') {
        wsData.push([
          row.mode,
          row.bills ?? 0,
          row.amount ?? 0,
          `${row.share_pct ?? 0}%`,
        ]);
      } else if (report.report_type === 'CATEGORIES') {
        wsData.push([
          row.category,
          row.units_sold ?? 0,
          row.revenue ?? 0,
          `${row.share_pct ?? 0}%`,
        ]);
      } else if (report.report_type === 'EXPENSES') {
        wsData.push([
          row.date,
          row.category,
          row.description,
          row.payment_mode || 'CASH',
          row.amount ?? 0,
        ]);
      } else if (report.report_type === 'DAMAGED') {
        wsData.push([
          row.product_name,
          row.barcode,
          row.damaged_units ?? 0,
          row.cost_price ?? 0,
          row.selling_price ?? 0,
          row.total_cost_loss ?? 0,
        ]);
      } else if (report.report_type === 'PLANNER') {
        wsData.push([
          row.product_name,
          row.barcode,
          row.current_stock ?? 0,
          row.min_alert ?? 0,
          row.suggested_order ?? 0,
          row.est_cost ?? 0,
        ]);
      }
    });

    // 2. Build workbook
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    // 3. Write workbook as base64 string
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // 4. Save to temporary cache file
    const safeTitle = report.report_type.toLowerCase();
    const filename = `DollyPOS_${safeTitle}_${report.start_date}_to_${report.end_date}.xlsx`;
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 5. Open native mobile share dialog (WhatsApp, Drive, Files, etc.)
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Share ${report.title}`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error: any) {
    console.error('Excel Export Error:', error);
    throw new Error(error.message || 'Failed to export Excel report');
  }
};
