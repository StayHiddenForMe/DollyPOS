# Dolly POS - Dolly Toys and Kids Wear, Dhule
**High-Speed, Offline-First Desktop POS & ERP System**

* **Store Name:** Dolly Toys and Kids Wear
* **Location:** Agra Road, Near Mahatma Gandhi Statue, Dhule
* **Mobile:** 7972558842
* **UPI ID:** Configurable via Store Settings (`7972558842@upi`)

---

## System Architecture

* **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Zustand + Lucide Icons + Electron Desktop Wrapper
* **Backend:** Python 3.11+ FastAPI Service
* **Database:** PostgreSQL 18+ (`dollytoyskidswear`)
* **ORM:** SQLAlchemy 2.0 with indexed search
* **Barcode:** 1D Code128 format generator & thermal sticker printer (50x25mm)
* **UPI Payments:** Dynamic NPCI UPI QR code generator (`upi://pay?pa=...&am=...&tn=Bill_...`)
* **Thermal Printing:** ESC/POS and 80mm / 58mm / A4 receipt layouts

---

## Quick Start / Execution Steps

### 1. Start Backend & Database
Ensure PostgreSQL is running locally. Then run the Python backend:
```powershell
# From the project root
.\backend\venv\Scripts\python.exe .\backend\run_backend.py
```
Backend API will be live at `http://127.0.0.1:8000` (API Docs at `http://127.0.0.1:8000/docs`).

### 2. Start Frontend
```powershell
cd frontend
npm run dev
```
Open your browser at `http://localhost:5173`.

### 3. One-Click Launch (Both Services)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_dolly_pos.ps1
```

---

## Default Login Credentials

| Role | Username | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Owner (Admin)** | `admin` | `somesh123` | Full access (all modules, profit reports, expense deletion, settings, users) |
| **Counter Staff** | `staff` | `staff123` | High-speed billing, inventory view/edit (no delete privileges), returns |

---

## Cashier Keyboard Shortcuts

* **`F1`**: Focus Barcode Scanner / Instant Product Search
* **`F2`**: Open Quick Speed Dials Grid (1-click item tap)
* **`F3`**: Add Unlisted / Custom Item on the fly
* **`F5`**: Park / Hold Current Customer Bill
* **`F8`**: Quick Cash Checkout
* **`F9`**: Dynamic UPI QR Code Checkout
* **`Enter`**: Complete & Print Thermal Bill
* **`Esc`**: Close Modal / Cancel

---

## Database Backups

* **Manual / Automated Backup Script:**
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup_db.ps1
```
Backups are saved to `C:\Users\<User>\DollyPOS_Backups` with timestamped `.sql` format.
* **In-App Backup:** Store Owners can trigger immediate database dumps from the **Store Settings** page.
