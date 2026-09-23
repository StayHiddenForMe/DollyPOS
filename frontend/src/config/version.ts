export interface VersionRelease {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_VERSION = 'v1.3.0';
export const RELEASE_DATE = '2026-09-23';

export const VERSION_HISTORY: VersionRelease[] = [
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
