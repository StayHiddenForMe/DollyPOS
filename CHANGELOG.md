# Dolly POS - Master Changelog

All notable changes to the Dolly POS application will be documented in this file.

---

## [v1.3.0] - 2026-09-23
### Added
- **Interactive Changelog in Statusbar**: Added clickable `v1.3.0` pill in the bottom statusbar that opens a modal showing version release notes and update history.
- **Inline Click-to-Edit Inventory Title**: Made the main "Kids Wear & Toy Inventory Catalog" heading directly click-to-edit without any extra buttons, with instant local persistence and restoration.
- **Dynamic Store Branding Everywhere**: Removed all residual hardcoded store names across Navbar, Sidebar, Dashboard, Reports, AI Advisor, and Receipts, making the application 100% white-label ready.
- **Configurable Auto-Backup Frequency**: Added frequency choices (Daily, Every Monday, 1st of Every Month) with dedicated save confirmation and backend database persistence.
- **Editable WhatsApp Store Number**: Enabled direct editing of the store WhatsApp mobile number in WhatsApp Marketing settings with automatic sync to Store Settings.

### Fixed
- **Auto-Backup Frequency Persistence**: Fixed an issue where the selected backup schedule frequency was resetting to 'Daily' upon page refresh.
- **Launcher Sync**: Updated `DollyPOS_Beta_Launcher.bat` and `DollyPOS_Setup_Installer.bat` to ensure the latest frontend and backend builds are cleanly deployed.

---

## [v1.2.4] - 2026-09-20
### Added
- **Editable Power Footer 2**: Added customizable secondary bill footer in Store Settings.
- **UPI QR Code Toggle on Bills**: Added a checkbox in Settings to show or hide the UPI QR code on printed thermal receipts.
- **Dynamic Login Page Branding**: Login screen now dynamically loads shop name, tagline, and address directly from database settings.
- **Filtered Category Boom Radar**: Category radar in Reports now only shows categories with actual recorded sales.
- **Owner Name Display Cleanup**: Fixed duplicate `(Owner)` suffix across Navbar, Statusbar, and Staff Management.

---

## [v1.2.0] - 2026-09-15
### Added
- **WhatsApp Marketing Module**: Customer broadcast campaigns, templates, direct chat, and order alerts.
- **Full Database Automated Backups**: Manual instant backup downloads, automated scheduled backups, and database health metrics.
- **Dual Screen POS Launcher**: Support for customer-facing display and cashier console.
- **GST Rate Configuration**: Multi-tier GST (0%, 5%, 12%, 18%, 28%) with CGST/SGST/IGST breakdown.

---

## [v1.0.0] - 2026-09-01
### Added
- **Initial Production Release**:
  - Point of Sale (POS) Billing with barcode scanning, discounts, and split payments.
  - Inventory & Stock Management with low-stock alerts.
  - Customer Ledger (Khata) & Vendor Ledger.
  - Comprehensive P&L, Sales, and Expense Reporting.
  - Thermal Receipt (80mm & 58mm) and A4 Invoice generation.
  - Multi-user Role-Based Access Control (Admin, Cashier, Manager).
  - SQLite/PostgreSQL Database engine with offline capability.
