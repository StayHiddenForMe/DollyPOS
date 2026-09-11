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
    styles.add(ParagraphStyle(
        name="TableCellCode",
        fontName="Courier",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0F172A")
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

    # Title & Metadata Banner
    story.append(Paragraph("Dolly POS — Master Technical Handoff Document", styles["DocTitle"]))
    story.append(Paragraph("Comprehensive Engineering Architecture, Modules, Phases, File Hierarchy, Database Schemas, ERD & Coding Rules", styles["DocSubtitle"]))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#4F46E5"), spaceBefore=0, spaceAfter=10))

    # =========================================================================
    # SECTION 1: COMPLETE PROJECT SUMMARY & MISSION
    # =========================================================================
    story.append(Paragraph("1. Executive Project Summary & System Architecture", styles["DocH1"]))
    story.append(Paragraph(
        "<b>Dolly POS</b> is an enterprise-grade, high-concurrency retail point-of-sale and store management ecosystem engineered "
        "specifically for <b>Dolly Toys & Kids Wear</b> in Dhule, Maharashtra. The system unites high-speed checkout billing, "
        "deep inventory management with size/color variants, Customer Khata (store credit) ledgers, wholesale vendor procurement, "
        "hardware thermal receipt & barcode printing, WhatsApp marketing automation, AI-driven stock intelligence, and multi-year "
        "Profit-and-Loss (P&L) accounting into a unified, standalone desktop application.",
        styles["DocBody"]
    ))
    story.append(Paragraph(
        "The application is built on a modern decoupled architecture: a high-performance Python FastAPI asynchronous backend, "
        "a PostgreSQL 16 ACID-compliant relational database, an interactive React 18 TypeScript Single Page Application (SPA), "
        "and an embedded Microsoft Edge WebView2 native desktop wrapper running with zero terminal dependencies.",
        styles["DocBody"]
    ))

    # Technology Stack Table
    tech_data = [
        [Paragraph("Layer / Subsystem", styles["TableHeader"]), Paragraph("Technology / Framework", styles["TableHeader"]), Paragraph("Version", styles["TableHeader"]), Paragraph("Key Role & Responsibility", styles["TableHeader"])],
        [Paragraph("Backend Framework", styles["TableCellBold"]), Paragraph("Python FastAPI", styles["TableCell"]), Paragraph("0.141.1", styles["TableCell"]), Paragraph("High-speed asynchronous REST API endpoints & DI", styles["TableCell"])],
        [Paragraph("ASGI Server Engine", styles["TableCellBold"]), Paragraph("Uvicorn (Standard)", styles["TableCell"]), Paragraph("0.52.4", styles["TableCell"]), Paragraph("High-concurrency async event loop & HTTP routing", styles["TableCell"])],
        [Paragraph("ORM & Database Core", styles["TableCellBold"]), Paragraph("SQLAlchemy + Psycopg2", styles["TableCell"]), Paragraph("2.0.52 / 2.9.12", styles["TableCell"]), Paragraph("Relational model mapping & connection pooling", styles["TableCell"])],
        [Paragraph("Database Engine", styles["TableCellBold"]), Paragraph("PostgreSQL (x64)", styles["TableCell"]), Paragraph("16.x", styles["TableCell"]), Paragraph("ACID relational store with B-Tree compound indexes", styles["TableCell"])],
        [Paragraph("Desktop GUI Runtime", styles["TableCellBold"]), Paragraph("pywebview (Edge Chromium)", styles["TableCell"]), Paragraph("6.2.1", styles["TableCell"]), Paragraph("Embedded native desktop window (no browser tabs)", styles["TableCell"])],
        [Paragraph("Frontend SPA Core", styles["TableCellBold"]), Paragraph("React 18 + TypeScript", styles["TableCell"]), Paragraph("18.2.0 / 5.2.2", styles["TableCell"]), Paragraph("Type-safe reactive stateful user interface", styles["TableCell"])],
        [Paragraph("Build Tool & Bundler", styles["TableCellBold"]), Paragraph("Vite", styles["TableCell"]), Paragraph("5.1.6", styles["TableCell"]), Paragraph("Optimized single-bundle asset compilation", styles["TableCell"])],
        [Paragraph("UI Styling & Icons", styles["TableCellBold"]), Paragraph("Tailwind CSS + Lucide", styles["TableCell"]), Paragraph("3.4.1 / 0.363", styles["TableCell"]), Paragraph("Glassmorphic modern responsive design system", styles["TableCell"])],
        [Paragraph("State Management", styles["TableCellBold"]), Paragraph("Zustand", styles["TableCell"]), Paragraph("4.5.2", styles["TableCell"]), Paragraph("Persistent client state (Cart, Auth, Theme)", styles["TableCell"])],
        [Paragraph("Hardware Printing", styles["TableCellBold"]), Paragraph("Raw TSPL & ESC/POS", styles["TableCell"]), Paragraph("Custom Driver", styles["TableCell"]), Paragraph("1-Up/2-Up barcode labels & 80mm thermal receipts", styles["TableCell"])],
        [Paragraph("Analytics & Reporting", styles["TableCellBold"]), Paragraph("Pandas + OpenPyXL + ReportLab", styles["TableCell"]), Paragraph("Latest", styles["TableCell"]), Paragraph("Excel export, SVG spline curves, PDF generator", styles["TableCell"])]
    ]
    t_tech = Table(tech_data, colWidths=[90, 115, 60, 239])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#4F46E5")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#F8FAFC"), colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(t_tech)
    story.append(Spacer(1, 8))

    # =========================================================================
    # SECTION 2: ALL DEVELOPMENT PHASES
    # =========================================================================
    story.append(Paragraph("2. All Development Phases & Evolution Roadmap", styles["DocH1"]))
    
    phases = [
        ("Phase 1: Architecture Inception & Core Foundation", 
         "Established PostgreSQL relational schemas, FastAPI REST API structure, and React 18 TypeScript frontend scaffold. Designed dual-role security (Admin vs Cashier) with bcrypt password hashing and JWT token authentication."),
        
        ("Phase 2: High-Speed POS Counter & Hardware Integration", 
         "Engineered 2-second fast-track checkout screen with keyboard shortcuts (F2/F10), barcode laser scanner listening, 3-digit speed dials, unlisted item modal, split payments (Cash, UPI, Khata), dynamic NPCI UPI QR generator, raw TSPL 1-Up (50x25mm) and 2-Up (100x50mm) barcode thermal label engine, and 80mm ESC/POS thermal receipt printer integration."),
        
        ("Phase 3: Deep Inventory, Category Hierarchy & Customer Khata", 
         "Structured 18 primary store categories and 130 subcategories. Built product variant matrix (Sizes, Colors, Age Groups), EAN-13 automatic barcode generator, and live stock tracking. Implemented Customer Khata (store credit) ledger with real-time balance tracking and 1-click WhatsApp payment reminders with store UPI QR codes."),
        
        ("Phase 4: Vendor Procurement, Damaged Stock & AI Retail Advisor", 
         "Added wholesale supplier directory, inward purchase orders with cost tracking, and damaged/defective merchandise logging. Developed AI Smart Stock Advisor to detect dead/slow-moving stock, compute sell-through velocity, and generate automated purchase reorder recommendations."),
        
        ("Phase 5: Financial P&L Cockpit & Multi-Year Timeline Analytics", 
         "Built complete Profit-and-Loss (P&L) accounting engine computing Gross Turnover, wholesale COGS, store overhead expenses, and true Take-Home Net Profit. Built dynamic 1M, 6M, 1Y, 5Y timeline views with smart grouping (Daily <=45d, Weekly 46-400d, Monthly >400d) and smooth SVG Monotone Cubic Bézier Spline curves."),
        
        ("Phase 6: Hardcore QA, 10,000 Product Stress-Testing & Performance Tuning", 
         "Conducted extreme load testing with 10,000+ products and 10-year synthetic transaction logs. Optimized database queries using compound B-Tree indexes, compound SQL joins, and payload compression to achieve sub-10ms response times across all endpoints."),
        
        ("Phase 7: Production Hardening, Database Sanitization & Standalone Distribution", 
         "Engineered topological JSON database backup and restore with ON DELETE CASCADE integrity. Sanitized database to 0 test records while keeping master categories and admin credentials intact. Packaged application into a standalone Windows .exe with Microsoft Edge WebView2, automated batch installer, and publication manuals.")
    ]

    for p_num, p_desc in phases:
        story.append(Paragraph(f"• <b>{p_num}</b>", styles["DocH2"]))
        story.append(Paragraph(p_desc, styles["DocBody"]))

    story.append(PageBreak())

    # =========================================================================
    # SECTION 3: ALL MODULE NAMES & RESPONSIBILITIES
    # =========================================================================
    story.append(Paragraph("3. All Modules Inventory & Architectural Responsibilities", styles["DocH1"]))
    story.append(Paragraph(
        "The Dolly POS system is organized into modular subsystems across the backend API, service business logic, and frontend UI:",
        styles["DocBody"]
    ))

    modules_data = [
        [Paragraph("Module / Namespace", styles["TableHeader"]), Paragraph("Layer", styles["TableHeader"]), Paragraph("Key Files", styles["TableHeader"]), Paragraph("Core Responsibilities & Capabilities", styles["TableHeader"])],
        
        [Paragraph("Authentication & Security", styles["TableCellBold"]), Paragraph("Backend", styles["TableCell"]), 
         Paragraph("<code>auth_router.py</code><br/><code>security.py</code>", styles["TableCellCode"]), 
         Paragraph("Handles user login, bcrypt password hashing, JWT bearer tokens, role validation (Admin vs Cashier), and Master Security PIN checks.", styles["TableCell"])],
        
        [Paragraph("Billing & POS Engine", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>billing_router.py</code><br/><code>BillingPage.tsx</code>", styles["TableCellCode"]), 
         Paragraph("Barcode checkout, cart calculations, item/bill discounts, split payments (Cash/UPI/Khata), change calculator, and invoice generation.", styles["TableCell"])],
        
        [Paragraph("Inventory & Catalog", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>product_router.py</code><br/><code>InventoryPage.tsx</code>", styles["TableCellCode"]), 
         Paragraph("Product CRUD, SKU/Barcode lookup, stock quantities, min stock alerts, price history modal, and CSV/Excel batch imports.", styles["TableCell"])],
        
        [Paragraph("Category Hierarchy", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>category_router.py</code><br/><code>category_schema.py</code>", styles["TableCellCode"]), 
         Paragraph("Maintains 18 root store categories and 130 granular subcategories with parent-child cascade validation.", styles["TableCell"])],
        
        [Paragraph("Customer & Khata Ledger", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>customer_router.py</code><br/><code>CustomerPage.tsx</code>", styles["TableCellCode"]), 
         Paragraph("Customer directory, Udhar credit balance, ledger transaction history, payment collection, and WhatsApp payment recovery.", styles["TableCell"])],
        
        [Paragraph("Vendor Procurement", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>vendor_router.py</code><br/><code>purchase_router.py</code>", styles["TableCellCode"]), 
         Paragraph("Wholesale supplier profiles, inward purchase orders, batch cost tracking, and vendor balance ledgers.", styles["TableCell"])],
        
        [Paragraph("Damaged & Defective Stock", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>return_router.py</code><br/><code>DefectiveStockPage.tsx</code>", styles["TableCellCode"]), 
         Paragraph("Logs soiled/defective merchandise, deducts from active sellable stock, and tracks vendor debit note returns.", styles["TableCell"])],
        
        [Paragraph("Returns & Exchanges", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>return_router.py</code><br/><code>ReturnsPage.tsx</code>", styles["TableCellCode"]), 
         Paragraph("Processes customer bill returns, refunds cash or store credit, restocks sellable goods, and updates P&L.", styles["TableCell"])],
        
        [Paragraph("Operating Expenses", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>expense_router.py</code><br/><code>ExpensePage.tsx</code>", styles["TableCellCode"]), 
         Paragraph("Tracks shop overheads (Rent, Electricity, Staff Salaries, Tea/Snacks, Maintenance) categorized by date.", styles["TableCell"])],
        
        [Paragraph("Financial Reports & P&L", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>reports_router.py</code><br/><code>ReportsPage.tsx</code>", styles["TableCellCode"]), 
         Paragraph("Calculates Gross Turnover, COGS, Net Margin, Operating Overheads, Net Take-Home Profit, YoY growth, and Excel export.", styles["TableCell"])],
        
        [Paragraph("Analytics & Spline Curves", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>analytics_service.py</code><br/><code>DashboardPage.tsx</code>", styles["TableCellCode"]), 
         Paragraph("Sub-10ms SQL aggregations, 1M/6M/1Y/5Y granularity, smooth Monotone Cubic Bézier Splines, and Category 50/30 health.", styles["TableCell"])],
        
        [Paragraph("Hardware Printers & TSPL", styles["TableCellBold"]), Paragraph("Backend Service", styles["TableCell"]), 
         Paragraph("<code>printer_drivers.py</code><br/><code>receipt_service.py</code>", styles["TableCellCode"]), 
         Paragraph("Generates raw TSPL byte streams for 1-Up (50x25mm) / 2-Up (100x50mm) TSC barcode labels and 80mm ESC/POS receipts.", styles["TableCell"])],
        
        [Paragraph("AI Retail Advisor", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>ai_advisor_service.py</code><br/><code>SmartAdvisorPage.tsx</code>", styles["TableCellCode"]), 
         Paragraph("Statistical sales velocity analysis, dead stock categorization, and automated procurement reorder planning.", styles["TableCell"])],
        
        [Paragraph("WhatsApp Marketing", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>whatsapp_service.py</code><br/><code>marketing_router.py</code>", styles["TableCellCode"]), 
         Paragraph("Automated 9:00 AM daily kids' birthday greetings with coupons, festival promotional campaigns, and digital bill PDFs.", styles["TableCell"])],
        
        [Paragraph("Database Backup & Restore", styles["TableCellBold"]), Paragraph("Backend Service", styles["TableCell"]), 
         Paragraph("<code>backup_router.py</code><br/><code>backup_service.py</code>", styles["TableCellCode"]), 
         Paragraph("Self-contained JSON relational export and topological foreign-key safe restoration with automatic integrity checks.", styles["TableCell"])],
        
        [Paragraph("Store Settings & Audio", styles["TableCellBold"]), Paragraph("Backend + Frontend", styles["TableCell"]), 
         Paragraph("<code>settings_router.py</code><br/><code>SettingsPage.tsx</code>", styles["TableCellCode"]), 
         Paragraph("Receipt header/footer customization, printer port selection, sound toggle for barcode beeps, and master key update.", styles["TableCell"])],
        
        [Paragraph("Native Desktop Runner", styles["TableCellBold"]), Paragraph("Backend Core", styles["TableCell"]), 
         Paragraph("<code>desktop_app.py</code><br/><code>build_standalone_exe.py</code>", styles["TableCellCode"]), 
         Paragraph("Launches borderless Microsoft Edge WebView2 desktop window with background Uvicorn daemon and SafeNullStream.", styles["TableCell"])]
    ]

    t_mod = Table(modules_data, colWidths=[90, 55, 105, 254])
    t_mod.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#F8FAFC"), colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(t_mod)
    story.append(Spacer(1, 8))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 4: FILE AND FOLDER HIERARCHY WITH DETAILED DESCRIPTIONS
    # =========================================================================
    story.append(Paragraph("4. Complete File and Folder Hierarchy with Detailed Descriptions", styles["DocH1"]))
    story.append(Paragraph(
        "Below is the complete, exhaustive directory and file mapping of the Dolly POS codebase:",
        styles["DocBody"]
    ))

    file_hierarchy_data = [
        [Paragraph("File / Folder Path", styles["TableHeader"]), Paragraph("Category", styles["TableHeader"]), Paragraph("Exact Purpose & Functional Description", styles["TableHeader"])],
        
        # Root Files
        [Paragraph("<code>DollyPOS_Setup_Installer.bat</code>", styles["TableCellCode"]), Paragraph("Root Installer", styles["TableCell"]), Paragraph("Scans system requirements, checks binary, and creates 1-click Desktop and Start Menu shortcuts.", styles["TableCell"])],
        [Paragraph("<code>DollyPOS_Launcher.bat</code>", styles["TableCellCode"]), Paragraph("Root Launcher", styles["TableCell"]), Paragraph("Quick developer batch launcher that spins up Uvicorn backend and Vite frontend concurrently.", styles["TableCell"])],
        [Paragraph("<code>README.md</code>", styles["TableCellCode"]), Paragraph("Documentation", styles["TableCell"]), Paragraph("Master technical documentation, schema definitions, and operational playbook.", styles["TableCell"])],
        
        # Backend Core
        [Paragraph("<code>backend/desktop_app.py</code>", styles["TableCellCode"]), Paragraph("Backend Core", styles["TableCell"]), Paragraph("Production desktop launcher. Starts background Uvicorn daemon and opens native Edge WebView2 window.", styles["TableCell"])],
        [Paragraph("<code>backend/build_standalone_exe.py</code>", styles["TableCellCode"]), Paragraph("Build Script", styles["TableCell"]), Paragraph("PyInstaller compilation script bundling Python backend, ReportLab, pywebview, and React frontend build.", styles["TableCell"])],
        [Paragraph("<code>backend/requirements.txt</code>", styles["TableCellCode"]), Paragraph("Config", styles["TableCell"]), Paragraph("Pinned Python package dependencies (FastAPI, SQLAlchemy, pywebview, ReportLab, etc.).", styles["TableCell"])],
        [Paragraph("<code>backend/app/config.py</code>", styles["TableCellCode"]), Paragraph("Backend Config", styles["TableCell"]), Paragraph("Pydantic BaseSettings loading PostgreSQL connection URI, JWT secret key, and CORS origins.", styles["TableCell"])],
        [Paragraph("<code>backend/app/main.py</code>", styles["TableCellCode"]), Paragraph("Backend Core", styles["TableCell"]), Paragraph("FastAPI app instance, lifespan initialization, CORS middleware, API router mounting, and static SPA serving.", styles["TableCell"])],
        [Paragraph("<code>backend/app/core/database.py</code>", styles["TableCellCode"]), Paragraph("Database Core", styles["TableCell"]), Paragraph("SQLAlchemy engine, connection pooling (pool_size=20), Base declarative class, and get_db() session provider.", styles["TableCell"])],
        [Paragraph("<code>backend/app/core/security.py</code>", styles["TableCellCode"]), Paragraph("Security Core", styles["TableCell"]), Paragraph("Bcrypt password hashing, token generation, and OAuth2 password bearer token authentication.", styles["TableCell"])],
        
        # Backend Models
        [Paragraph("<code>backend/app/models/user.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("SQLAlchemy model for store users (id, username, password_hash, role, is_active).", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/product.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("Product catalog model (barcode, sku, name, category, purchase_price, selling_price, stock_qty).", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/category.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("Root Category and Subcategory relational models with parent-child foreign key cascade.", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/invoice.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("Immutable Invoice and InvoiceItem models tracking bill totals, taxes, discounts, and payment modes.", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/customer.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("Customer master model and CustomerLedger tracking Khata credit balances and payment repayments.", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/vendor.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("Wholesale supplier model (name, phone, address, GST, current balance due).", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/purchase.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("Purchase inward master and PurchaseItem models for wholesale stock additions and supplier bills.", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/expense.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("Store operating expenses model (category, amount, payment_mode, expense_date, notes).", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/return_order.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("ReturnOrder and ReturnItem models for customer product returns and damaged stock logging.", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/settings.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("StoreSettings model storing shop name, address, GSTIN, receipt footers, audio toggle, and master PIN.", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/audit_log.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("Audit log model recording user actions, price edits, deletions, and administrative events.", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/whatsapp.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("WhatsApp marketing campaign and message dispatch log model.", styles["TableCell"])],
        [Paragraph("<code>backend/app/models/lost_demand.py</code>", styles["TableCellCode"]), Paragraph("ORM Model", styles["TableCell"]), Paragraph("Logs customer requests for out-of-stock items to guide procurement planning.", styles["TableCell"])],
        
        # Backend Services
        [Paragraph("<code>backend/app/services/analytics_service.py</code>", styles["TableCellCode"]), Paragraph("Service", styles["TableCell"]), Paragraph("High-speed SQL aggregations for Dashboard KPIs, 50/30 category health, and 5-year timeline curves.", styles["TableCell"])],
        [Paragraph("<code>backend/app/services/printer_drivers.py</code>", styles["TableCellCode"]), Paragraph("Service", styles["TableCell"]), Paragraph("Direct socket/spooler TSPL barcode generator and ESC/POS thermal receipt formatter.", styles["TableCell"])],
        [Paragraph("<code>backend/app/services/receipt_service.py</code>", styles["TableCellCode"]), Paragraph("Service", styles["TableCell"]), Paragraph("Generates 80mm thermal receipts with store logo, tax breakdown, and dynamic UPI QR code.", styles["TableCell"])],
        [Paragraph("<code>backend/app/services/ai_advisor_service.py</code>", styles["TableCellCode"]), Paragraph("Service", styles["TableCell"]), Paragraph("Statistical stock intelligence, dead inventory detection, and procurement forecasting.", styles["TableCell"])],
        [Paragraph("<code>backend/app/services/backup_service.py</code>", styles["TableCellCode"]), Paragraph("Service", styles["TableCell"]), Paragraph("Relational database JSON dump and topological foreign-key safe restoration.", styles["TableCell"])],
        
        # Frontend Pages
        [Paragraph("<code>frontend/src/pages/DashboardPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Executive dashboard displaying live sales KPIs, liquidity strip, and SVG Monotone Cubic Bézier charts.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/BillingPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("POS checkout screen with barcode scanner input, speed dials, cart grid, and split payment modal.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/InventoryPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Product catalog with low-stock badges, price history modal, and batch barcode print actions.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/BarcodePage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("1-Up (50x25mm) and 2-Up (100x50mm) barcode sticker preview and batch thermal print trigger.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/CustomerPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Customer Khata directory, ledger transaction history, and 1-click WhatsApp payment reminders.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/VendorPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Wholesale suppliers list, supplier balance ledger, and contact management.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/PurchasePage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Inward purchase order entry interface with cost prices and automatic inventory stock increment.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/ReturnsPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Customer bill returns interface with condition inspection and refund method selection.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/DefectiveStockPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Damaged merchandise tracker with auto-hiding search dropdown and vendor debit note logger.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/ExpensePage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Daily/monthly store overhead expenses manager with category breakdown.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/ReportsPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Financial P&L statement, COGS breakdown, gross vs net profit, and Excel (.xlsx) download.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/SmartAdvisorPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("AI inventory health advisor, dead stock detection, and procurement reorder planner.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/WhatsAppMarketingPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Festival bulk messaging campaigns and 9:00 AM automated birthday greeting scheduler.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/SettingsPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Receipt footer customization, sound toggle, printer configuration, and JSON backup/restore.", styles["TableCell"])],
        [Paragraph("<code>frontend/src/pages/LoginPage.tsx</code>", styles["TableCellCode"]), Paragraph("UI Page", styles["TableCell"]), Paragraph("Dual-role login screen (Admin vs Staff) with JWT persistence.", styles["TableCell"])]
    ]

    t_files = Table(file_hierarchy_data, colWidths=[130, 75, 299])
    t_files.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#4F46E5")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#F8FAFC"), colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(t_files)
    story.append(Spacer(1, 8))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 5: DATABASE ERD DIAGRAM & ALL 19 TABLE SCHEMAS
    # =========================================================================
    story.append(Paragraph("5. Database Relational Diagram (ERD) & Schema Specification", styles["DocH1"]))
    story.append(Paragraph(
        "Dolly POS operates on a normalized, ACID-compliant PostgreSQL schema with 19 tables connected through strict foreign keys:",
        styles["DocBody"]
    ))

    # ASCII ERD Diagram
    erd_text = """
+------------------+         1 : N         +----------------------+
|    categories    |---------------------->|    subcategories     |
+------------------+                       +----------------------+
        |                                             |
        | 1 : N                                       | 1 : N
        v                                             v
+-----------------------------------------------------------------+
|                            products                             |
+-----------------------------------------------------------------+
   | 1 : N            | 1 : N             | 1 : N            | 1 : N
   v                  v                   v                  v
+--------------+  +----------------+  +----------------+  +-----------------+
|invoice_items |  | purchase_items |  |  return_items  |  | price_history   |
+--------------+  +----------------+  +----------------+  +-----------------+
   | N : 1            | N : 1             | N : 1
   v                  v                   v
+--------------+  +----------------+  +----------------+
|   invoices   |  |   purchases    |  | return_orders  |
+--------------+  +----------------+  +----------------+
   | N : 1                | N : 1             | N : 1
   v                      v                   v
+--------------+  +----------------+          |
|  customers   |  |    vendors     |          |
+--------------+  +----------------+          |
   | 1 : N                                    |
   v                                          |
+------------------+                          |
| customer_ledger  |                          |
+------------------+                          |
                                              |
+---------------------------------------------+
| System & Governance: users, store_settings, audit_logs, expenses, whatsapp_logs |
+---------------------------------------------------------------------------------+
"""
    story.append(Paragraph(f"<pre>{erd_text.strip()}</pre>", styles["DocCode"]))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Complete 19-Table Database Schema Reference:", styles["DocH2"]))

    schema_tables_data = [
        [Paragraph("Table Name", styles["TableHeader"]), Paragraph("Primary Key", styles["TableHeader"]), Paragraph("Foreign Keys & Connections", styles["TableHeader"]), Paragraph("Key Columns, Data Types & Constraints", styles["TableHeader"])],
        
        [Paragraph("<code>users</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), 
         Paragraph("username (Varchar 50, Unique), password_hash (Text), role (Enum: admin/staff), full_name (Varchar 100), is_active (Bool)", styles["TableCell"])],
        
        [Paragraph("<code>categories</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), 
         Paragraph("name (Varchar 100, Unique), display_order (Int), is_active (Bool)", styles["TableCell"])],
        
        [Paragraph("<code>subcategories</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("category_id -> categories.id (Cascade)", styles["TableCell"]), 
         Paragraph("category_id (Int, Indexed), name (Varchar 100), age_group (Varchar 50), is_active (Bool)", styles["TableCell"])],
        
        [Paragraph("<code>products</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("category_id -> categories.id<br/>subcategory_id -> subcategories.id", styles["TableCell"]), 
         Paragraph("barcode (Varchar 64, Unique, Indexed), sku (Varchar 64), name (Varchar 255), purchase_price (Numeric 10,2), selling_price (Numeric 10,2), stock_qty (Int), min_stock (Int), speed_dial (Varchar 10, Indexed)", styles["TableCell"])],
        
        [Paragraph("<code>product_price_history</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("product_id -> products.id (Cascade)", styles["TableCell"]), 
         Paragraph("product_id (Int, Indexed), old_price (Numeric 10,2), new_price (Numeric 10,2), changed_by (Int), changed_at (Timestamp)", styles["TableCell"])],
        
        [Paragraph("<code>customers</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), 
         Paragraph("phone (Varchar 20, Unique, Indexed), name (Varchar 150), kid_name (Varchar 100), kid_dob (Date), current_balance (Numeric 10,2), loyalty_points (Int)", styles["TableCell"])],
        
        [Paragraph("<code>customer_ledger</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("customer_id -> customers.id (Cascade)<br/>invoice_id -> invoices.id", styles["TableCell"]), 
         Paragraph("customer_id (Int, Indexed), transaction_type (Enum: debit/credit), amount (Numeric 10,2), balance_after (Numeric 10,2), description (Text), created_at (Timestamp)", styles["TableCell"])],
        
        [Paragraph("<code>invoices</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("customer_id -> customers.id<br/>user_id -> users.id", styles["TableCell"]), 
         Paragraph("bill_number (Varchar 50, Unique, Indexed), subtotal (Numeric 10,2), discount_amount (Numeric 10,2), tax_amount (Numeric 10,2), final_total (Numeric 10,2), payment_mode (Varchar 50), is_cancelled (Bool), created_at (Timestamp)", styles["TableCell"])],
        
        [Paragraph("<code>invoice_items</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("invoice_id -> invoices.id (Cascade)<br/>product_id -> products.id", styles["TableCell"]), 
         Paragraph("invoice_id (Int, Indexed), product_id (Int, Indexed), quantity (Int), unit_price (Numeric 10,2), purchase_price (Numeric 10,2), item_discount (Numeric 10,2), total_amount (Numeric 10,2)", styles["TableCell"])],
        
        [Paragraph("<code>vendors</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), 
         Paragraph("name (Varchar 150, Unique), phone (Varchar 20), gstin (Varchar 20), city (Varchar 100), current_balance (Numeric 10,2), is_active (Bool)", styles["TableCell"])],
        
        [Paragraph("<code>purchases</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("vendor_id -> vendors.id", styles["TableCell"]), 
         Paragraph("invoice_number (Varchar 100), vendor_id (Int, Indexed), total_amount (Numeric 10,2), payment_status (Varchar 50), purchase_date (Date, Indexed)", styles["TableCell"])],
        
        [Paragraph("<code>purchase_items</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("purchase_id -> purchases.id (Cascade)<br/>product_id -> products.id (Cascade)", styles["TableCell"]), 
         Paragraph("purchase_id (Int, Indexed), product_id (Int, Indexed), quantity (Int), cost_price (Numeric 10,2), total_cost (Numeric 10,2)", styles["TableCell"])],
        
        [Paragraph("<code>expenses</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), 
         Paragraph("category (Varchar 100, Indexed), amount (Numeric 10,2), payment_mode (Varchar 50), expense_date (Date, Indexed), description (Text)", styles["TableCell"])],
        
        [Paragraph("<code>return_orders</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("invoice_id -> invoices.id<br/>customer_id -> customers.id", styles["TableCell"]), 
         Paragraph("return_number (Varchar 50, Unique), invoice_id (Int, Indexed), refund_amount (Numeric 10,2), refund_mode (Varchar 50), return_date (Timestamp)", styles["TableCell"])],
        
        [Paragraph("<code>return_items</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("return_order_id -> return_orders.id (Cascade)<br/>product_id -> products.id (Cascade)", styles["TableCell"]), 
         Paragraph("return_order_id (Int, Indexed), product_id (Int, Indexed), quantity (Int), condition (Enum: restock/damaged), refund_amount (Numeric 10,2)", styles["TableCell"])],
        
        [Paragraph("<code>lost_demands</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), 
         Paragraph("item_name (Varchar 150), category (Varchar 100), customer_phone (Varchar 20), request_count (Int), recorded_at (Timestamp)", styles["TableCell"])],
        
        [Paragraph("<code>store_settings</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("None", styles["TableCell"]), 
         Paragraph("shop_name (Varchar 150), address (Text), gstin (Varchar 30), upi_id (Varchar 100), receipt_footer (Text), sound_enabled (Bool), master_pin (Varchar 10)", styles["TableCell"])],
        
        [Paragraph("<code>audit_logs</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("user_id -> users.id", styles["TableCell"]), 
         Paragraph("user_id (Int, Indexed), action (Varchar 100), entity (Varchar 100), entity_id (Int), details (JSONB/Text), created_at (Timestamp)", styles["TableCell"])],
        
        [Paragraph("<code>whatsapp_logs</code>", styles["TableCellBold"]), Paragraph("id (Int)", styles["TableCell"]), Paragraph("customer_id -> customers.id", styles["TableCell"]), 
         Paragraph("customer_id (Int), campaign_type (Varchar 100), recipient_phone (Varchar 20), message_body (Text), status (Varchar 50), sent_at (Timestamp)", styles["TableCell"])]
    ]

    t_schemas = Table(schema_tables_data, colWidths=[80, 50, 110, 264])
    t_schemas.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#F8FAFC"), colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(t_schemas)
    story.append(Spacer(1, 8))
    story.append(PageBreak())

    # =========================================================================
    # SECTION 6: IMPORTANT CODING RULES & ARCHITECTURAL STANDARDS
    # =========================================================================
    story.append(Paragraph("6. Core Coding Rules & Architectural Standards", styles["DocH1"]))
    story.append(Paragraph(
        "The following 8 engineering rules were strictly enforced across the codebase to ensure rock-solid stability, high speed, and financial accuracy:",
        styles["DocBody"]
    ))

    rules = [
        ("Rule 1: Strict Separation of Concerns", 
         "FastAPI routers only handle request parsing, parameter validation, and response serialization. All complex financial logic, aggregations, and hardware byte streams reside in dedicated service layers (<code>services/</code>) and reusable SQLAlchemy repositories."),
        
        ("Rule 2: Zero Floating-Point Currency Drift", 
         "All monetary fields (purchase_price, selling_price, subtotal, discount, tax, final_total, current_balance) are strictly stored as PostgreSQL <code>Numeric(10,2)</code> and computed in Python using fixed 2-decimal rounded arithmetic to eliminate IEEE-754 floating-point inaccuracies."),
        
        ("Rule 3: Immutable Financial Invoices & Audited Operations", 
         "Billed invoices are immutable once settled. Cancellations and product returns generate explicit compensating entries (ReturnOrder, ReturnItem, CustomerLedger) with audit logs, ensuring strict non-repudiation and compliance with Indian GST accounting standards."),
        
        ("Rule 4: Role-Based Margin Masking on the API Level", 
         "Cashier staff accounts (<code>role='staff'</code>) are strictly blocked from viewing purchase cost prices, supplier margins, and store-level P&L metrics. The API filters out sensitive margin fields before returning responses to non-admin tokens."),
        
        ("Rule 5: Sub-10ms Benchmark & B-Tree Indexing on All Foreign Keys", 
         "Every foreign key column, barcode string, customer phone number, and transaction date is indexed with B-Tree indexes. N+1 queries are strictly banned; all multi-entity queries use joined loads or composite SQL aggregations."),
        
        ("Rule 6: Deterministic Topological Database Restoration", 
         "The database restore engine processes tables in deterministic topological order (e.g. Users ➔ Categories ➔ Subcategories ➔ Products ➔ Customers ➔ Invoices ➔ InvoiceItems) and applies <code>ON DELETE CASCADE</code> to prevent foreign key constraint violations."),
        
        ("Rule 7: Silent Windows GUI Execution with SafeNullStream", 
         "In standalone Windows GUI mode (<code>--noconsole</code>), standard output streams (<code>sys.stdout</code> and <code>sys.stderr</code>) are <code>None</code>. A custom <code>SafeNullStream</code> wrapper prevents <code>isatty</code> exceptions during Uvicorn logger initialization."),
        
        ("Rule 8: Hardware Resiliency & Offline-First Thermal Printing", 
         "Barcode label generation generates direct binary TSPL byte streams (for TSC thermal printers) and ESC/POS byte streams (for 80mm receipt printers) directly to the Windows printer spooler, bypassing slow browser print dialogues.")
    ]

    for r_title, r_desc in rules:
        story.append(Paragraph(f"• <b>{r_title}</b>", styles["DocH2"]))
        story.append(Paragraph(r_desc, styles["DocBody"]))

    # =========================================================================
    # SECTION 7: HISTORICAL BUG LOG & PERMANENT RESOLUTIONS
    # =========================================================================
    story.append(Paragraph("7. Historical Bug Log & Permanent Engineering Fixes", styles["DocH1"]))
    bugs = [
        ("Database Restore Foreign Key Violation (purchases / purchase_items)", "backend/app/api/backup_router.py", 
         "Deleting products during database restore violated foreign keys on purchase_items and return_items.", 
         "Added ON DELETE CASCADE to purchase_items and return_items foreign keys, and wrapped restore in sequential topological deletion."),
        
        ("Dashboard Net Profit Today showing negative value", "backend/app/services/analytics_service.py", 
         "Expenses query in get_dashboard_summary was not bounded to today, subtracting entire lifetime expenses.", 
         "Strictly bounded Expense.expense_date between today_start (00:00:00) and today_end (23:59:59)."),
        
        ("5-Year Timeline Chart Clutter (1,825 daily jagged spikes)", "frontend/src/pages/DashboardPage.tsx", 
         "Plotting daily points over 5 years created dense vertical line spikes.", 
         "Implemented Smart Monthly Grouping (61 months) in backend and Monotone Cubic Bézier Spline paths in frontend SVG."),
        
        ("Damaged Stock Product Search dropdown staying open", "frontend/src/pages/DefectiveStockPage.tsx", 
         "Dropdown had no onBlur / click-outside handler.", 
         "Added active input focus tracking and click-outside dismissal refs."),
        
        ("Footer Settings Desynchronization between Settings and Printout", "frontend/src/pages/SettingsPage.tsx", 
         "Settings saved into browser localStorage while receipt generation read from database.", 
         "Migrated all footer styling (font size, bold, terms) to database table store_settings with live sync.")
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
