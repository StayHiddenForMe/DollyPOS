import os
import time
import requests
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text

from app.models.settings import StoreSettings
from app.models.invoice import Invoice, InvoiceItem, Payment, PaymentMode
from app.models.product import Product
from app.models.category import Category
from app.models.expense import Expense
from app.models.customer import Customer
from app.models.lost_demand import LostDemand, LostDemandStatus, LostDemandUrgency

IST_OFFSET = timedelta(hours=5, minutes=30)

def get_ist_now() -> datetime:
    return datetime.utcnow() + IST_OFFSET

def get_utc_range_for_ist(start_date_str: str, end_date_str: str) -> tuple[datetime, datetime]:
    s_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    e_date = datetime.combine(datetime.strptime(end_date_str, "%Y-%m-%d").date(), datetime.max.time())
    return s_date - IST_OFFSET, e_date - IST_OFFSET

class CloudSyncService:
    @staticmethod
    def build_overview_snapshot(db: Session, period: str = "TODAY") -> Dict[str, Any]:
        """Builds high-performance overview snapshot for cloud distribution."""
        ist_now = get_ist_now()
        today_ist = ist_now.date()

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
        else:
            s_str = today_ist.strftime("%Y-%m-%d")
            e_str = s_str
            date_label = f"Today • {today_ist.strftime('%d %b %Y')}"

        st = db.query(StoreSettings).first()
        live_shop_name = st.shop_name if st and st.shop_name else "Dolly Toys & Kids Wear"

        s_utc, e_utc = get_utc_range_for_ist(s_str, e_str)

        # Invoices Query
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

        period_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.expense_date >= s_utc,
            Expense.expense_date <= e_utc
        ).scalar()
        period_expenses_val = round(float(period_expenses or 0.0), 2)
        net_profit = round(gross_profit - period_expenses_val, 2)

        # Payment Modes Breakdown
        payment_modes = {"CASH": 0.0, "UPI": 0.0, "CARD": 0.0, "CREDIT": 0.0}
        invoices_with_payments = set()
        if invoice_ids:
            payments = db.query(Payment).filter(Payment.invoice_id.in_(invoice_ids)).all()
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

        for inv in invoices:
            if inv.id not in invoices_with_payments:
                mode_str = str(inv.payment_mode.value if hasattr(inv.payment_mode, "value") else inv.payment_mode).upper()
                amt = float(inv.grand_total)
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

        # Hourly Sales Velocity (IST local hour conversion)
        hourly_map: Dict[int, Dict[str, Any]] = {}
        for h in range(9, 23):
            label = datetime.strptime(str(h), "%H").strftime("%I %p")
            hourly_map[h] = {"hour": label, "amount": 0.0, "bills": 0}

        for inv in invoices:
            ist_dt = inv.created_at + IST_OFFSET
            h = ist_dt.hour
            if h in hourly_map:
                hourly_map[h]["amount"] = round(hourly_map[h]["amount"] + float(inv.grand_total), 2)
                hourly_map[h]["bills"] += 1

        hourly_velocity = list(hourly_map.values())

        # Top Selling Products
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

        # Low Stock Alerts (top 10 items)
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

        # Low stock count total
        low_stock_count = db.query(Product).filter(
            Product.is_active == True,
            Product.stock_quantity <= Product.min_stock_alert
        ).count()

        # Khata outstanding
        khata_total = db.query(func.coalesce(func.sum(Customer.credit_balance), 0.0)).scalar()

        return {
            "shop_name": live_shop_name,
            "period": p_upper,
            "date_str": date_label,
            "start_date": s_str,
            "end_date": e_str,
            "last_updated": ist_now.strftime("%I:%M:%S %p"),
            "sales": {
                "gross_sales": gross_sales,
                "net_sales": net_sales,
                "total_cogs": total_cogs,
                "gross_profit": gross_profit,
                "net_profit": net_profit,
                "margin_percent": margin_percent,
                "total_tax": total_tax,
                "total_discount": total_discount,
                "bill_count": bill_count,
                "average_bill": avg_bill
            },
            "period_expenses": period_expenses_val,
            "payment_breakdown": payment_modes,
            "hourly_velocity": hourly_velocity,
            "top_products": top_items,
            "low_stock_count": low_stock_count,
            "low_stock_items": low_stock_items,
            "khata_outstanding": round(float(khata_total or 0.0), 2)
        }

    @classmethod
    def build_all_snapshots(cls, db: Session) -> Dict[str, Any]:
        """Precomputes snapshots for all 5 dashboard periods."""
        periods = ["TODAY", "YESTERDAY", "WEEK", "MONTH", "YEAR"]
        snapshots = {}
        for p in periods:
            snapshots[p] = cls.build_overview_snapshot(db, p)
        return snapshots

    @staticmethod
    def build_inventory_payload(db: Session) -> Dict[str, Any]:
        """Builds lightweight inventory catalog for cloud replication."""
        cats = db.query(Category.id, Category.name).all()
        cat_map = {c.id: c.name for c in cats}

        prods = db.query(
            Product.id,
            Product.name,
            Product.barcode,
            Product.category_id,
            Product.stock_quantity,
            Product.selling_price,
            Product.mrp,
            Product.purchase_price,
            Product.min_stock_alert
        ).filter(Product.is_active == True).order_by(Product.name.asc()).all()

        items = []
        for p in prods:
            items.append({
                "id": p.id,
                "name": p.name,
                "barcode": p.barcode or "—",
                "category": cat_map.get(p.category_id, "General"),
                "category_id": p.category_id,
                "current_stock": p.stock_quantity or 0,
                "selling_price": round(float(p.selling_price or 0.0), 2),
                "mrp": round(float(p.mrp or p.selling_price or 0.0), 2),
                "purchase_price": round(float(p.purchase_price or 0.0), 2),
                "min_stock": p.min_stock_alert or 3,
                "is_low_stock": (p.stock_quantity or 0) <= (p.min_stock_alert or 3)
            })

        return {
            "total_count": len(items),
            "products": items
        }

    @staticmethod
    def build_khata_payload(db: Session) -> Dict[str, Any]:
        """Builds customer khata ledger with WhatsApp links."""
        st = db.query(StoreSettings).first()
        shop_title = st.shop_name if st and st.shop_name else "Dolly Toys & Kids Wear"
        upi_id = st.upi_id if st else ""

        customers = db.query(Customer).filter(Customer.credit_balance > 0).order_by(Customer.credit_balance.desc()).all()
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

        total_outstanding = sum(c["balance"] for c in rows)
        return {
            "total_customers": len(rows),
            "total_outstanding": round(total_outstanding, 2),
            "customers": rows
        }

    @staticmethod
    def build_reports_payload(db: Session) -> Dict[str, Any]:
        """Packages complete historical data (1-5+ years) with daily aggregates for 100% accurate remote mobile Reports Studio queries."""
        ist_now = get_ist_now()

        # 0. Complete Daily Sales Summaries (Covers all 5+ years history in tiny payload, 100% accurate down to the paisa)
        daily_res = db.execute(text("""
            SELECT 
                to_char(created_at + INTERVAL '330 minutes', 'YYYY-MM-DD') as day,
                count(id) as bills,
                sum(coalesce(subtotal, grand_total)) as gross,
                sum(discount_amount) as discount,
                sum(tax_amount) as tax,
                sum(grand_total) as net
            FROM invoices
            WHERE is_cancelled = false
            GROUP BY day
            ORDER BY day DESC
        """)).fetchall()
        daily_sales = {}
        for r in daily_res:
            if r[0]:
                daily_sales[r[0]] = {
                    "bills": int(r[1] or 0),
                    "gross": round(float(r[2] or 0.0), 2),
                    "discount": round(float(r[3] or 0.0), 2),
                    "tax": round(float(r[4] or 0.0), 2),
                    "net": round(float(r[5] or 0.0), 2)
                }

        # 0b. Daily Payments Breakdown (Combines payments table and direct invoice payments)
        daily_payments = {}
        pmt_res = db.execute(text("""
            SELECT 
                to_char(created_at + INTERVAL '330 minutes', 'YYYY-MM-DD') as day,
                payment_mode,
                count(id) as bills,
                sum(amount) as total_amt
            FROM payments
            GROUP BY day, payment_mode
        """)).fetchall()
        for r in pmt_res:
            day = r[0]
            if not day:
                continue
            if day not in daily_payments:
                daily_payments[day] = {"CASH": 0.0, "UPI": 0.0, "CARD": 0.0, "CREDIT": 0.0, "bills": 0}
            m = str(r[1] or "CASH").upper()
            amt = float(r[3] or 0.0)
            daily_payments[day]["bills"] += int(r[2] or 0)
            if "CASH" in m:
                daily_payments[day]["CASH"] += amt
            elif "UPI" in m or "ONLINE" in m:
                daily_payments[day]["UPI"] += amt
            elif "CARD" in m:
                daily_payments[day]["CARD"] += amt
            else:
                daily_payments[day]["CREDIT"] += amt

        inv_pmt_res = db.execute(text("""
            SELECT 
                to_char(created_at + INTERVAL '330 minutes', 'YYYY-MM-DD') as day,
                payment_mode,
                count(id) as bills,
                sum(coalesce(paid_amount, grand_total)) as total_amt
            FROM invoices
            WHERE is_cancelled = false AND id NOT IN (SELECT DISTINCT invoice_id FROM payments)
            GROUP BY day, payment_mode
        """)).fetchall()
        for r in inv_pmt_res:
            day = r[0]
            if not day:
                continue
            if day not in daily_payments:
                daily_payments[day] = {"CASH": 0.0, "UPI": 0.0, "CARD": 0.0, "CREDIT": 0.0, "bills": 0}
            m = str(r[1] or "CASH").upper()
            amt = float(r[3] or 0.0)
            daily_payments[day]["bills"] += int(r[2] or 0)
            if "CASH" in m:
                daily_payments[day]["CASH"] += amt
            elif "UPI" in m or "ONLINE" in m:
                daily_payments[day]["UPI"] += amt
            elif "CARD" in m:
                daily_payments[day]["CARD"] += amt
            else:
                daily_payments[day]["CREDIT"] += amt

        for d in daily_payments:
            for k in ["CASH", "UPI", "CARD", "CREDIT"]:
                daily_payments[d][k] = round(daily_payments[d][k], 2)

        # 0c. Daily Categories Breakdown (Category revenue by date)
        daily_categories = {}
        cat_res = db.execute(text("""
            SELECT 
                to_char(i.created_at + INTERVAL '330 minutes', 'YYYY-MM-DD') as day,
                coalesce(c.name, 'General') as cat_name,
                sum(it.quantity) as qty,
                sum(it.total_price) as rev
            FROM invoice_items it
            JOIN invoices i ON i.id = it.invoice_id
            LEFT JOIN products p ON p.id = it.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE i.is_cancelled = false AND i.created_at >= '2025-01-01'
            GROUP BY day, cat_name
        """)).fetchall()
        for r in cat_res:
            day = r[0]
            if not day:
                continue
            if day not in daily_categories:
                daily_categories[day] = {}
            cname = r[1]
            daily_categories[day][cname] = {
                "qty": int(r[2] or 0),
                "rev": round(float(r[3] or 0.0), 2)
            }

        # 1. Sales Invoices - Granular bills (all of current year + recent, up to 15,000)
        invs = (
            db.query(Invoice)
            .filter(Invoice.is_cancelled == False)
            .order_by(Invoice.created_at.desc())
            .limit(15000)
            .all()
        )
        sales_invoices = []
        for inv in invs:
            ist_dt = inv.created_at + IST_OFFSET
            mode_str = str(inv.payment_mode.value if hasattr(inv.payment_mode, "value") else inv.payment_mode).upper()
            sales_invoices.append({
                "date_ymd": ist_dt.strftime("%Y-%m-%d"),
                "date": ist_dt.strftime("%d %b %Y"),
                "time": ist_dt.strftime("%I:%M %p"),
                "bill_number": inv.bill_number or f"#{inv.id}",
                "customer": inv.customer_name or "Walk-in Customer",
                "payment_mode": mode_str,
                "gross_amount": round(float(inv.subtotal or inv.grand_total), 2),
                "discount": round(float(inv.discount_amount or 0.0), 2),
                "tax": round(float(inv.tax_amount or 0.0), 2),
                "net_amount": round(float(inv.grand_total), 2)
            })

        # 2. Payments - Granular payments (up to 5,000 recent)
        pmts = db.query(Payment).order_by(Payment.created_at.desc()).limit(5000).all()
        payments = []
        for p in pmts:
            ist_dt = p.created_at + IST_OFFSET
            payments.append({
                "date_ymd": ist_dt.strftime("%Y-%m-%d"),
                "payment_mode": str(p.payment_mode.value if hasattr(p.payment_mode, "value") else p.payment_mode).upper(),
                "amount": round(float(p.amount), 2)
            })

        # 3. Expenses - Full historical expenses (up to 2,000 recent)
        exps = db.query(Expense).order_by(Expense.expense_date.desc()).limit(2000).all()
        expenses = []
        for e in exps:
            ist_dt = (e.expense_date + IST_OFFSET) if e.expense_date else ist_now
            cat_name = (
                e.category.value if hasattr(e.category, "value")
                else (e.category.name if hasattr(e.category, "name") else str(e.category))
            ) if e.category else "General"
            expenses.append({
                "date_ymd": ist_dt.strftime("%Y-%m-%d"),
                "date": ist_dt.strftime("%d %b %Y"),
                "category": cat_name,
                "description": e.title or e.notes or "—",
                "payment_mode": e.payment_mode or "CASH",
                "amount": round(float(e.amount), 2)
            })

        # 4. Damaged Products
        dmgs = db.query(Product).filter(Product.damaged_quantity > 0, Product.is_active == True).all()
        damaged = []
        for p in dmgs:
            qty = p.damaged_quantity
            c_loss = round(float(p.purchase_price or 0.0) * qty, 2)
            damaged.append({
                "product_name": p.name,
                "barcode": p.barcode or "—",
                "damaged_quantity": qty,
                "purchase_price": round(float(p.purchase_price or 0.0), 2),
                "selling_price": round(float(p.selling_price or 0.0), 2),
                "total_loss": c_loss
            })

        # 5. Planner
        lows = (
            db.query(Product)
            .filter(Product.is_active == True, Product.stock_quantity <= Product.min_stock_alert)
            .order_by(Product.stock_quantity.asc())
            .limit(100)
            .all()
        )
        planner = []
        for p in lows:
            cur = p.stock_quantity
            min_s = p.min_stock_alert
            suggested = max((min_s * 3) - cur, min_s)
            planner.append({
                "product_name": p.name,
                "barcode": p.barcode or "—",
                "current_stock": cur,
                "min_alert": min_s,
                "suggested_order": suggested,
                "est_cost": round(suggested * float(p.purchase_price or 0.0), 2)
            })

        # 6. Categories revenue - All historical summary
        cats_query = (
            db.query(
                Category.name,
                func.sum(InvoiceItem.quantity).label("total_qty"),
                func.sum(InvoiceItem.total_price).label("total_rev")
            )
            .join(Product, Product.id == InvoiceItem.product_id)
            .join(Category, Category.id == Product.category_id)
            .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
            .filter(Invoice.is_cancelled == False)
            .group_by(Category.name)
            .order_by(desc("total_rev"))
            .all()
        )
        cat_stats = []
        for cname, qty, rev in cats_query:
            cat_stats.append({
                "category": cname,
                "items_sold": int(qty or 0),
                "revenue": round(float(rev or 0.0), 2)
            })

        return {
            "daily_sales": daily_sales,
            "daily_payments": daily_payments,
            "daily_categories": daily_categories,
            "sales_invoices": sales_invoices,
            "payments": payments,
            "expenses": expenses,
            "damaged": damaged,
            "planner": planner,
            "categories": cat_stats
        }

    @staticmethod
    def build_categories_payload(db: Session) -> List[Dict[str, Any]]:
        """Returns categories for remote product creation dropdown."""
        cats = db.query(Category).order_by(Category.name.asc()).all()
        return [{"id": c.id, "name": c.name} for c in cats]

    @staticmethod
    def build_demands_payload(db: Session) -> List[Dict[str, Any]]:
        """Returns customer demand / lost sales logs for remote mobile viewing."""
        from app.models.lost_demand import LostDemand
        try:
            logs = db.query(LostDemand).order_by(LostDemand.created_at.desc()).limit(200).all()
            result = []
            for d in logs:
                result.append({
                    "id": d.id,
                    "item_description": d.item_description,
                    "category_name": d.category_name,
                    "preferred_size": d.preferred_size,
                    "preferred_color": d.preferred_color,
                    "customer_name": d.customer_name,
                    "customer_phone": d.customer_phone,
                    "request_count": d.request_count,
                    "urgency": str(d.urgency.value if hasattr(d.urgency, "value") else d.urgency),
                    "status": str(d.status.value if hasattr(d.status, "value") else d.status),
                    "notes": d.notes,
                    "created_at": d.created_at.isoformat() if d.created_at else None
                })
            return result
        except Exception:
            return []

    @staticmethod
    def build_vendors_payload(db: Session) -> List[Dict[str, Any]]:
        """Returns active vendors list with bank details and outstanding dues for mobile companion."""
        from app.models.vendor import Vendor
        try:
            vendors = db.query(Vendor).filter(Vendor.is_active == True).all()
            out = []
            for v in vendors:
                out.append({
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
            return out
        except Exception:
            return []

    @classmethod
    def sync_to_cloud(cls, db: Session, force: bool = False) -> Dict[str, Any]:
        """
        Executes a background push to Cloud Hub.
        Segregated by store_token. Never crashes or blocks local billing.
        """
        st = db.query(StoreSettings).first()
        if not st:
            return {"status": "skipped", "message": "No store settings configured."}

        if not getattr(st, "cloud_sync_enabled", True) and not force:
            return {"status": "disabled", "message": "Cloud sync is disabled in settings."}

        hub_url = getattr(st, "cloud_hub_url", "").strip().rstrip("/")
        store_token = getattr(st, "store_token", None)
        store_secret = getattr(st, "store_secret", None)

        if not hub_url or not store_token:
            return {
                "status": "unconfigured",
                "message": "Store Access Token or Cloud Hub URL is not set."
            }

        try:
            # Build full data payload
            snapshots = cls.build_all_snapshots(db)
            inventory = cls.build_inventory_payload(db)
            khata = cls.build_khata_payload(db)
            reports = cls.build_reports_payload(db)
            categories = cls.build_categories_payload(db)
            demands = cls.build_demands_payload(db)
            vendors = cls.build_vendors_payload(db)

            payload = {
                "store_id": getattr(st, "store_id", "default"),
                "store_token": store_token,
                "store_secret": store_secret,
                "shop_name": st.shop_name,
                "tagline": st.tag_line,
                "mobile": st.mobile,
                "address": st.address,
                "upi_id": st.upi_id,
                "overview": snapshots.get("TODAY", {}),
                "snapshots": snapshots,
                "inventory": inventory,
                "khata": khata,
                "reports": reports,
                "categories": categories,
                "demands": demands,
                "vendors": vendors,
                "synced_at": datetime.utcnow().isoformat()
            }

            sync_endpoint = f"{hub_url}/api/v1/hub/sync"
            response = requests.post(
                sync_endpoint,
                json=payload,
                timeout=45.0,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code in [200, 201]:
                res_data = response.json()

                # 1. Process pending demands logged from mobile app to pull down to local DB
                pending_demands = res_data.get("pending_demands", [])
                pulled_demands_count = 0
                for d in pending_demands:
                    desc_text = d.get("item_description", "").strip()
                    if desc_text:
                        existing = db.query(LostDemand).filter(
                            LostDemand.item_description == desc_text,
                            LostDemand.customer_phone == d.get("customer_phone")
                        ).first()
                        if not existing:
                            new_demand = LostDemand(
                                item_description=desc_text,
                                category_name=d.get("category_name"),
                                preferred_size=d.get("preferred_size"),
                                preferred_color=d.get("preferred_color"),
                                customer_name=d.get("customer_name"),
                                customer_phone=d.get("customer_phone"),
                                request_count=d.get("request_count", 1),
                                notes=d.get("notes") or "Logged remotely from Dolly POS Mobile App"
                            )
                            db.add(new_demand)
                            pulled_demands_count += 1

                # 2. Process pending products added remotely from mobile app to pull into local DB
                pending_products = res_data.get("pending_products", [])
                pulled_products_count = 0
                for p in pending_products:
                    p_name = p.get("name", "").strip()
                    p_barcode = p.get("barcode", "").strip()
                    if p_name and p_barcode:
                        existing_p = db.query(Product).filter(Product.barcode == p_barcode).first()
                        if not existing_p:
                            new_prod = Product(
                                name=p_name,
                                barcode=p_barcode,
                                category_id=p.get("category_id"),
                                purchase_price=float(p.get("purchase_price", 0.0)),
                                selling_price=float(p.get("selling_price", 0.0)),
                                mrp=float(p.get("mrp") or p.get("selling_price", 0.0)),
                                stock_quantity=int(p.get("stock_quantity", 1)),
                                min_stock_alert=int(p.get("min_stock_alert", 3)),
                                is_active=True,
                                created_at=datetime.utcnow()
                            )
                            db.add(new_prod)
                            pulled_products_count += 1

                # 3. Process pending demand mutations (status updates & deletions made from mobile)
                pending_mutations = res_data.get("pending_demand_mutations", [])
                for m in pending_mutations:
                    did = m.get("demand_id")
                    item_desc = (m.get("item_description") or "").strip()
                    cust_phone = (m.get("customer_phone") or "").strip()
                    action = m.get("action")
                    if action == "DELETE":
                        deleted = False
                        if did:
                            deleted = db.query(LostDemand).filter(LostDemand.id == did).delete(synchronize_session=False) > 0
                        if not deleted and item_desc:
                            q = db.query(LostDemand).filter(func.lower(LostDemand.item_description) == item_desc.lower())
                            if cust_phone:
                                q = q.filter(LostDemand.customer_phone == cust_phone)
                            q.delete(synchronize_session=False)
                    elif action == "UPDATE_STATUS":
                        new_st = m.get("status")
                        if new_st:
                            row = None
                            if did:
                                row = db.query(LostDemand).filter(LostDemand.id == did).first()
                            if not row and item_desc:
                                q = db.query(LostDemand).filter(func.lower(LostDemand.item_description) == item_desc.lower())
                                if cust_phone:
                                    q = q.filter(LostDemand.customer_phone == cust_phone)
                                row = q.first()
                            if row:
                                try:
                                    row.status = LostDemandStatus(new_st)
                                except Exception:
                                    pass

                # 4. Process pending vendors created remotely on mobile
                pending_vendors = res_data.get("pending_vendors", [])
                from app.models.vendor import Vendor, VendorLedger, VendorLedgerType
                for pv in pending_vendors:
                    pv_name = pv.get("name", "").strip()
                    pv_phone = pv.get("phone", "").strip()
                    if pv_name and pv_phone:
                        existing_v = db.query(Vendor).filter(Vendor.name == pv_name, Vendor.phone == pv_phone).first()
                        if not existing_v:
                            new_v = Vendor(
                                name=pv_name,
                                company_name=pv.get("company_name"),
                                phone=pv_phone,
                                alt_phone=pv.get("alt_phone"),
                                email=pv.get("email"),
                                gstin=pv.get("gstin"),
                                address=pv.get("address"),
                                city=pv.get("city"),
                                state=pv.get("state") or "Maharashtra",
                                notes=pv.get("notes"),
                                bank_name=pv.get("bank_name"),
                                bank_account_no=pv.get("bank_account_no"),
                                bank_ifsc=pv.get("bank_ifsc"),
                                bank_holder_name=pv.get("bank_holder_name"),
                                vendor_upi_id=pv.get("vendor_upi_id"),
                                outstanding_due=float(pv.get("opening_due", 0.0)),
                                is_active=True,
                                created_at=datetime.utcnow()
                            )
                            db.add(new_v)
                            db.flush()
                            if new_v.outstanding_due > 0:
                                ledger = VendorLedger(
                                    vendor_id=new_v.id,
                                    entry_type=VendorLedgerType.ADJUSTMENT,
                                    reference_no="OPENING_BALANCE",
                                    credit_amount=new_v.outstanding_due,
                                    debit_amount=0.0,
                                    balance_after=new_v.outstanding_due,
                                    notes="Opening balance adjustment from mobile companion"
                                )
                                db.add(ledger)
                        else:
                            # Update existing vendor with any new UPI/bank details
                            if pv.get("vendor_upi_id") and not existing_v.vendor_upi_id:
                                existing_v.vendor_upi_id = pv.get("vendor_upi_id")
                            if pv.get("bank_name") and not existing_v.bank_name:
                                existing_v.bank_name = pv.get("bank_name")
                            if pv.get("bank_account_no") and not existing_v.bank_account_no:
                                existing_v.bank_account_no = pv.get("bank_account_no")
                            if pv.get("bank_ifsc") and not existing_v.bank_ifsc:
                                existing_v.bank_ifsc = pv.get("bank_ifsc")
                            if pv.get("bank_holder_name") and not existing_v.bank_holder_name:
                                existing_v.bank_holder_name = pv.get("bank_holder_name")

                # 5. Process pending vendor updates made remotely on mobile
                pending_vendor_updates = res_data.get("pending_vendor_updates", [])
                for vu in pending_vendor_updates:
                    v_id = vu.get("vendor_id")
                    v_name = (vu.get("vendor_name") or "").strip()
                    v_phone = (vu.get("vendor_phone") or "").strip()
                    updates = vu.get("updates", {})
                    target_vendor = None
                    if v_id:
                        target_vendor = db.query(Vendor).filter(Vendor.id == v_id).first()
                    if not target_vendor and v_name:
                        target_vendor = db.query(Vendor).filter(func.lower(Vendor.name) == v_name.lower()).first()
                    if not target_vendor and v_phone:
                        target_vendor = db.query(Vendor).filter(Vendor.phone == v_phone).first()

                    if target_vendor and updates:
                        for k, val in updates.items():
                            if hasattr(target_vendor, k) and val is not None:
                                setattr(target_vendor, k, val)

                # 6. Process pending vendor payments recorded remotely on mobile
                pending_vendor_pmts = res_data.get("pending_vendor_payments", [])
                for pvp in pending_vendor_pmts:
                    v_id = pvp.get("vendor_id")
                    amt = float(pvp.get("amount", 0.0))
                    vendor_rec = db.query(Vendor).filter(Vendor.id == v_id).first()
                    if vendor_rec and amt > 0:
                        vendor_rec.outstanding_due = max(0.0, vendor_rec.outstanding_due - amt)
                        v_ledger = VendorLedger(
                            vendor_id=vendor_rec.id,
                            entry_type=VendorLedgerType.PAYMENT_MADE,
                            reference_no=pvp.get("reference_no") or "MOBILE_UPI_PAYMENT",
                            debit_amount=amt,
                            credit_amount=0.0,
                            balance_after=vendor_rec.outstanding_due,
                            payment_mode=pvp.get("payment_mode") or "UPI",
                            notes=pvp.get("notes") or "Paid via Dolly POS Mobile App"
                        )
                        db.add(v_ledger)

                db.commit()

                st.last_cloud_sync_at = datetime.utcnow()
                st.cloud_sync_status = "SUCCESS"
                st.cloud_sync_error = None
                db.commit()

                return {
                    "status": "success",
                    "synced_at": (st.last_cloud_sync_at.isoformat() + "Z") if st.last_cloud_sync_at else None,
                    "store_token": store_token,
                    "demands_pulled": pulled_demands_count,
                    "message": "Store data successfully synced to Cloud Hub."
                }
            else:
                error_msg = f"Cloud Hub returned HTTP {response.status_code}: {response.text[:200]}"
                st.cloud_sync_status = "ERROR"
                st.cloud_sync_error = error_msg
                db.commit()
                return {"status": "error", "message": error_msg}

        except requests.exceptions.RequestException as e:
            # Network failure / Hub unreachable - fail gracefully without blocking
            error_msg = f"Cannot reach Cloud Hub ({hub_url}): {str(e)[:150]}"
            st.cloud_sync_status = "OFFLINE"
            st.cloud_sync_error = error_msg
            try:
                db.commit()
            except Exception:
                db.rollback()
            return {"status": "offline", "message": error_msg}
        except Exception as e:
            error_msg = f"Unexpected cloud sync error: {str(e)[:150]}"
            st.cloud_sync_status = "ERROR"
            st.cloud_sync_error = error_msg
            try:
                db.commit()
            except Exception:
                db.rollback()
            return {"status": "error", "message": error_msg}

cloud_sync_service = CloudSyncService()
