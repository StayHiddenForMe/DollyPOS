import os
import socket
import time
import random
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, text, desc, or_

from app.core.database import get_db
from app.api.auth_router import get_current_user
from app.models.user import User, UserRole
from app.models.invoice import Invoice, InvoiceItem, Payment, PaymentMode
from app.models.product import Product
from app.models.customer import Customer
from app.models.expense import Expense, ExpenseCategory
from app.models.category import Category, Subcategory
from app.models.settings import StoreSettings
from app.models.return_order import ReturnOrder, ReturnItem
from app.models.lost_demand import LostDemand
from app.services.backup_service import backup_service
from app.core.audit import log_action

router = APIRouter(prefix="/mobile", tags=["Mobile App API (Optimized & Read-Only)"])

# -------------------------------------------------------------
# Timezone Conversion Helpers (India Standard Time = UTC + 05:30)
# -------------------------------------------------------------
IST_OFFSET = timedelta(hours=5, minutes=30)

def get_ist_now() -> datetime:
    """Returns the current datetime in India Standard Time."""
    return datetime.utcnow() + IST_OFFSET

def get_utc_range_for_ist(start_date_str: str, end_date_str: str) -> tuple[datetime, datetime]:
    """
    Converts start and end dates (YYYY-MM-DD in IST) to exact UTC timestamps
    for database querying against UTC timestamped columns.
    """
    s_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    e_date = datetime.combine(datetime.strptime(end_date_str, "%Y-%m-%d").date(), datetime.max.time())
    start_utc = s_date - IST_OFFSET
    end_utc = e_date - IST_OFFSET
    return start_utc, end_utc

# -------------------------------------------------------------
# High-Performance In-Memory Cache
# -------------------------------------------------------------
_CACHE: Dict[str, Dict[str, Any]] = {}

def get_from_cache(key: str, ttl_seconds: int = 10) -> Optional[Any]:
    entry = _CACHE.get(key)
    if entry and (time.time() - entry["timestamp"] < ttl_seconds):
        return entry["data"]
    return None

def set_in_cache(key: str, data: Any):
    _CACHE[key] = {"data": data, "timestamp": time.time()}

def clear_cache_prefix(prefix: str):
    keys_to_del = [k for k in _CACHE if k.startswith(prefix)]
    for k in keys_to_del:
        del _CACHE[k]

def get_laptop_local_ip() -> str:
    """Detects local LAN / Wi-Fi IP address of the laptop for phone connection."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.1)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


# -------------------------------------------------------------
# 1. Network & Pairing Info (Dynamic Store Name on Every Request)
# -------------------------------------------------------------
@router.get("/network-info")
def get_mobile_network_info(db: Session = Depends(get_db)):
    """Returns local LAN IP, port, live shop name, and status for 1-tap mobile pairing."""
    db.expire_all()
    st = db.query(StoreSettings).first()
    local_ip = get_laptop_local_ip()
    port = 8000
    ist_now = get_ist_now()

    return {
        "shop_name": st.shop_name if st and st.shop_name else "Dolly Toys & Kids Wear",
        "tagline": st.tag_line if st and st.tag_line else "Exclusive Kids Wear & Quality Toys",
        "local_ip": local_ip,
        "port": port,
        "api_base_url": f"http://{local_ip}:{port}/api/v1",
        "server_time": ist_now.strftime("%Y-%m-%d %I:%M:%S %p"),
        "status": "ONLINE",
        "pairing_code": f"DLY-{local_ip.replace('.', '')}-{port}",
        "store_token": getattr(st, "store_token", None) if st else None,
        "cloud_hub_url": getattr(st, "cloud_hub_url", "https://dollypos-hub.onrender.com") if st else "https://dollypos-hub.onrender.com"
    }


# -------------------------------------------------------------
# 2. Live Business Pulse Dashboard (Range-Aware with Profit & Money)
# -------------------------------------------------------------
@router.get("/overview")
def get_mobile_dashboard_overview(
    period: str = Query("TODAY", description="TODAY, YESTERDAY, WEEK, MONTH, YEAR, CUSTOM"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD for CUSTOM"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD for CUSTOM"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns high-level sales, gross/net profits, expenses, payment breakdowns,
    hourly velocity, top products, and low stock alerts for any selected range.
    All times computed in IST.
    """
    ist_now = get_ist_now()
    today_ist = ist_now.date()

    # Determine date range strings (in IST)
    p_upper = period.upper()
    if p_upper == "YESTERDAY":
        y_date = today_ist - timedelta(days=1)
        s_str = y_date.strftime("%Y-%m-%d")
        e_str = s_str
        date_label = f"Yesterday • {y_date.strftime('%d %b %Y')}"
    elif p_upper == "WEEK":
        w_start = today_ist - timedelta(days=7)
        s_str = w_start.strftime("%Y-%m-%d")
        e_str = today_ist.strftime("%Y-%m-%d")
        date_label = f"Last 7 Days ({w_start.strftime('%d %b')} – {today_ist.strftime('%d %b %Y')})"
    elif p_upper == "MONTH":
        m_start = date(today_ist.year, today_ist.month, 1)
        s_str = m_start.strftime("%Y-%m-%d")
        e_str = today_ist.strftime("%Y-%m-%d")
        date_label = f"This Month ({today_ist.strftime('%B %Y')})"
    elif p_upper == "YEAR":
        yr_start = date(today_ist.year, 1, 1)
        s_str = yr_start.strftime("%Y-%m-%d")
        e_str = today_ist.strftime("%Y-%m-%d")
        date_label = f"This Year ({today_ist.year})"
    elif p_upper == "CUSTOM" and start_date and end_date:
        s_str = start_date
        e_str = end_date
        date_label = f"{start_date} to {end_date}"
    else:
        # Default TODAY
        s_str = today_ist.strftime("%Y-%m-%d")
        e_str = s_str
        date_label = f"Today - {today_ist.strftime('%d %b %Y')}"

    db.expire_all()
    st = db.query(StoreSettings).first()
    live_shop_name = st.shop_name if st and st.shop_name else "Dolly Toys & Kids Wear"

    cache_key = f"mobile_overview_{current_user.id}_{p_upper}_{s_str}_{e_str}"
    cached = get_from_cache(cache_key, ttl_seconds=10)
    if cached:
        cached["shop_name"] = live_shop_name
        return cached

    # Convert IST date boundaries to UTC for database querying
    s_utc, e_utc = get_utc_range_for_ist(s_str, e_str)

    # 1. Invoices Query
    invoices = db.query(Invoice).filter(
        Invoice.created_at >= s_utc,
        Invoice.created_at <= e_utc,
        Invoice.is_cancelled == False
    ).all()

    bill_count = len(invoices)
    gross_sales = float(sum(inv.subtotal or inv.grand_total for inv in invoices))
    net_sales = float(sum(inv.grand_total for inv in invoices))
    total_tax = float(sum(inv.tax_amount or 0.0 for inv in invoices))
    total_discount = float(sum(inv.discount_amount or 0.0 for inv in invoices))
    avg_bill = round(net_sales / bill_count, 2) if bill_count > 0 else 0.0

    # 2. Cost of Goods Sold (COGS) & Profit Calculations
    invoice_ids = [inv.id for inv in invoices]
    total_cogs = 0.0
    if invoice_ids:
        cogs_query = (
            db.query(func.coalesce(func.sum(InvoiceItem.quantity * InvoiceItem.cost_price), 0.0))
            .filter(InvoiceItem.invoice_id.in_(invoice_ids))
            .scalar()
        )
        total_cogs = float(cogs_query or 0.0)

    gross_profit = round(net_sales - total_cogs, 2)
    margin_percent = round((gross_profit / net_sales * 100), 1) if net_sales > 0 else 0.0

    # 3. Expenses in Period
    period_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
        Expense.expense_date >= s_utc,
        Expense.expense_date <= e_utc
    ).scalar()
    period_expenses_val = round(float(period_expenses or 0.0), 2)

    net_profit = round(gross_profit - period_expenses_val, 2)

    # 4. Payment Modes Breakdown (Inclusive of multi-tender split and direct invoice payments)
    payment_modes = {"CASH": 0.0, "UPI": 0.0, "CARD": 0.0, "CREDIT": 0.0}
    invoices_with_payments = set()
    if invoice_ids:
        payments = db.query(Payment).filter(
            Payment.invoice_id.in_(invoice_ids)
        ).all()
        for p in payments:
            invoices_with_payments.add(p.invoice_id)
            mode_str = str(p.payment_mode.value if hasattr(p.payment_mode, "value") else p.payment_mode).upper()
            if "CASH" in mode_str:
                payment_modes["CASH"] += float(p.amount)
            elif "UPI" in mode_str or "ONLINE" in mode_str:
                payment_modes["UPI"] += float(p.amount)
            elif "CARD" in mode_str:
                payment_modes["CARD"] += float(p.amount)
            elif "CREDIT" in mode_str or "KHATA" in mode_str:
                payment_modes["CREDIT"] += float(p.amount)
            else:
                payment_modes["CASH"] += float(p.amount)

        # Catch-up for invoices that do not have separate rows in payments table
        for inv in invoices:
            if inv.id not in invoices_with_payments:
                mode_str = str(inv.payment_mode.value if hasattr(inv.payment_mode, "value") else inv.payment_mode).upper()
                amt = float(inv.paid_amount or inv.grand_total or 0.0)
                if "CASH" in mode_str:
                    payment_modes["CASH"] += amt
                elif "UPI" in mode_str or "ONLINE" in mode_str:
                    payment_modes["UPI"] += amt
                elif "CARD" in mode_str:
                    payment_modes["CARD"] += amt
                elif "CREDIT" in mode_str or "KHATA" in mode_str:
                    payment_modes["CREDIT"] += amt
                else:
                    payment_modes["CASH"] += amt

    for k in payment_modes:
        payment_modes[k] = round(payment_modes[k], 2)

    # 5. Hourly Sales Velocity (IST local hour conversion)
    hourly_map: Dict[int, Dict[str, Any]] = {}
    for h in range(9, 23):
        label = datetime.strptime(str(h), "%H").strftime("%I %p")
        hourly_map[h] = {"hour": label, "amount": 0.0, "bills": 0}

    for inv in invoices:
        # Convert UTC invoice timestamp to IST local hour
        ist_dt = inv.created_at + IST_OFFSET
        h = ist_dt.hour
        if h in hourly_map:
            hourly_map[h]["amount"] = round(hourly_map[h]["amount"] + float(inv.grand_total), 2)
            hourly_map[h]["bills"] += 1

    hourly_velocity = list(hourly_map.values())

    # 6. Top Selling Products
    top_items = []
    if invoice_ids:
        top_query = (
            db.query(
                InvoiceItem.item_name,
                func.sum(InvoiceItem.quantity).label("total_qty"),
                func.sum(InvoiceItem.total_price).label("total_rev")
            )
            .filter(InvoiceItem.invoice_id.in_(invoice_ids))
            .group_by(InvoiceItem.item_name)
            .order_by(desc("total_qty"))
            .limit(5)
            .all()
        )
        for name, qty, rev in top_query:
            top_items.append({
                "product_name": name,
                "quantity": int(qty or 0),
                "revenue": round(float(rev or 0.0), 2)
            })

    # 7. Low Stock Alerts
    low_stock_query = (
        db.query(Product.id, Product.name, Product.stock_quantity, Product.min_stock_alert, Product.barcode)
        .filter(Product.is_active == True, Product.stock_quantity <= Product.min_stock_alert)
        .order_by(Product.stock_quantity.asc())
        .limit(10)
        .all()
    )
    low_stock_items = [
        {
            "id": p.id,
            "name": p.name,
            "stock": p.stock_quantity,
            "min_stock": p.min_stock_alert,
            "barcode": p.barcode or "—"
        }
        for p in low_stock_query
    ]

    total_low_stock_count = db.query(Product).filter(
        Product.is_active == True,
        Product.stock_quantity <= Product.min_stock_alert
    ).count()

    # 8. Customer Khata Outstanding Total
    khata_outstanding = db.query(func.coalesce(func.sum(Customer.credit_balance), 0.0)).filter(
        Customer.credit_balance > 0
    ).scalar()

    # Live shop name from store settings (never stale)
    st = db.query(StoreSettings).first()
    live_shop_name = st.shop_name if st and st.shop_name else "Dolly Toys & Kids Wear"

    data = {
        "shop_name": live_shop_name,
        "period": p_upper,
        "date_str": date_label,
        "start_date": s_str,
        "end_date": e_str,
        "last_updated": ist_now.strftime("%I:%M:%S %p"),
        "sales": {
            "gross_sales": round(gross_sales, 2),
            "net_sales": round(net_sales, 2),
            "total_cogs": round(total_cogs, 2),
            "gross_profit": gross_profit,
            "net_profit": net_profit,
            "margin_percent": margin_percent,
            "total_tax": round(total_tax, 2),
            "total_discount": round(total_discount, 2),
            "bill_count": bill_count,
            "average_bill": avg_bill
        },
        "period_expenses": period_expenses_val,
        "payment_breakdown": payment_modes,
        "hourly_velocity": hourly_velocity,
        "top_products": top_items,
        "low_stock_count": total_low_stock_count,
        "low_stock_items": low_stock_items,
        "khata_outstanding": round(float(khata_outstanding or 0.0), 2)
    }

    set_in_cache(cache_key, data)
    return data


# -------------------------------------------------------------
# 3. High-Speed Inventory Lookup (Engineered for 10,000+ Items)
# -------------------------------------------------------------
@router.get("/inventory")
def get_mobile_inventory_lookup(
    search: Optional[str] = Query(None, description="Search product name or barcode"),
    category_id: Optional[int] = Query(None),
    low_stock_only: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sub-millisecond query engineered for large catalogs (10,000+ items).
    Fetches only lightweight columns with index-friendly search and pagination.
    """
    # 1. In-memory category lookup map (0 joins)
    cat_cache_key = "cat_map"
    cat_map = get_from_cache(cat_cache_key, ttl_seconds=60)
    if not cat_map:
        cats = db.query(Category.id, Category.name).all()
        cat_map = {c.id: c.name for c in cats}
        set_in_cache(cat_cache_key, cat_map)

    # 2. Select only lightweight columns needed by mobile
    query = db.query(
        Product.id,
        Product.name,
        Product.barcode,
        Product.category_id,
        Product.stock_quantity,
        Product.selling_price,
        Product.mrp,
        Product.purchase_price,
        Product.min_stock_alert
    ).filter(Product.is_active == True)

    if search and search.strip():
        term = search.strip()
        # If barcode / numeric code: use fast prefix search
        if term.isdigit() and len(term) >= 3:
            query = query.filter(Product.barcode.like(f"{term}%"))
        else:
            query = query.filter(
                or_(
                    Product.name.ilike(f"%{term}%"),
                    Product.barcode.ilike(f"%{term}%")
                )
            )

    if category_id:
        query = query.filter(Product.category_id == category_id)

    if low_stock_only:
        query = query.filter(Product.stock_quantity <= Product.min_stock_alert)

    total_count = query.count()
    offset = (page - 1) * limit
    products_raw = query.order_by(Product.name.asc()).offset(offset).limit(limit).all()

    items = []
    for p in products_raw:
        cat_name = cat_map.get(p.category_id, "General")
        is_low = (p.stock_quantity or 0) <= (p.min_stock_alert or 3)
        items.append({
            "id": p.id,
            "name": p.name,
            "barcode": p.barcode or "—",
            "category": cat_name,
            "category_id": p.category_id,
            "current_stock": p.stock_quantity or 0,
            "selling_price": round(float(p.selling_price or 0.0), 2),
            "mrp": round(float(p.mrp or p.selling_price or 0.0), 2),
            "purchase_price": round(float(p.purchase_price or 0.0), 2),
            "min_stock": p.min_stock_alert or 3,
            "is_low_stock": is_low
        })

    return {
        "page": page,
        "limit": limit,
        "total_count": total_count,
        "has_more": (offset + len(items)) < total_count,
        "products": items
    }


# -------------------------------------------------------------
# 4. Add Product from Mobile App Directly
# -------------------------------------------------------------
class MobileAddProductRequest(BaseModel):
    name: str
    barcode: Optional[str] = None
    category_id: Optional[int] = None
    purchase_price: float = 0.0
    selling_price: float = 0.0
    mrp: Optional[float] = None
    stock_quantity: int = 1
    min_stock_alert: int = 3

@router.post("/inventory")
def add_product_from_mobile(
    req: MobileAddProductRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Adds a new product directly from the mobile app into the Dolly POS database."""
    name_clean = req.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Product name is required")

    # Generate barcode if empty
    barcode = (req.barcode or "").strip()
    if not barcode:
        # Unique 13-digit EAN style barcode
        barcode = f"890{int(time.time()) % 100000000:08d}{random.randint(10, 99)}"

    # Check barcode uniqueness
    existing = db.query(Product).filter(Product.barcode == barcode).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A product with barcode '{barcode}' already exists: {existing.name}")

    mrp_val = float(req.mrp) if req.mrp and req.mrp > 0 else float(req.selling_price)

    new_prod = Product(
        name=name_clean,
        barcode=barcode,
        category_id=req.category_id,
        purchase_price=float(req.purchase_price),
        selling_price=float(req.selling_price),
        mrp=mrp_val,
        stock_quantity=int(req.stock_quantity),
        min_stock_alert=int(req.min_stock_alert),
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)

    # Invalidate cached lists
    clear_cache_prefix("mobile_overview")
    clear_cache_prefix("cat_map")

    log_action(
        db=db,
        user_id=current_user.id,
        action_type="CREATE",
        entity="PRODUCT",
        entity_id=str(new_prod.id),
        details={"name": new_prod.name, "barcode": barcode, "source": "mobile"}
    )

    return {
        "success": True,
        "message": f"Product '{new_prod.name}' added successfully!",
        "product": {
            "id": new_prod.id,
            "name": new_prod.name,
            "barcode": new_prod.barcode,
            "selling_price": new_prod.selling_price,
            "stock_quantity": new_prod.stock_quantity
        }
    }


# -------------------------------------------------------------
# 5. Categories List (For Mobile "+ Add Product" Dropdown)
# -------------------------------------------------------------
@router.get("/categories")
def get_mobile_categories(db: Session = Depends(get_db)):
    """Returns category list for mobile app product creation."""
    cats = db.query(Category).order_by(Category.name.asc()).all()
    return [{"id": c.id, "name": c.name} for c in cats]


# -------------------------------------------------------------
# 6. Full Mobile Reports Studio (Custom Date Range + 6 Report Types)
# -------------------------------------------------------------
@router.get("/reports")
def get_mobile_reports(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD (IST)"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD (IST)"),
    report_type: str = Query("SALES", description="SALES, PAYMENTS, CATEGORIES, EXPENSES, DAMAGED, PLANNER"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Comprehensive multi-format report generator:
    1. SALES: Detailed Bill Register with Payment Mode & Customer
    2. PAYMENTS: Cash / UPI / Card / Khata Collection breakdown
    3. CATEGORIES: Category revenue distribution
    4. EXPENSES: Full expenses register
    5. DAMAGED: Damaged goods loss valuation
    6. PLANNER: Reorder & demand stock planner
    """
    try:
        s_utc, e_utc = get_utc_range_for_ist(start_date, end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    st = db.query(StoreSettings).first()
    store_title = st.shop_name if st and st.shop_name else "Dolly Toys & Kids Wear"
    rep_upper = report_type.upper()

    # ------------------ 1. SALES REGISTER ------------------
    if rep_upper == "SALES":
        invoices = (
            db.query(Invoice)
            .filter(Invoice.created_at >= s_utc, Invoice.created_at <= e_utc, Invoice.is_cancelled == False)
            .order_by(Invoice.created_at.desc())
            .all()
        )

        rows = []
        total_gross = 0.0
        total_net = 0.0
        total_discount = 0.0
        total_tax = 0.0
        unique_dates = set()

        for inv in invoices:
            ist_dt = inv.created_at + IST_OFFSET
            g = float(inv.subtotal or inv.grand_total)
            n = float(inv.grand_total)
            d = float(inv.discount_amount or 0.0)
            t = float(inv.tax_amount or 0.0)
            unique_dates.add(ist_dt.strftime("%Y-%m-%d"))

            total_gross += g
            total_net += n
            total_discount += d
            total_tax += t

            # Only append first 150 rows for mobile preview to avoid native Android OutOfMemory crash
            if len(rows) < 150:
                mode_str = str(inv.payment_mode.value if hasattr(inv.payment_mode, "value") else inv.payment_mode).upper()
                rows.append({
                    "date": ist_dt.strftime("%d %b %Y"),
                    "time": ist_dt.strftime("%I:%M %p"),
                    "bill_number": inv.bill_number or f"#{inv.id}",
                    "customer": inv.customer_name or "Walk-in Customer",
                    "payment_mode": mode_str,
                    "gross_amount": round(g, 2),
                    "discount": round(d, 2),
                    "tax": round(t, 2),
                    "net_amount": round(n, 2)
                })

        return {
            "report_type": "SALES",
            "title": f"Sales Register ({start_date} to {end_date})",
            "store_name": store_title,
            "start_date": start_date,
            "end_date": end_date,
            "summary": {
                "total_bills": len(invoices),
                "total_gross": round(total_gross, 2),
                "total_discount": round(total_discount, 2),
                "total_tax": round(total_tax, 2),
                "total_net": round(total_net, 2),
                "avg_daily_sales": round(total_net / max(len(unique_dates), 1), 2)
            },
            "columns": ["Date", "Bill #", "Customer", "Payment Mode", "Gross (₹)", "Discount", "Tax", "Net Amount (₹)"],
            "rows": rows,
            "total_rows": len(invoices),
            "is_truncated": len(invoices) > 150
        }

    # ------------------ 2. PAYMENTS BREAKDOWN ------------------
    elif rep_upper == "PAYMENTS":
        payments = db.query(Payment).filter(Payment.created_at >= s_utc, Payment.created_at <= e_utc).all()
        invoices = db.query(Invoice).filter(Invoice.created_at >= s_utc, Invoice.created_at <= e_utc, Invoice.is_cancelled == False).all()

        mode_stats = {
            "CASH": {"mode": "Cash Counter", "bills": 0, "amount": 0.0},
            "UPI": {"mode": "UPI / QR / Online", "bills": 0, "amount": 0.0},
            "CARD": {"mode": "Card / EDC POS", "bills": 0, "amount": 0.0},
            "CREDIT": {"mode": "Khata Udhar Dues", "bills": 0, "amount": 0.0},
        }

        invoices_with_payments = set()
        total_collected = 0.0
        for p in payments:
            invoices_with_payments.add(p.invoice_id)
            m = str(p.payment_mode.value if hasattr(p.payment_mode, "value") else p.payment_mode).upper()
            amt = float(p.amount)
            total_collected += amt
            if "CASH" in m:
                mode_stats["CASH"]["bills"] += 1
                mode_stats["CASH"]["amount"] += amt
            elif "UPI" in m or "ONLINE" in m:
                mode_stats["UPI"]["bills"] += 1
                mode_stats["UPI"]["amount"] += amt
            elif "CARD" in m:
                mode_stats["CARD"]["bills"] += 1
                mode_stats["CARD"]["amount"] += amt
            else:
                mode_stats["CREDIT"]["bills"] += 1
                mode_stats["CREDIT"]["amount"] += amt

        # Add invoices that do not have rows in payments (e.g. CREDIT_KHATA)
        for inv in invoices:
            if inv.id not in invoices_with_payments:
                m = str(inv.payment_mode.value if hasattr(inv.payment_mode, "value") else inv.payment_mode).upper()
                amt = float(inv.grand_total)
                total_collected += amt
                if "CASH" in m:
                    mode_stats["CASH"]["bills"] += 1
                    mode_stats["CASH"]["amount"] += amt
                elif "UPI" in m or "ONLINE" in m:
                    mode_stats["UPI"]["bills"] += 1
                    mode_stats["UPI"]["amount"] += amt
                elif "CARD" in m:
                    mode_stats["CARD"]["bills"] += 1
                    mode_stats["CARD"]["amount"] += amt
                else:
                    mode_stats["CREDIT"]["bills"] += 1
                    mode_stats["CREDIT"]["amount"] += amt

        rows = []
        for k, v in mode_stats.items():
            pct = round((v["amount"] / total_collected * 100), 1) if total_collected > 0 else 0.0
            rows.append({
                "mode": v["mode"],
                "bills": v["bills"],
                "amount": round(v["amount"], 2),
                "share_pct": pct
            })

        total_tx = len(payments) + len([inv for inv in invoices if inv.id not in invoices_with_payments])

        return {
            "report_type": "PAYMENTS",
            "title": f"Payment Mode Collections ({start_date} to {end_date})",
            "store_name": store_title,
            "start_date": start_date,
            "end_date": end_date,
            "summary": {
                "total_collected": round(total_collected, 2),
                "total_transactions": total_tx
            },
            "columns": ["Payment Channel", "Bills", "Amount Collected (₹)", "Share (%)"],
            "rows": rows
        }

    # ------------------ 3. CATEGORIES ------------------
    elif rep_upper == "CATEGORIES":
        inv_items = (
            db.query(
                Category.name.label("category_name"),
                func.sum(InvoiceItem.quantity).label("total_qty"),
                func.sum(InvoiceItem.total_price).label("total_rev")
            )
            .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
            .outerjoin(Product, Product.id == InvoiceItem.product_id)
            .outerjoin(Category, Category.id == Product.category_id)
            .filter(Invoice.created_at >= s_utc, Invoice.created_at <= e_utc, Invoice.is_cancelled == False)
            .group_by(Category.name)
            .order_by(desc("total_rev"))
            .all()
        )

        rows = []
        grand_total = sum(float(r[2] or 0.0) for r in inv_items)
        for cat_name, qty, rev in inv_items:
            rev_val = round(float(rev or 0.0), 2)
            share_pct = round((rev_val / grand_total * 100), 1) if grand_total > 0 else 0.0
            rows.append({
                "category": cat_name or "General / Uncategorized",
                "units_sold": int(qty or 0),
                "revenue": rev_val,
                "share_pct": share_pct
            })

        return {
            "report_type": "CATEGORIES",
            "title": f"Category Performance ({start_date} to {end_date})",
            "store_name": store_title,
            "start_date": start_date,
            "end_date": end_date,
            "summary": {
                "total_categories": len(rows),
                "total_revenue": round(grand_total, 2)
            },
            "columns": ["Category", "Units Sold", "Revenue (₹)", "Share (%)"],
            "rows": rows
        }

    # ------------------ 4. EXPENSES ------------------
    elif rep_upper == "EXPENSES":
        expenses = db.query(Expense).filter(
            Expense.expense_date >= s_utc,
            Expense.expense_date <= e_utc
        ).order_by(Expense.expense_date.desc()).all()

        total_exp = 0.0
        rows = []
        for exp in expenses:
            amt = float(exp.amount or 0.0)
            total_exp += amt
            cat_name = (
                exp.category.value if hasattr(exp.category, "value")
                else (exp.category.name if hasattr(exp.category, "name") else str(exp.category))
            ) if exp.category else "General"
            desc_text = exp.title or exp.notes or "—"
            ist_exp_dt = (exp.expense_date + IST_OFFSET) if exp.expense_date else None
            date_str = ist_exp_dt.strftime("%d %b %Y") if ist_exp_dt else "—"

            rows.append({
                "date": date_str,
                "category": cat_name,
                "description": desc_text,
                "payment_mode": exp.payment_mode or "CASH",
                "amount": round(amt, 2)
            })

        return {
            "report_type": "EXPENSES",
            "title": f"Expenses Register ({start_date} to {end_date})",
            "store_name": store_title,
            "start_date": start_date,
            "end_date": end_date,
            "summary": {
                "total_entries": len(rows),
                "total_expense": round(total_exp, 2)
            },
            "columns": ["Date", "Category", "Description", "Mode", "Amount (₹)"],
            "rows": rows
        }

    # ------------------ 5. DAMAGED GOODS ------------------
    elif rep_upper == "DAMAGED":
        damaged_prods = db.query(Product).filter(
            Product.damaged_quantity > 0,
            Product.is_active == True
        ).all()

        rows = []
        total_dmg_units = 0
        total_cost_loss = 0.0

        for p in damaged_prods:
            qty = p.damaged_quantity
            c_loss = round(float(p.purchase_price or 0.0) * qty, 2)
            total_dmg_units += qty
            total_cost_loss += c_loss

            rows.append({
                "product_name": p.name,
                "barcode": p.barcode or "—",
                "damaged_units": qty,
                "cost_price": round(float(p.purchase_price or 0.0), 2),
            })

        return {
            "report_type": "DAMAGED",
            "title": "Damaged Goods Register",
            "store_name": store_title,
            "start_date": start_date,
            "end_date": end_date,
            "summary": {
                "damaged_products_count": len(rows),
                "total_damaged_units": total_dmg_units,
                "total_cost_loss": round(total_cost_loss, 2)
            },
            "columns": ["Product Name", "Barcode", "Damaged Qty", "Cost Price (₹)"],
            "rows": rows
        }

    # ------------------ 6. REORDER & DEMAND PLANNER ------------------
    elif rep_upper == "PLANNER":
        low_items = db.query(Product).filter(
            Product.is_active == True,
            Product.stock_quantity <= Product.min_stock_alert
        ).order_by(Product.stock_quantity.asc()).limit(100).all()

        rows = []
        total_suggested_reorder = 0

        for p in low_items:
            cur = p.stock_quantity
            min_s = p.min_stock_alert
            suggested = max((min_s * 3) - cur, min_s)
            total_suggested_reorder += suggested

            rows.append({
                "product_name": p.name,
                "current_stock": cur,
                "suggested_order": suggested,
            })

        return {
            "report_type": "PLANNER",
            "title": "Smart Stock Replenishment Planner",
            "store_name": store_title,
            "start_date": start_date,
            "end_date": end_date,
            "summary": {
                "critical_items_count": len(rows),
                "total_suggested_units": total_suggested_reorder
            },
            "columns": ["Product Name", "Stock Left", "Suggested Order"],
            "rows": rows
        }

    else:
        # Default to Sales
        return get_mobile_reports(start_date, end_date, "SALES", current_user, db)


# -------------------------------------------------------------
# 7. Customer Khata & Balances (Udhar Ledger)
# -------------------------------------------------------------
@router.get("/customers/khata")
def get_mobile_customers_khata(
    search: Optional[str] = Query(None, description="Search by name or phone"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns list of customers with pending credit/khata balance.
    Includes pre-formatted WhatsApp payment reminder messages.
    """
    st = db.query(StoreSettings).first()
    shop_title = st.shop_name if st and st.shop_name else "Dolly Toys & Kids Wear"
    upi_id = st.upi_id if st else ""

    query = db.query(Customer).filter(Customer.credit_balance > 0)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter((Customer.name.ilike(term)) | (Customer.phone.ilike(term)))

    customers = query.order_by(Customer.credit_balance.desc()).limit(100).all()
    total_outstanding = sum(float(c.credit_balance) for c in customers)

    rows = []
    for c in customers:
        clean_phone = "".join(filter(str.isdigit, c.phone or ""))
        if clean_phone.startswith("91") and len(clean_phone) > 10:
            clean_phone = clean_phone[2:]

        bal = round(float(c.credit_balance), 2)
        wa_text = (
            f"Dear {c.name},\n"
            f"Greetings from *{shop_title}*!\n\n"
            f"This is a gentle reminder that your pending balance is *₹{bal:,.2f}*.\n"
            f"{f'You can pay via UPI to: *{upi_id}*' if upi_id else ''}\n\n"
            f"Thank you for your valued patronage! 🙏"
        )
        wa_url = f"https://wa.me/91{clean_phone}?text={wa_text}" if clean_phone else None

        rows.append({
            "id": c.id,
            "name": c.name,
            "phone": c.phone or "—",
            "clean_phone": clean_phone,
            "balance": bal,
            "whatsapp_url": wa_url
        })

    return {
        "total_customers": len(rows),
        "total_outstanding": round(total_outstanding, 2),
        "customers": rows
    }


# -------------------------------------------------------------
# 8. 1-Click Database Backup Download for Mobile
# -------------------------------------------------------------
@router.get("/backup-download")
def download_database_backup_to_mobile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates an instant complete database snapshot JSON and streams it
    directly to the mobile phone for 1-tap local saving / WhatsApp sharing.
    """
    target_dir = backup_service.get_backup_directory(db)
    res = backup_service.create_database_backup(db, custom_path=target_dir)

    if not res.get("success"):
        raise HTTPException(status_code=500, detail="Failed to create database backup snapshot.")

    fpath = res["file_path"]
    fname = res["file_name"]

    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="Generated backup file not found.")

    return FileResponse(
        path=fpath,
        filename=fname,
        media_type="application/json"
    )


# -------------------------------------------------------------
# 9. Vendor Management System for Mobile
# -------------------------------------------------------------
class MobileVendorCreate(BaseModel):
    name: str
    phone: str
    company_name: Optional[str] = None
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    notes: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_holder_name: Optional[str] = None
    vendor_upi_id: Optional[str] = None
    opening_due: Optional[float] = 0.0

class MobileVendorUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    notes: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_holder_name: Optional[str] = None
    vendor_upi_id: Optional[str] = None

class MobileVendorPayment(BaseModel):
    amount: float
    payment_mode: Optional[str] = "UPI"
    reference_no: Optional[str] = None
    notes: Optional[str] = None

@router.get("/vendors")
def get_mobile_vendors(
    search: Optional[str] = Query(None, description="Search by name, phone or company"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.vendor import Vendor
    query = db.query(Vendor).filter(Vendor.is_active == True)
    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(or_(Vendor.name.ilike(s), Vendor.phone.ilike(s), Vendor.company_name.ilike(s)))

    vendors = query.order_by(Vendor.name.asc()).all()
    total_dues = sum(float(v.outstanding_due or 0.0) for v in vendors)

    rows = []
    for v in vendors:
        rows.append({
            "id": v.id,
            "vendor_code": v.vendor_code,
            "name": v.name,
            "company_name": v.company_name,
            "phone": v.phone,
            "alt_phone": v.alt_phone,
            "email": v.email,
            "gstin": v.gstin,
            "address": v.address,
            "city": v.city,
            "state": v.state,
            "notes": v.notes,
            "bank_name": v.bank_name,
            "bank_account_no": v.bank_account_no,
            "bank_ifsc": v.bank_ifsc,
            "bank_holder_name": v.bank_holder_name,
            "vendor_upi_id": v.vendor_upi_id,
            "outstanding_due": round(float(v.outstanding_due or 0.0), 2),
            "is_active": v.is_active,
            "created_at": v.created_at.isoformat() if v.created_at else None
        })

    return {
        "total_vendors": len(rows),
        "total_dues": round(total_dues, 2),
        "vendors": rows
    }

@router.post("/vendors")
def create_mobile_vendor(
    payload: MobileVendorCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.vendor import Vendor, VendorLedger, VendorLedgerType
    vendor = Vendor(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        company_name=payload.company_name,
        alt_phone=payload.alt_phone,
        email=payload.email,
        gstin=payload.gstin,
        address=payload.address,
        city=payload.city,
        state=payload.state or "Maharashtra",
        notes=payload.notes,
        bank_name=payload.bank_name,
        bank_account_no=payload.bank_account_no,
        bank_ifsc=payload.bank_ifsc,
        bank_holder_name=payload.bank_holder_name,
        vendor_upi_id=payload.vendor_upi_id,
        outstanding_due=payload.opening_due or 0.0,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(vendor)
    db.flush()

    if (payload.opening_due or 0.0) > 0:
        ledger = VendorLedger(
            vendor_id=vendor.id,
            entry_type=VendorLedgerType.ADJUSTMENT,
            reference_no="OPENING_BALANCE",
            credit_amount=payload.opening_due,
            debit_amount=0.0,
            balance_after=payload.opening_due,
            notes="Opening balance adjustment from mobile companion"
        )
        db.add(ledger)

    db.commit()
    db.refresh(vendor)
    log_action(db, user_id=current_user.id, action_type="CREATE_VENDOR_MOBILE", entity="VENDOR", entity_id=str(vendor.id))

    return {
        "id": vendor.id,
        "name": vendor.name,
        "phone": vendor.phone,
        "company_name": vendor.company_name,
        "outstanding_due": vendor.outstanding_due,
        "vendor_upi_id": vendor.vendor_upi_id
    }

@router.put("/vendors/{vendor_id}")
def update_mobile_vendor(
    vendor_id: int,
    payload: MobileVendorUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.vendor import Vendor
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    for k, val in payload.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(vendor, k, val)

    db.commit()
    db.refresh(vendor)
    return {"status": "success", "message": "Vendor updated successfully"}

@router.post("/vendors/{vendor_id}/payment")
def record_mobile_vendor_payment(
    vendor_id: int,
    payload: MobileVendorPayment,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.vendor import Vendor, VendorLedger, VendorLedgerType
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor.outstanding_due = max(0.0, float(vendor.outstanding_due or 0.0) - payload.amount)

    ledger = VendorLedger(
        vendor_id=vendor.id,
        entry_type=VendorLedgerType.PAYMENT_MADE,
        reference_no=payload.reference_no or "MOBILE_UPI_PAYMENT",
        debit_amount=payload.amount,
        credit_amount=0.0,
        balance_after=vendor.outstanding_due,
        payment_mode=payload.payment_mode or "UPI",
        notes=payload.notes or "Payment via Dolly POS Mobile App"
    )
    db.add(ledger)
    db.commit()
    db.refresh(ledger)
    log_action(db, user_id=current_user.id, action_type="VENDOR_PAYMENT_MOBILE", entity="VENDOR", entity_id=str(vendor.id), details={"amount": payload.amount})

    return {
        "status": "success",
        "message": f"Payment of ₹{payload.amount:,.2f} recorded! Dues updated.",
        "new_due": vendor.outstanding_due
    }

@router.get("/vendors/{vendor_id}/ledger")
def get_mobile_vendor_ledger(
    vendor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.vendor import VendorLedger
    entries = db.query(VendorLedger).filter(VendorLedger.vendor_id == vendor_id).order_by(desc(VendorLedger.created_at)).all()
    rows = []
    for e in entries:
        t_str = e.entry_type.value if hasattr(e.entry_type, "value") else str(e.entry_type)
        rows.append({
            "id": e.id,
            "vendor_id": e.vendor_id,
            "entry_type": t_str,
            "reference_no": e.reference_no or "—",
            "debit_amount": round(float(e.debit_amount or 0.0), 2),
            "credit_amount": round(float(e.credit_amount or 0.0), 2),
            "balance_after": round(float(e.balance_after or 0.0), 2),
            "payment_mode": e.payment_mode or "—",
            "notes": e.notes or "—",
            "created_at": (e.created_at + IST_OFFSET).strftime("%d %b %Y, %I:%M %p") if e.created_at else None
        })
    return rows
