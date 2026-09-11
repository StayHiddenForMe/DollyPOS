import os
import sys
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

DOCS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs"))
os.makedirs(DOCS_DIR, exist_ok=True)

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and render 'Page X of Y' on every page."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 11 * inch - 36, "Dolly POS • Dolly Toys & Kids Wear, Dhule")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)
        
        # Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 8.5 * inch - 54, 48)
        
        self.drawString(54, 34, "CONFIDENTIAL & PROPRIETARY — Store Operations & Architecture Manual")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 34, page_str)
        self.restoreState()

def get_custom_styles():
    styles = getSampleStyleSheet()
    
    primary_color = colors.HexColor("#DB2777")   # Dolly Pink
    secondary_color = colors.HexColor("#4F46E5") # Indigo
    dark_slate = colors.HexColor("#0F172A")      # Slate 900
    body_color = colors.HexColor("#334155")      # Slate 700

    styles.add(ParagraphStyle(
        name="DocTitle",
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        name="DocSubtitle",
        fontName="Helvetica",
        fontSize=12,
        leading=16,
        textColor=secondary_color,
        spaceAfter=15
    ))
    styles.add(ParagraphStyle(
        name="DocH1",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=dark_slate,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name="DocH2",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=primary_color,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name="DocH3",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=dark_slate,
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name="DocBody",
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=body_color,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        name="DocBullet",
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=body_color,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    ))
    styles.add(ParagraphStyle(
        name="DocCode",
        fontName="Courier",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0F172A"),
        backColor=colors.HexColor("#F1F5F9"),
        borderPadding=4,
        spaceBefore=4,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        name="AlertNote",
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#065F46"),
        backColor=colors.HexColor("#ECFDF5"),
        borderColor=colors.HexColor("#A7F3D0"),
        borderWidth=1,
        borderPadding=6,
        spaceBefore=6,
        spaceAfter=8
    ))
    styles.add(ParagraphStyle(
        name="AlertWarn",
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#92400E"),
        backColor=colors.HexColor("#FEF3C7"),
        borderColor=colors.HexColor("#FDE68A"),
        borderWidth=1,
        borderPadding=6,
        spaceBefore=6,
        spaceAfter=8
    ))
    styles.add(ParagraphStyle(
        name="TableHeader",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
        alignment=0
    ))
    styles.add(ParagraphStyle(
        name="TableCell",
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=dark_slate
    ))
    styles.add(ParagraphStyle(
        name="TableCellBold",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=dark_slate
    ))
    return styles

# =========================================================================
# 1. USER MANUAL GENERATION
# =========================================================================
def generate_user_manual():
    pdf_path = os.path.join(DOCS_DIR, "Dolly_POS_User_Manual.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54, rightMargin=54,
        topMargin=54, bottomMargin=54
    )
    styles = get_custom_styles()
    story = []

    # Title & Metadata Banner
    story.append(Paragraph("Dolly POS — Store User Manual", styles["DocTitle"]))
    story.append(Paragraph("Standard Operating Procedures (SOP) for Dolly Toys & Kids Wear • Non-Technical Step-by-Step Guide", styles["DocSubtitle"]))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#DB2777"), spaceBefore=0, spaceAfter=12))

    story.append(Paragraph(
        "<b>Welcome to Dolly POS!</b> This manual is written for counter cashiers, store staff, and store owners. "
        "It provides crystal-clear instructions on how to use every screen and feature in the software without requiring technical knowledge.",
        styles["DocBody"]
    ))

    # Section 1: Logging In & Screen Overview
    story.append(Paragraph("1. Logging In & User Roles", styles["DocH1"]))
    story.append(Paragraph("Dolly POS supports two security roles:", styles["DocBody"]))
    story.append(Paragraph("• <b>Store Owner (Admin):</b> Has unrestricted access to Financial P&L, wholesale purchase costs, profit margins, master PIN configuration, and destructive database actions.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Counter Cashier (Staff):</b> Has high-speed access to Billing/POS, Returns, Customer Search, and Stock Lookup, while purchase cost prices and P&L sensitive margins are masked for security.", styles["DocBullet"]))
    
    story.append(Paragraph(
        "<b>How to Login:</b><br/>"
        "1. Open the Dolly POS desktop app icon.<br/>"
        "2. Enter your <b>Username</b> (e.g. <code>admin</code> or <code>staff</code>) and <b>Password</b>.<br/>"
        "3. Click <b>Login to POS</b>. You will be redirected to the Main Dashboard or POS Billing Counter.",
        styles["DocBody"]
    ))

    # Section 2: POS Billing Screen (The Cash Counter)
    story.append(Paragraph("2. POS Billing Counter (Fast-Track Checkout)", styles["DocH1"]))
    story.append(Paragraph(
        "The POS Billing screen (<code>/billing</code>) is engineered for 2-second barcode billing during rush hours and festival peaks.",
        styles["DocBody"]
    ))
    story.append(Paragraph("Step-by-Step Billing Workflow:", styles["DocH2"]))
    story.append(Paragraph("1. <b>Barcode Scanning:</b> Place the cursor in the Barcode Scanner input box (or press <code>F2</code>). Scan any product barcode using the laser scanner. The product is added instantly with an audible beep sound.", styles["DocBullet"]))
    story.append(Paragraph("2. <b>Manual Search & Speed Dial:</b> If an item lacks a barcode label, type its name, color, size, or 3-digit Speed Dial code (e.g., <code>101</code>) in the search bar. Use arrow keys to select and press <code>Enter</code>.", styles["DocBullet"]))
    story.append(Paragraph("3. <b>Quantity & Price Adjustments:</b> Click the <code>+</code> / <code>-</code> buttons or type directly in the Qty box. To give an item-level discount, edit the discount percentage or enter a negotiated counter selling price.", styles["DocBullet"]))
    story.append(Paragraph("4. <b>Attaching a Customer:</b> Type the customer's 10-digit mobile number in the Customer box. If existing, their name, loyalty points, and Khata balance load automatically. If new, type their name to save instantly.", styles["DocBullet"]))
    story.append(Paragraph("5. <b>Split Payments & Settlement:</b> Click <b>Pay & Print Bill (F10)</b>. Choose payment mode:<br/>"
                           "&nbsp;&nbsp;• <b>Cash:</b> Enter Cash Tendered (e.g. ₹500 for a ₹320 bill). The change due (₹180) is calculated automatically.<br/>"
                           "&nbsp;&nbsp;• <b>UPI / QR Code:</b> Dynamic UPI QR code appears on screen for the customer to scan via PhonePe/GooglePay/Paytm.<br/>"
                           "&nbsp;&nbsp;• <b>Split Payment:</b> Pay partial in Cash (e.g. ₹200) and balance via UPI (₹120).<br/>"
                           "&nbsp;&nbsp;• <b>Khata (Udhar):</b> Customer due balance is credited to their ledger book with zero interest tracking.", styles["DocBullet"]))
    story.append(Paragraph("6. <b>Print Receipt:</b> Bill prints on the 80mm / 3-inch thermal printer, and WhatsApp digital invoice is sent automatically.", styles["DocBullet"]))

    # Section 3: Inventory Management & Barcode Label Printing
    story.append(Paragraph("3. Inventory & Barcode Label Printing", styles["DocH1"]))
    story.append(Paragraph(
        "The Inventory Screen (<code>/inventory</code>) manages products, stock quantities, size variants, and barcode printing.",
        styles["DocBody"]
    ))
    story.append(Paragraph("• <b>Adding a New Product:</b> Click '+ Add Product'. Fill in Name, Category, Size, Color, Purchase Price (Cost), Selling Price (MRP), and Opening Stock.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Barcode Generation:</b> Dolly POS auto-generates EAN-13 barcodes. You can also assign custom barcodes from existing factory tags.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Printing Barcode Labels:</b> Select one or multiple products, click <b>Print Barcodes</b>, choose label format (<b>1-Up 50x25mm</b> or <b>2-Up 100x50mm</b>), enter quantity, and click Print. The TSC barcode printer will calibrate and print crisp labels with Shop Name, Product Name, Size, Barcode, and MRP.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Low Stock Alerts:</b> Products with stock at or below minimum threshold highlight in bright amber so you can re-order in time.", styles["DocBullet"]))

    # Section 4: Customer Khata Ledger & Udhar Recovery
    story.append(Paragraph("4. Customer Khata (Udhar Ledger) & Loyalty", styles["DocH1"]))
    story.append(Paragraph(
        "Manage store credit (Udhar) and recover outstanding balances with 1-click WhatsApp reminders from <code>/customers</code>.",
        styles["DocBody"]
    ))
    story.append(Paragraph("• <b>Viewing Udhar Balances:</b> The Customer list displays Total Outstanding Credit in red. Click any customer to open their full statement.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Recording Udhar Payments:</b> When a customer pays due cash, click 'Collect Payment', enter amount received, and print a formal payment receipt.", styles["DocBullet"]))
    story.append(Paragraph("• <b>WhatsApp Payment Reminder:</b> Click the WhatsApp icon next to their due balance. A polite WhatsApp reminder is sent with exact due amount and store UPI QR.", styles["DocBullet"]))

    # Section 5: Vendor Purchases & Stock Inward
    story.append(Paragraph("5. Vendor Purchases & Damaged Stock", styles["DocH1"]))
    story.append(Paragraph(
        "In <code>/vendors</code> and <code>/damaged-stock</code>, track wholesale purchases, supplier bills, and defective merchandise.",
        styles["DocBody"]
    ))
    story.append(Paragraph("• <b>Purchase Inward Entry:</b> Select supplier (e.g. Mumbai Wholesaler, Surat Textiles), enter Vendor Invoice Number, add inward items with cost prices. Stock is incremented automatically.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Logging Damaged / Defective Items:</b> If an item arrives damaged from vendor or gets soiled on display, log it in <b>Damaged Stock</b>. It is deducted from saleable inventory and queued for vendor debit note return.", styles["DocBullet"]))

    # Section 6: WhatsApp Marketing & Automated Birthday Greetings
    story.append(Paragraph("6. WhatsApp Marketing & Birthday Automation", styles["DocH1"]))
    story.append(Paragraph(
        "The Marketing module (<code>/marketing</code>) connects your store to customers with festival campaigns and automated birthday offers.",
        styles["DocBody"]
    ))
    story.append(Paragraph("• <b>Festival Bulk Campaigns:</b> Send Diwali, Holi, Eid, or New Year discount coupons to all registered parents in 1 click.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Birthday Automation:</b> Dolly POS checks kids' birthdays daily at 9:00 AM and sends a sweet personalized greeting with a special 10% birthday discount coupon!", styles["DocBullet"]))

    # Section 7: Reports & Profit-and-Loss (P&L) Cockpit
    story.append(Paragraph("7. Financial Reports & P&L Cockpit", styles["DocH1"]))
    story.append(Paragraph(
        "The Reports module (<code>/reports</code>) gives a 100% transparent audit of store revenue, COGS, expenses, and net in-hand profit.",
        styles["DocBody"]
    ))
    story.append(Paragraph("• <b>Gross Turnover:</b> Total invoice billing value across Cash, UPI, and Credit.", styles["DocBullet"]))
    story.append(Paragraph("• <b>COGS (Cost of Goods Sold):</b> Exact wholesale purchase price of goods sold.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Operating Expenses:</b> Total shop overheads (Rent, Electricity, Staff Salaries, Tea/Snacks).", styles["DocBullet"]))
    story.append(Paragraph("• <b>Take-Home Net Profit:</b> True net profit = <code>Gross Margin − Overheads</code>.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Excel Export (.xlsx):</b> Click <b>Export Sales Excel</b> to download full accounting spreadsheets.", styles["DocBullet"]))

    # Section 8: Settings & Backup Security
    story.append(Paragraph("8. Store Settings, Sound & Backup Security", styles["DocH1"]))
    story.append(Paragraph(
        "In <code>/settings</code>, customize receipt headers, social media handles, audio beeps, and backup routines.",
        styles["DocBody"]
    ))
    story.append(Paragraph("• <b>Sound Toggle:</b> Enable or disable the audio beep sound played when items are scanned into the bill.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Database Backup:</b> Click <b>Backup Database Now</b>. A JSON backup is saved to <code>C:\\DollyPOS_Backups</code>. To restore on another machine, upload the file in <b>Restore Database</b>.", styles["DocBullet"]))
    story.append(Paragraph("• <b>Test Print:</b> Test thermal bill receipts and 1-Up / 2-Up barcode labels before billing customers.", styles["DocBullet"]))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated User Manual: {pdf_path}")

# =========================================================================
# 2. TECHNICAL HANDOFF DOCUMENT GENERATION
# =========================================================================
def generate_technical_handoff():
    pdf_path = os.path.join(DOCS_DIR, "Dolly_POS_Technical_Handoff.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54, rightMargin=54,
        topMargin=54, bottomMargin=54
    )
    styles = get_custom_styles()
    story = []

    story.append(Paragraph("Dolly POS — Technical Handoff Document", styles["DocTitle"]))
    story.append(Paragraph("Engineering Architecture, Codebase Walkthrough, Database ERD & Development Changelog", styles["DocSubtitle"]))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#4F46E5"), spaceBefore=0, spaceAfter=12))

    # Section 1: Tech Stack
    story.append(Paragraph("1. Technology Stack & Pinned Versions", styles["DocH1"]))
    tech_data = [
        [Paragraph("Layer", styles["TableHeader"]), Paragraph("Technology / Framework", styles["TableHeader"]), Paragraph("Version", styles["TableHeader"]), Paragraph("Role & Purpose", styles["TableHeader"])],
        [Paragraph("Backend Framework", styles["TableCellBold"]), Paragraph("Python FastAPI", styles["TableCell"]), Paragraph("0.141.1", styles["TableCell"]), Paragraph("High-speed async REST API core", styles["TableCell"])],
        [Paragraph("ASGI Web Server", styles["TableCellBold"]), Paragraph("Uvicorn (Standard)", styles["TableCell"]), Paragraph("0.52.4", styles["TableCell"]), Paragraph("High-concurrency async HTTP server", styles["TableCell"])],
        [Paragraph("ORM / DB Engine", styles["TableCellBold"]), Paragraph("SQLAlchemy + Psycopg2", styles["TableCell"]), Paragraph("2.0.52 / 2.9.12", styles["TableCell"]), Paragraph("Relational data mapping & connection pooling", styles["TableCell"])],
        [Paragraph("Database", styles["TableCellBold"]), Paragraph("PostgreSQL (x64)", styles["TableCell"]), Paragraph("16.x", styles["TableCell"]), Paragraph("ACID transactional enterprise database", styles["TableCell"])],
        [Paragraph("Frontend Library", styles["TableCellBold"]), Paragraph("React 18 + TypeScript", styles["TableCell"]), Paragraph("18.2.0 / 5.2.2", styles["TableCell"]), Paragraph("Type-safe interactive single page application", styles["TableCell"])],
        [Paragraph("Build Tool & Bundler", styles["TableCellBold"]), Paragraph("Vite", styles["TableCell"]), Paragraph("5.1.6", styles["TableCell"]), Paragraph("Ultra-fast HMR and optimized ES build", styles["TableCell"])],
        [Paragraph("UI Styling & Icons", styles["TableCellBold"]), Paragraph("Tailwind CSS + Lucide", styles["TableCell"]), Paragraph("3.4.1 / 0.363", styles["TableCell"]), Paragraph("Modern responsive glassmorphic design system", styles["TableCell"])],
        [Paragraph("State Management", styles["TableCellBold"]), Paragraph("Zustand", styles["TableCell"]), Paragraph("4.5.2", styles["TableCell"]), Paragraph("Persistent lightweight client state (Auth & Cart)", styles["TableCell"])],
        [Paragraph("PDF Generation", styles["TableCellBold"]), Paragraph("ReportLab", styles["TableCell"]), Paragraph("5.0.1", styles["TableCell"]), Paragraph("Programmatic invoice & manual PDF engine", styles["TableCell"])],
        [Paragraph("Data Analytics", styles["TableCellBold"]), Paragraph("Pandas + OpenPyXL", styles["TableCell"]), Paragraph("3.0.5 / 3.1.5", styles["TableCell"]), Paragraph("Excel export and financial aggregation", styles["TableCell"])]
    ]
    t = Table(tech_data, colWidths=[100, 130, 70, 204])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#4F46E5")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#F8FAFC"), colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    # Section 2: File & Directory Tree
    story.append(Paragraph("2. Project Directory Structure & Manifest", styles["DocH1"]))
    story.append(Paragraph(
        "<b>Root Folder:</b> <code>c:\\Users\\SomeshBang\\Desktop\\Antigravity DollyPos\\</code>",
        styles["DocBody"]
    ))
    tree_text = """
Antigravity DollyPos/
├── DollyPOS_Launcher.bat           # Root one-click Windows launcher
├── LICENSE                          # MIT Open Source License
├── README.md                        # Complete technical handoff mirror
├── backend/                         # FastAPI Python Core Backend
│   ├── desktop_app.py               # Production standalone desktop server runner
│   ├── requirements.txt             # Pinned Python package dependencies
│   ├── .env.example                 # Clean configuration template
│   ├── app/
│   │   ├── config.py                # Global settings, DB connection string, JWT secret
│   │   ├── main.py                  # FastAPI bootstrap, lifespan, static mount & CORS
│   │   ├── core/
│   │   │   ├── database.py          # SQLAlchemy SessionLocal & connection engine
│   │   │   └── security.py          # Password hashing (bcrypt) & JWT token encoders
│   │   ├── models/                  # SQLAlchemy Relational Models (12 tables)
│   │   │   ├── user.py, product.py, category.py, invoice.py, customer.py
│   │   │   ├── vendor.py, purchase.py, expense.py, settings.py, audit_log.py
│   │   │   └── return_order.py, lost_demand.py, whatsapp_log.py
│   │   ├── api/                     # REST API Endpoint Routers
│   │   │   ├── auth_router.py, product_router.py, invoice_router.py
│   │   │   ├── customer_router.py, vendor_router.py, purchase_router.py
│   │   │   ├── returns_router.py, expense_router.py, reports_router.py
│   │   │   ├── settings_router.py, backup_router.py, marketing_router.py
│   │   └── services/                # Core Business Logic Services
│   │       ├── analytics_service.py # Dashboard KPIs, 5Y smooth cubic spline curves
│   │       ├── printer_service.py   # Raw TSPL barcode & ESC/POS receipt generation
│   │       └── whatsapp_service.py  # Cloud API messaging & birthday cron
├── frontend/                        # React 18 + TypeScript + Vite SPA
│   ├── package.json                 # Pinned Node dependencies & npm scripts
│   ├── vite.config.ts               # Vite bundler configuration & proxy
│   ├── src/
│   │   ├── App.tsx, main.tsx        # React Root router & application shell
│   │   ├── pages/                   # Main Page Views
│   │   │   ├── DashboardPage.tsx    # Live KPIs, smooth cubic Bézier 5Y chart
│   │   │   ├── BillingPage.tsx      # Barcode checkout, split payment, thermal bill
│   │   │   ├── InventoryPage.tsx    # Stock management, 1-Up/2-Up barcode printer
│   │   │   ├── CustomersPage.tsx    # Khata ledger, Udhar WhatsApp recovery
│   │   │   ├── VendorsPage.tsx      # Wholesale suppliers, purchase inward orders
│   │   │   ├── ReportsPage.tsx      # P&L accounting, YoY comparison, Excel export
│   │   │   ├── SettingsPage.tsx     # Printers, sound toggle, master key, backup
│   │   │   └── LoginPage.tsx        # Dual-role authentication gate
│   │   ├── components/              # Modular UI Components (Navbar, Modals, Tables)
│   │   └── store/authStore.ts       # Zustand persistent JWT token store
├── docs/                            # Publication-grade PDF Documentation
│   ├── Dolly_POS_User_Manual.pdf
│   ├── Dolly_POS_Technical_Handoff.pdf
│   └── Dolly_POS_Disaster_Recovery_and_New_Laptop_Guide.pdf
└── installer/                       # Windows Installation & Uninstallation Scripts
    ├── Install-DollyPOS.bat
    ├── Uninstall-DollyPOS.bat
    └── setup_inno.iss
"""
    story.append(Paragraph(f"<pre>{tree_text.strip()}</pre>", styles["DocCode"]))
    story.append(PageBreak())

    # Section 3: Deep Code Walkthrough (Module by Module)
    story.append(Paragraph("3. Deep Code Walkthrough & Interconnections", styles["DocH1"]))
    
    modules = [
        ("app.core.database (database.py)", "Manages SQLAlchemy engine with PostgreSQL connection pool (pool_size=20, max_overflow=10). Yields thread-safe SessionLocal instances for FastAPI dependency injection via get_db()."),
        ("app.services.analytics_service (analytics_service.py)", "Executes sub-10ms SQL aggregations for Dashboard metrics. Implements smart timeline granularity: Daily (<=45d), Weekly (46-400d), and Monthly (>400d/5Y). Returns smooth timeline curves, 50/30 category balancing metrics, and Units Per Transaction (UPT) cross-sell KPIs."),
        ("app.services.printer_service (printer_service.py)", "Generates raw TSPL (TSC Printer Language) byte streams for 1-Up (50x25mm) and 2-Up (100x50mm) barcode thermal printing. Generates 80mm ESC/POS receipt commands with store logo, QR code, and thermal cut pulses."),
        ("app.api.invoice_router (invoice_router.py)", "Handles billing transactions: validates barcode stock, calculates taxes, applies item/bill discounts, creates immutable Invoice and InvoiceItem records, reduces product stock quantity, logs payment method (Cash, UPI, Split, Khata), and triggers WhatsApp digital receipt dispatch."),
        ("app.api.backup_router (backup_router.py)", "Implements full relational database dump and restoration to/from self-contained JSON backup files. Strips sensitive machine-specific store credentials during export and validates foreign keys during import."),
        ("frontend.src.pages.DashboardPage (DashboardPage.tsx)", "Renders real-time retail pulse, KPI cards (Today's Sales, Monthly Revenue, Today's Net Profit, Inventory Valuation), Cash Flow Liquidity strip, and interactive SVG Monotone Cubic Bézier Spline revenue curves with dynamic hover HUD."),
        ("frontend.src.pages.BillingPage (BillingPage.tsx)", "High-speed counter checkout terminal. Features barcode laser listening, speed dial quick selection, live cart subtotals, split payments modal, change due calculator, and direct thermal print triggers.")
    ]
    for mod_name, mod_desc in modules:
        story.append(Paragraph(f"• <b><code>{mod_name}</code></b>", styles["DocH2"]))
        story.append(Paragraph(mod_desc, styles["DocBody"]))

    # Section 4: Database ERD & Relational Schema
    story.append(Paragraph("4. Database Schema & Relational Structure", styles["DocH1"]))
    schema_data = [
        [Paragraph("Table Name", styles["TableHeader"]), Paragraph("Primary Key", styles["TableHeader"]), Paragraph("Foreign Keys", styles["TableHeader"]), Paragraph("Indexed Columns & Constraints", styles["TableHeader"])],
        [Paragraph("users", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), Paragraph("username (Unique), role, is_active", styles["TableCell"])],
        [Paragraph("categories", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), Paragraph("name (Unique)", styles["TableCell"])],
        [Paragraph("subcategories", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("category_id -> categories.id", styles["TableCell"]), Paragraph("category_id, name", styles["TableCell"])],
        [Paragraph("products", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("category_id, subcategory_id", styles["TableCell"]), Paragraph("barcode (Unique), sku, speed_dial, is_active", styles["TableCell"])],
        [Paragraph("invoices", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("customer_id, user_id", styles["TableCell"]), Paragraph("bill_number (Unique), created_at, payment_mode", styles["TableCell"])],
        [Paragraph("invoice_items", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("invoice_id, product_id", styles["TableCell"]), Paragraph("invoice_id, product_id", styles["TableCell"])],
        [Paragraph("customers", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), Paragraph("phone (Unique), name, current_balance", styles["TableCell"])],
        [Paragraph("customer_ledger", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("customer_id, invoice_id", styles["TableCell"]), Paragraph("customer_id, transaction_date", styles["TableCell"])],
        [Paragraph("purchases", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("vendor_id", styles["TableCell"]), Paragraph("vendor_id, purchase_date, invoice_number", styles["TableCell"])],
        [Paragraph("expenses", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), Paragraph("expense_date, category", styles["TableCell"])]
    ]
    st = Table(schema_data, colWidths=[90, 60, 130, 224])
    st.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#F8FAFC"), colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(st)
    story.append(Spacer(1, 10))

    # Section 5: Historical Bugs & Engineering Solutions
    story.append(Paragraph("5. Historical Bug Log & Resolutions", styles["DocH1"]))
    bugs = [
        ("Database Restore Foreign Key Violation (purchases / purchase_items)", "backend/app/api/backup_router.py", "Deleting products during database restore violated foreign keys on purchase_items and return_items.", "Added ON DELETE CASCADE to purchase_items and return_items foreign keys, and wrapped restore in sequential topological deletion."),
        ("Dashboard Net Profit Today showing negative value", "backend/app/services/analytics_service.py", "Expenses query in get_dashboard_summary was not bounded to today, subtracting entire lifetime expenses.", "Strictly bounded Expense.expense_date between today_start (00:00:00) and today_end (23:59:59)."),
        ("5-Year Timeline Chart Clutter (1,825 daily jagged spikes)", "frontend/src/pages/DashboardPage.tsx", "Plotting daily points over 5 years created dense vertical line spikes.", "Implemented Smart Monthly Grouping (61 months) in backend and Monotone Cubic Bézier Spline paths in frontend SVG."),
        ("Damaged Stock Product Search dropdown staying open", "frontend/src/pages/DamagedStockPage.tsx", "Dropdown had no onBlur / click-outside handler.", "Added active input focus tracking and click-outside dismissal refs."),
        ("Footer Settings Desynchronization between Settings and Printout", "frontend/src/pages/SettingsPage.tsx", "Settings saved into browser localStorage while receipt generation read from database.", "Migrated all footer styling (font size, bold, terms) to database table store_settings with live sync.")
    ]
    for bug_title, bug_file, bug_cause, bug_fix in bugs:
        story.append(Paragraph(f"• <b>Bug: {bug_title}</b> (<code>{bug_file}</code>)", styles["DocH3"]))
        story.append(Paragraph(f"<b>Root Cause:</b> {bug_cause}<br/><b>Fix Applied:</b> {bug_fix}", styles["DocBody"]))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated Technical Handoff Document: {pdf_path}")

# =========================================================================
# 3. DISASTER RECOVERY & NEW LAPTOP GUIDE GENERATION
# =========================================================================
def generate_disaster_recovery_guide():
    pdf_path = os.path.join(DOCS_DIR, "Dolly_POS_Disaster_Recovery_and_New_Laptop_Guide.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54, rightMargin=54,
        topMargin=54, bottomMargin=54
    )
    styles = get_custom_styles()
    story = []

    story.append(Paragraph("Dolly POS — New Machine & Disaster Recovery Guide", styles["DocTitle"]))
    story.append(Paragraph("Zero-to-Hero Setup Walkthrough for Brand New Windows Laptop or System Recovery", styles["DocSubtitle"]))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#059669"), spaceBefore=0, spaceAfter=12))

    story.append(Paragraph(
        "This document provides complete, no-steps-skipped instructions to set up Dolly POS on a brand new Windows laptop "
        "or recover from a complete hard drive failure in under 15 minutes.",
        styles["DocBody"]
    ))

    # Phase 1: Prerequisites
    story.append(Paragraph("Phase 1: Install Software Prerequisites", styles["DocH1"]))
    story.append(Paragraph(
        "Install the following 3 programs on the new Windows laptop:",
        styles["DocBody"]
    ))
    story.append(Paragraph("1. <b>PostgreSQL 16 (Database):</b> Download from <code>https://www.enterprisedb.com/downloads/postgres-postgresql-downloads</code>. "
                           "During installation, set password to <code>somesh123</code> (or your custom password) and port to <code>5432</code>.", styles["DocBullet"]))
    story.append(Paragraph("2. <b>Python 3.12+ (Backend):</b> Download from <code>https://www.python.org/downloads/</code>. "
                           "<b>CRITICAL:</b> Check the box <code>[X] Add Python to PATH</code> before clicking Install.", styles["DocBullet"]))
    story.append(Paragraph("3. <b>Node.js LTS (Frontend - Optional for developer mode):</b> Download from <code>https://nodejs.org/</code>.", styles["DocBullet"]))

    # Phase 2: Create Database
    story.append(Paragraph("Phase 2: Create the Database", styles["DocH1"]))
    story.append(Paragraph(
        "Open <b>pgAdmin 4</b> or <b>SQL Shell (psql)</b> and run the following command to create the database:",
        styles["DocBody"]
    ))
    story.append(Paragraph("<code>CREATE DATABASE dollytoyskidswear;</code>", styles["DocCode"]))

    # Phase 3: Hardware Printers Setup
    story.append(Paragraph("Phase 3: Hardware Printer & Barcode Drivers Setup", styles["DocH1"]))
    
    printer_data = [
        [Paragraph("Hardware Device", styles["TableHeader"]), Paragraph("Driver & Software", styles["TableHeader"]), Paragraph("Configuration & Port", styles["TableHeader"]), Paragraph("TSPL / ESC Commands", styles["TableHeader"])],
        [
            Paragraph("TSC Thermal Barcode Printer", styles["TableCellBold"]),
            Paragraph("Seagull Scientific TSC Driver (or BarTender)", styles["TableCell"]),
            Paragraph("USB Virtual COM / USB001<br/>Darkness: 10<br/>Speed: 3 ips", styles["TableCell"]),
            Paragraph("SIZE 50 mm, 25 mm<br/>GAP 3 mm, 0 mm<br/>CODE 128<br/>File: <code>printer_service.py</code>", styles["TableCell"])
        ],
        [
            Paragraph("80mm Thermal Receipt Printer", styles["TableCellBold"]),
            Paragraph("POS-80 Windows Thermal Driver", styles["TableCell"]),
            Paragraph("USB001 / Raw Port 9100<br/>Paper: 80 x 297 mm", styles["TableCell"]),
            Paragraph("ESC @ (Init)<br/>ESC a 1 (Center)<br/>GS V 0 (Full Cut)<br/>File: <code>printer_service.py</code>", styles["TableCell"])
        ],
        [
            Paragraph("USB Barcode Scanner", styles["TableCellBold"]),
            Paragraph("Plug & Play HID Keyboard Device", styles["TableCell"]),
            Paragraph("USB Port (Any)<br/>Baud: Auto", styles["TableCell"]),
            Paragraph("Suffix configured with Carriage Return (CR / Enter key)", styles["TableCell"])
        ]
    ]
    pt = Table(printer_data, colWidths=[110, 120, 120, 154])
    pt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#059669")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#F8FAFC"), colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(pt)
    story.append(Spacer(1, 10))

    # Phase 4: Install and Launch Dolly POS
    story.append(Paragraph("Phase 4: Clone Code & Run Automated Installer", styles["DocH1"]))
    story.append(Paragraph(
        "1. Copy the project folder to the new laptop (e.g. <code>C:\\DollyPOS</code>).<br/>"
        "2. Double-click <code>installer\\Install-DollyPOS.bat</code>.<br/>"
        "3. The installer creates the Python virtual environment, installs locked packages from <code>requirements.txt</code>, and creates the Desktop shortcut.<br/>"
        "4. Double-click the <b>'Dolly POS'</b> shortcut on your Desktop. The app will launch at <code>http://127.0.0.1:8000</code>.",
        styles["DocBody"]
    ))

    # Phase 5: Restore Database from Backup JSON
    story.append(Paragraph("Phase 5: Restoring Shop Data from Backup", styles["DocH1"]))
    story.append(Paragraph(
        "1. Login to Dolly POS as <code>admin</code>.<br/>"
        "2. Go to <b>Settings (⚙️)</b> -> <b>Backup & Restore</b> tab.<br/>"
        "3. Under <b>Restore Database from Backup</b>, click 'Choose File' and select your latest <code>DollyToys_CompleteBackup_YYYYMMDD_HHMMSS.json</code>.<br/>"
        "4. Click <b>Restore Database</b>. All products, customers, bills, purchases, and Khata ledger will be restored with 100% data integrity in under 2 seconds!",
        styles["DocBody"]
    ))

    # Phase 6: Sensitive Secrets & Credentials Backup
    story.append(Paragraph("Phase 6: Sensitive Credentials & Master Key Storage", styles["DocH1"]))
    story.append(Paragraph(
        "<b>Where are credentials stored?</b><br/>"
        "• <b>Database Password & JWT Secret:</b> Stored in <code>backend\\.env</code> (or fallback defaults in <code>backend\\app\\config.py</code>).<br/>"
        "• <b>Master Security PIN:</b> Configured in <code>store_settings</code> table and verified in <code>backend\\app\\api\\auth_router.py</code> (Default Master PIN: <code>9999</code>).<br/>"
        "• <b>User Logins:</b> Encrypted with bcrypt in <code>users</code> table.<br/><br/>"
        "<b>Secure Backup Advice:</b> Keep a copy of your <code>backend\\.env</code> on a password-protected USB drive or secure password manager (e.g. Bitwarden/1Password). Never upload <code>.env</code> to public GitHub.",
        styles["DocBody"]
    ))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated Disaster Recovery Guide: {pdf_path}")

def main():
    print("=== Step 3: Generating All 3 Publication-Grade PDF Documents ===")
    generate_user_manual()
    generate_technical_handoff()
    generate_disaster_recovery_guide()
    print("All 3 PDF manuals generated successfully in docs/ folder!")

if __name__ == "__main__":
    main()
