export interface VersionRelease {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_VERSION = 'v1.6.0';
export const RELEASE_DATE = '2026-10-06';

export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: 'v1.6.0',
    date: '2026-10-06',
    title: 'Custom CGST & SGST Tax Engine, Itemized Thermal Receipts & Returns Tax Preservation',
    highlights: [
      'Interactive CGST & SGST rate configuration in Add/Edit Product & Multi-Size generators',
      'Configurable tax rates (0%, 2%, 5%, 12%, 18%, 28%) with instant 50/50 split or manual custom split',
      'Live item-level GST rate badges (GST X% [C:Y% S:Z%]) across Inventory catalog and Billing cart',
      'Real-time calculation and financial breakdown of CGST, SGST, and Total Tax in Billing checkout',
      'Full itemized CGST & SGST breakdown printed on 80mm/58mm thermal receipts',
      'Accurate tax preservation and calculation for Return items and Exchange replacement bills',
      'Zero-hang application exit with automated background process and browser synchronization',
      'Automated installer process-terminator preventing locked file permission issues on upgrades'
    ]
  },
  {
    version: 'v1.5.0',
    date: '2026-09-27',
    title: 'Google Drive Cloud Sync, 1-Click Cloud Restore & Unified Backups Studio',
    highlights: [
      'Single consolidated "Sync to Google Drive" button inside the Google Drive Studio card',
      '1-Click Direct "Restore from Google Drive" for all cloud snapshots with instant table restore',
      'Unified Scrollable Backups Hub merging Cloud and Local snapshots with Location & Method badges',
      'Windows (X) button & Ctrl+W/Q shortcut interception triggering the On-Close Safety Backup modal',
      'Clean background process termination eliminating Vite zombie processes and dev port hangs',
      'Complete CSS and UX redesign of the Backup & Disaster Recovery Studio'
    ]
  },
  {
    version: 'v1.4.0',
    date: '2026-09-26',
    title: 'Interactive Database Configuration, Service Healer & Offline Emergency Sync Engine',
    highlights: [
      'Interactive PostgreSQL Setup Wizard with custom database name, password, port, and summary confirmation',
      '1-Click PostgreSQL Service Doctor (Heal_and_Restart_PostgreSQL.bat) fixing stale lock files & zombie processes in 3s',
      '1-Click Database Switcher (Change_Database_Connection.bat) to connect to existing databases (e.g. database1) in 5s',
      'Emergency Offline Billing & Sync Engine automatically syncing offline SQLite bills, payments, customers & stock into PostgreSQL',
      'URL encoding for complex database passwords containing special characters (@, #, $, %, &)',
      'Master System File & Utility Dictionary PDF Manual generated in docs/ and dist_installer/'
    ]
  },
  {
    version: 'v1.3.0',
    date: '2026-09-23',
    title: 'Custom Inventory Headings, Dynamic Store Branding & Schedule Persistence',
    highlights: [
      'Interactive Changelog modal accessible directly from the Statusbar',
      'Inline Click-to-Edit Inventory Catalog Title with instant local persistence',
      'Fully Dynamic Shop Name across all pages, layouts, and receipts (100% white-label)',
      'Configurable Automatic Backup Schedule (Daily, Weekly, Monthly) with permanent DB persistence',
      'Editable WhatsApp Store Phone in marketing settings with auto-sync to Store Settings'
    ]
  },
  {
    version: 'v1.2.4',
    date: '2026-09-20',
    title: 'Custom Bill Footers, UPI QR Toggle & Staff Display Fixes',
    highlights: [
      'Editable Power Footer 2 for secondary bill notes and return policies',
      'UPI QR Code visibility toggle on thermal receipts',
      'Dynamic Login page branding loaded directly from database settings',
      'Category Boom Radar filtered to only categories with actual recorded sales',
      'Cleaned up Staff Name rendering to avoid duplicate (Owner) tags'
    ]
  },
  {
    version: 'v1.2.0',
    date: '2026-09-15',
    title: 'WhatsApp Marketing & Automated Backup System',
    highlights: [
      'WhatsApp Marketing campaigns, direct quick chat, and order alerts',
      'Full Database Backup downloads and automated background scheduling',
      'Dual Screen POS support for customer-facing display',
      'Custom GST rate configuration and calculation'
    ]
  },
  {
    version: 'v1.0.0',
    date: '2026-09-01',
    title: 'Initial Production Release',
    highlights: [
      'Point of Sale (POS) Billing with barcode scanning and thermal print',
      'Real-time Inventory & Stock Tracking with low-stock alerts',
      'Customer & Vendor Khata Ledger management',
      'Comprehensive P&L and Sales Analytics'
    ]
  }
];
