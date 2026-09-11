# 🛍️ Dolly POS — Complete New Laptop Setup & Disaster Recovery Guide

> **Official Deployment & Operational Guide for Dolly Toys & Kids Wear, Dhule**  
> *Author: Antigravity AI & Somesh Bang*  
> *Target Operating System: Windows 10 / Windows 11 (64-Bit)*  
> *Database: PostgreSQL 16 (64-Bit) with Local Zero-Config SQLite Auto-Fallback*

---

## 📋 Table of Contents
1. [What Files You Need on the New Laptop](#1-what-files-you-need-on-the-new-laptop)
2. [Default Credentials & Database Parameters](#2-default-credentials--database-parameters)
3. [Step-by-Step Installation Process](#3-step-by-step-installation-process)
   - [Phase 1: Database Setup via `.bat` file](#phase-1-run-setup_postgresqldatabasebat-database-engine)
   - [Phase 2: POS Application Setup via `.exe` file](#phase-2-run-dollypos_setup_v100exe-pos-application)
4. [Expected Screen Prompts & Popups](#4-expected-screen-prompts--popups)
5. [Files & Folders Created on the Laptop](#5-files--folders-created-on-the-laptop)
6. [Local SQLite vs. PostgreSQL: Schema Equivalence & Switching Guide](#6-local-sqlite-vs-postgresql-schema-equivalence--switching-guide)
7. [Troubleshooting & Scenario Handling (What If...)](#7-troubleshooting--scenario-handling)
   - [Scenario A: PostgreSQL is already installed](#scenario-a-postgresql-already-installed-on-laptop)
   - [Scenario B: "Windows protected your PC" (SmartScreen) appears](#scenario-b-windows-protected-your-pc-smartscreen-warning)
   - [Scenario C: Status bar shows "Local SQLite Live" instead of "PostgreSQL Live"](#scenario-c-status-bar-shows-local-sqlite-live-offline-mode)
   - [Scenario D: Restoring real store data from the old laptop](#scenario-d-restoring-store-data-from-old-laptop-to-new-laptop)
   - [Scenario E: Connecting Thermal Receipt Printer & Barcode Scanner](#scenario-e-thermal-receipt-printer--barcode-scanner-setup)
8. [Quick Admin Commands Cheat Sheet](#8-quick-admin-commands-cheat-sheet)

---

## 1. What Files You Need on the New Laptop

Copy the entire **`dist_installer/`** folder (via Pen Drive, Google Drive, or Local Network) onto the new laptop. It contains:

```
📁 dist_installer/
│
├── 📜 Setup_PostgreSQL_Database.bat   <-- [STEP 1] Run this first (Installs PG16 & creates database)
├── ⚙️ setup_database.ps1              <-- Core engine script (Called automatically by the .bat)
├── 🔒 DollyToys_Publisher.cer         <-- Digital Publisher Certificate for Dolly Toys & Kids Wear
├── 📦 DollyPOS_Setup_v1.0.0.exe       <-- [STEP 2] Run this second (Installs POS & Desktop Icon)
├── 📖 NEW_LAPTOP_SETUP_README.md      <-- Full guide with tables & formatting
└── 📄 newLaptopSetup_Readme.txt      <-- Plain-text guide (Open in Notepad)
```

---

## 2. Default Credentials & Database Parameters

All database configurations are pre-wired and automatically matched between the backend server and PostgreSQL:

| Setting | Value | Description |
| :--- | :--- | :--- |
| **Database Engine** | PostgreSQL 16 (64-bit) | High-performance relational database |
| **Database Name** | `dollytoyskidswear` | Primary POS production database |
| **Host / IP** | `localhost` or `127.0.0.1` | Local loopback connection |
| **Port** | `5432` | Standard PostgreSQL port |
| **Superuser** | `postgres` | Default administrative user |
| **DB Password** | `somesh123` | Pre-configured password for Dolly POS |
| **Character Set** | `UTF8` | Multi-language and currency support |
| **Owner POS Login** | Username: `admin`<br>Password: `somesh123` | Full access (Billing, Inventory, P&L, Settings) |
| **Staff POS Login** | Username: `staff`<br>Password: `staff123` | Counter billing, returns, and customers |

---

## 3. Step-by-Step Installation Process

### Phase 1: Run `Setup_PostgreSQL_Database.bat` (Database Engine)

1. **Right-click** `Setup_PostgreSQL_Database.bat` and select **"Run as administrator"** (or simply double-click it).
2. If Windows displays a **User Account Control (UAC)** prompt asking *"Do you want to allow this app to make changes to your device?"*, click **Yes**.
3. A blue/black terminal window will open and perform all 4 steps automatically:
   - **Step 1 (Detection)**: Checks if PostgreSQL 16 (or 15/17/18) is already on the laptop.
   - **Step 2 (Auto-Download & Silent Install)**: If not found, it downloads official PostgreSQL 16 from EnterpriseDB (~380 MB) and installs it silently with superuser password `somesh123` on port `5432`.
   - **Step 3 (Service Check)**: Ensures the Windows service `postgresql-x64-16` is running.
   - **Step 4 (Database Creation & Readiness Loop)**: Waits for the PostgreSQL socket to accept connections, then executes `CREATE DATABASE dollytoyskidswear WITH OWNER postgres ENCODING 'UTF8';`.
4. The terminal will show a **green success box**:
   ```
   ============================================================================
      DOLLY POS DATABASE & POSTGRESQL ENGINE ARE 100% READY!
   ============================================================================
      PostgreSQL Host : 127.0.0.1 (localhost)
      Port            : 5432
      Superuser       : postgres
      Password        : somesh123
      Database Name   : dollytoyskidswear (Live & Verified)
   ============================================================================
   ```
5. Press **Enter** to close the window.

---

### Phase 2: Run `DollyPOS_Setup_v1.0.0.exe` (POS Application)

1. **Double-click** `DollyPOS_Setup_v1.0.0.exe`.
2. A sleek dark installation wizard titled **"Dolly Toys & Kids Wear - POS & Retail System Installation Wizard"** will appear.
3. It will extract all application binaries and production frontend assets into `%LOCALAPPDATA%\DollyPOS`.
4. It automatically creates:
   - **Desktop Shortcut**: `Dolly POS` (with custom pink shopping bag icon)
   - **Start Menu Shortcut**: `Start Menu -> Programs -> Dolly POS`
5. Once the progress bar reaches 100%, click **"Launch Dolly POS Now"** (or double-click the `Dolly POS` desktop shortcut anytime).
6. The software opens in **Maximized Chrome/Edge App Mode** directly to the login screen.
7. Look at the bottom-left status bar:
   - You will see a glowing green circle with: **`PostgreSQL Live (1ms)`** or **`PostgreSQL Live (2ms)`**.
8. Log in with:
   - **Username**: `admin`
   - **Password**: `somesh123`
9. **You are ready for billing!** 🚀

---

## 4. Expected Screen Prompts & Popups

| Popup / Screen | Why It Appears | What You Should Do |
| :--- | :--- | :--- |
| **User Account Control (UAC)**: *"Do you want to allow this app to make changes?"* | Windows security check when starting the PostgreSQL Windows background service. | Click **Yes**. |
| **Windows SmartScreen**: *"Windows protected your PC - Microsoft Defender SmartScreen prevented an unrecognized app from starting"* | Appears on new downloads because Dolly POS is an in-house private retail software. | Click **"More info"** $\rightarrow$ Click **"Run anyway"**. |
| **Windows Defender Firewall**: *"Windows Defender Firewall has blocked some features of this app"* | Windows asking if PostgreSQL or Uvicorn can listen on localhost. | Check **Private networks** and click **"Allow access"**. |

---

## 5. Files & Folders Created on the Laptop

Once installed, the application and database files are organized cleanly across the following Windows system directories:

### Application Files
- **Main Program Directory**:  
  `C:\Users\<YourUsername>\AppData\Local\DollyPOS\`
- **Core Executable**:  
  `C:\Users\<YourUsername>\AppData\Local\DollyPOS\DollyPOS.exe`
- **Frontend SPA Static Assets**:  
  `C:\Users\<YourUsername>\AppData\Local\DollyPOS\_internal\frontend\dist\`
- **Desktop Shortcut**:  
  `C:\Users\<YourUsername>\Desktop\Dolly POS.lnk`
- **Start Menu Shortcut**:  
  `C:\Users\<YourUsername>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Dolly POS\Dolly POS.lnk`

### Database Files & Backups
- **PostgreSQL 16 Binaries & Cluster**:  
  `C:\Program Files\PostgreSQL\16\`
- **PostgreSQL Database Storage**:  
  `C:\Program Files\PostgreSQL\16\data\`
- **Automated Local Backups Folder**:  
  `C:\Users\<YourUsername>\DollyPOS_Backups\`
- **Fallback Local SQLite Database** *(Only used if PostgreSQL is offline)*:  
  `C:\Users\<YourUsername>\AppData\Local\DollyPOS\dollypos_local.db`

---

## 6. Local SQLite vs. PostgreSQL: Schema Equivalence & Switching Guide

### Q1: If the software connects to Local SQLite instead of PostgreSQL, will all database tables and schemas remain the same?
**YES, 100% Identical!**

* **Same Tables & Columns**: Every single table (`products`, `bills`, `bill_items`, `customers`, `store_settings`, `categories`, `subcategories`, `expenses`, `vendors`, `payments`, `return_items`, `inventory_movements`, etc.) is generated from the exact same SQLAlchemy ORM model blueprints.
* **Same Features**: All operations work identically:
  - Barcode scanning & 50x25mm label printing
  - 80mm / 58mm thermal receipt printing
  - Customer Khata (Credit Ledger)
  - Daily P&L and GST sales/purchase reports
  - AI Reorder Advisor
  - Staff and Admin authentication (`somesh123` / `staff123`)
* You will experience zero missing features or UI changes.

---

### Q2: If we are connected to Local SQLite, can we switch back to PostgreSQL?
**YES, seamlessly and automatically!**

#### 1. Automatic Priority on App Startup
Every time Dolly POS launches, it follows this strict check:
1. **Checks PostgreSQL first**: Tries connecting to `localhost:5432` with user `postgres` and password `somesh123`. If PostgreSQL is available, it connects immediately (`PostgreSQL Live`).
2. **Fallback to SQLite**: Only if PostgreSQL is stopped or missing does it switch to SQLite (`Local SQLite Live`).

> **To Switch to PostgreSQL**: Simply run `Setup_PostgreSQL_Database.bat` (or run `net start postgresql-x64-16` in CMD as Admin). The next time you open Dolly POS, it automatically switches to PostgreSQL!

#### 2. Migrating Data from Local SQLite to PostgreSQL
If you created products or generated bills while in Local SQLite mode and want to move that data into PostgreSQL:
1. Open Dolly POS (while in Local SQLite mode).
2. Go to **Settings $\rightarrow$ Backup & Restore $\rightarrow$ Click "Create Full Backup Now"**. (This saves a complete `.sql` snapshot).
3. Start PostgreSQL by running `Setup_PostgreSQL_Database.bat`.
4. Launch Dolly POS (it now connects to PostgreSQL).
5. Go to **Settings $\rightarrow$ Backup & Restore $\rightarrow$ Under "Restore Database", upload the `.sql` backup file $\rightarrow$ Click "Restore Database"**.
6. All products, sales bills, customer khata, and stock are transferred to PostgreSQL in **2 seconds**!

---

## 7. Troubleshooting & Scenario Handling

### Scenario A: PostgreSQL Already Installed on Laptop

**What happens:**
The script detects your existing PostgreSQL (version 14, 15, 16, 17, or 18 in `C:\Program Files\PostgreSQL\` or `D:\...`), skips the download, and creates the `dollytoyskidswear` database automatically.

**What if the existing postgres password is NOT `somesh123`?**
If your existing PostgreSQL superuser password is different, either:
- **Option 1 (Recommended)**: Open **pgAdmin 4** $\rightarrow$ Right-click `postgres` user $\rightarrow$ Properties $\rightarrow$ Definition $\rightarrow$ Change password to `somesh123`.
- **Option 2 (Command Line)**: Open CMD as Administrator and run:
  ```cmd
  psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'somesh123';"
  ```

---

### Scenario B: "Windows protected your PC" (SmartScreen) Warning

**Why it happens:**  
Microsoft flags any custom `.exe` or `.bat` file copied from USB or downloaded from WhatsApp/Drive unless a commercial $500/year code signing certificate is purchased.

**Fix:**
1. On the blue SmartScreen popup, click the underlined text **"More info"**.
2. Click the **"Run anyway"** button.
3. The script automatically runs `Unblock-File` on all installer components so future runs open seamlessly without warnings.

---

### Scenario C: Status Bar Shows "Local SQLite Live" (Offline Mode)

**What it means:**  
The software could not reach PostgreSQL on port 5432 (e.g., PostgreSQL service was stopped), so it safely switched to the built-in SQLite engine to prevent billing interruptions.

**How to switch back to PostgreSQL:**
1. Open PowerShell or Command Prompt as **Administrator**.
2. Run:
   ```cmd
   net start postgresql-x64-16
   ```
3. Close and re-open Dolly POS. The status bar will immediately show **`PostgreSQL Live (1ms)`**.

---

### Scenario D: Restoring Store Data from Old Laptop to New Laptop

To bring all your products, customers, billing history, and stock from your old laptop to this new laptop:

1. **On Old Laptop**:
   - Open Dolly POS $\rightarrow$ Go to **Settings** $\rightarrow$ **Backup & Restore**.
   - Click **"Create Full Backup Now"** (or grab the latest `.sql` file from `C:\Users\<User>\DollyPOS_Backups\`).
   - Copy that `.sql` file to your pen drive.
2. **On New Laptop**:
   - Open Dolly POS $\rightarrow$ Go to **Settings** $\rightarrow$ **Backup & Restore**.
   - Under **"Restore Database"**, click **"Upload Backup File (.sql)"**.
   - Select the `.sql` file from your pen drive.
   - Click **"Restore Database"**.
   - The system restores all products, bills, stock, barcode labels, and customers in **less than 2 seconds**!

---

### Scenario E: Thermal Receipt Printer & Barcode Scanner Setup

1. **Thermal Receipt Printer (TVS RP 3200, Posiflex, Epson, Xprinter, Everycom)**:
   - Connect printer USB cable to the new laptop.
   - Install the manufacturer's Windows printer driver.
   - Set paper width in Dolly POS: Go to **Settings** $\rightarrow$ **Thermal Printer Width** $\rightarrow$ Select `80mm` (standard) or `58mm` (small).
   - In Chrome/Edge print preview, select your thermal printer and set Margins to `None`.
2. **USB Barcode Scanner**:
   - Plug the USB scanner into any USB port.
   - It is **100% Plug & Play** (standard keyboard wedge mode).
   - Scan any barcode in the **POS Billing** or **Inventory** screen $\rightarrow$ It instantly adds the item to the cart!

---

## 8. Quick Admin Commands Cheat Sheet

| Task | Command (Run in PowerShell / CMD as Admin) |
| :--- | :--- |
| **Start PostgreSQL Service** | `net start postgresql-x64-16` |
| **Stop PostgreSQL Service** | `net stop postgresql-x64-16` |
| **Check PostgreSQL Status** | `Get-Service -Name postgresql*` |
| **Test Database Connection** | `psql -U postgres -h 127.0.0.1 -p 5432 -d dollytoyskidswear -c "SELECT version();"` |
| **List All Databases** | `psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "\l"` |
| **Launch Dolly POS Directly** | `Start-Process "$env:LOCALAPPDATA\DollyPOS\DollyPOS.exe"` |
| **Kill Running POS Process** | `taskkill /F /IM DollyPOS.exe` |

---

### ✅ You're All Set!
For any technical inquiries or updates, refer to the in-app Technical Handoff document in **`docs/Dolly_POS_Technical_Handoff.pdf`**.
