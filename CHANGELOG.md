# Dolly POS - Master Changelog

All notable changes to the Dolly POS application will be documented in this file.

## [v1.5.0] - 2026-09-27
### Added & Redesigned
- **Unified Backups & 1-Click Disaster Recovery Hub**: Merged separate Cloud and Local backup lists into a single, scrollable table with real-time filters (`All Backups`, `Google Drive Cloud`, `Local Disk`), search bar, file size, timestamp, and location indicators (`Cloud + Local Disk`, `Google Drive Cloud`, `Local Disk Storage`).
- **Customizable Backup Filename Prefix**: Added a configuration card in the Startup Schedule & Local Directory box allowing owners to customize the starting file prefix (e.g. replacing `DollyToys` with any store name) while preserving all standardized suffixes, timestamps, and formats (`_Backup_Daily_...`, `_Backup_Weekly_...`, `_Backup_Monthly_...`, `.json`) with an interactive live filename preview.
- **Pixel-Perfect Action Column Alignment**: Fixed horizontal staggering by implementing a rigid 3-slot layout (`w-36` Restore button, `w-24` Download button, and `w-20` Drive link / placeholder) so all buttons across every row align with absolute consistency.
- **Direct Cloud Snapshot Download**: Added direct download support for Google Drive cloud snapshots (`GET /api/v1/google-drive/download/{file_id}`) enabling 1-click JSON snapshot download directly to PC.
- **Persistent Google OAuth Credentials with Eye Visibility Toggles**: Custom `google_client_id` and `google_client_secret` now permanently persist in the database, remain pre-filled in the setup modal, stay accessible in both connected and disconnected states, and include show/hide eye toggle buttons for enhanced security and usability.
- **Direct 1-Click "Restore from Google Drive"**: Added direct restoration from any Google Drive cloud backup snapshot in 1 click (`POST /api/v1/google-drive/restore/{file_id}`).
- **Direct 1-Click "Restore from Local Disk"**: Added direct 1-click restore from any local backup file on disk (`POST /api/v1/backup/restore-local/{filename}`) without needing to manually upload via a file picker.
- **Single Consolidated "Sync to Google Drive" Button**: Removed the duplicate header button and established one primary sync action inside the Google Drive Studio card with live sync spinner and status.
- **Window (X) & Keyboard Shortcuts Interception**: Intercepted the Windows titlebar `(X)` close button, `Ctrl + W`, `Cmd + W`, and `Ctrl + Q` in Electron (`frontend/electron/main.ts`) and browser listeners to always trigger the `AppCloseBackupModal` before app shutdown.
- **Clean Process Termination Engine**: Fixed terminal hangs in development mode by adding `-k` (`--kill-others`) to `concurrently` in `npm run electron:dev`, ensuring Vite cleanly terminates when Electron closes. Safeguarded `/api/v1/backup/shutdown` so development backend workers remain alive and responsive for subsequent dev launches.
- **Clean Studio CSS Redesign**: Completely overhauled the styling of the Backup & Restore studio with spacious, modern Tailwind cards, high-contrast badges, smooth scrollbars, and clean feedback alerts.

---

## [v1.4.0] - 2026-09-26
### Added
- **Google Account & Google Drive Cloud Backup Integration**: Direct OAuth 2.0 connection to save portable database snapshots to a dedicated `DollyPOS_Cloud_Backups` folder in Google Drive. Real-time connectivity status badge (pulsing green connected / gray disconnected).
- **Automated On-Close Backup Flow (`AppCloseBackupModal`)**: Automatically triggers snapshot generation, Google Drive upload, and retention cleanup when closing Dolly POS (via [X], Header Exit button, or `Ctrl + Q`).
- **Flexible Backup Destination Selector**: Choose between `Both (Local + Google Drive Cloud) [Recommended]`, `Google Drive Cloud Only`, or `Local Folder Only`.
- **Configurable Retention Policy (Auto-Delete Old Backups)**: Automatically purges backup files older than configured days (7, 15, 30, 60, 90, 180, 365 days, or Never Delete) from both Google Drive and local storage.
- **Human-Readable Backup Naming**: Backup files now use clean, intuitive naming (e.g. `DollyToys_Backup_Daily_2026-09-26_09-45PM.json`).
- **Interactive PostgreSQL Database Setup Engine**: Users can choose a custom Database Name, Username, Password, and Port with an interactive confirmation screen before installation.
- **1-Click PostgreSQL Service Doctor (`Heal_and_Restart_PostgreSQL.bat`)**: Automatically terminates zombie processes, cleans up stale `postmaster.pid` lock files caused by power loss, and restarts PostgreSQL in 3 seconds.
- **1-Click Database Connection Switcher (`Change_Database_Connection.bat`)**: Connect Dolly POS to any existing database (e.g. `database1`, `dollytoyskidswear`) or update credentials in 5 seconds without reinstalling.
- **Emergency Offline Billing & Sync Engine (`offline_sync_service.py`)**: If PostgreSQL stops, Dolly POS continues billing seamlessly via local SQLite. When PostgreSQL comes back online, it automatically transfers offline bills, items, payments, customer ledgers, and expenses into PostgreSQL with automated inventory stock deduction.
- **Resilient URL Encoding for Special Character Passwords**: `urllib.parse.quote_plus` ensures passwords containing symbols (`@`, `#`, `$`, `%`, `&`, `/`) connect 100% reliably.
- **Master System File & Utility Dictionary Manual**: Generated complete reference PDF manual in `docs/Dolly_POS_Master_File_and_Utility_Dictionary.pdf` and `dist_installer/`.

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
