import io
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, or_, extract
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any
import pandas as pd
from collections import defaultdict

from app.core.database import get_db
from app.api.auth_router import get_current_user, require_owner
from app.models.user import User
from app.models.invoice import Invoice, InvoiceItem, PaymentMode
from app.models.expense import Expense
from app.models.product import Product
from app.models.category import Category
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.return_order import ReturnOrder
from app.services.analytics_service import analytics_service

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

@router.get("/sales-summary")
def get_sales_report(
    period: str = Query("monthly", description="daily, weekly, monthly, yearly, custom"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD for custom range"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD for custom range"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    
    if period == "custom" and start_date:
        start_dt = datetime.fromisoformat(start_date).replace(hour=0, minute=0, second=0)
        end_dt = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59) if end_date else now
    elif period == "daily":
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
    elif period == "weekly":
        start_dt = now - timedelta(days=7)
        end_dt = now
    elif period == "yearly":
        start_dt = now.replace(month=1, day=1, hour=0, minute=0, second=0)
        end_dt = now
    else:  # monthly default
        start_dt = now.replace(day=1, hour=0, minute=0, second=0)
        end_dt = now

    invoices = db.query(Invoice).options(joinedload(Invoice.items)).filter(
        Invoice.created_at >= start_dt,
        Invoice.created_at <= end_dt,
        Invoice.is_cancelled == False,
        Invoice.is_held == False
    ).all()

    total_sales = sum(i.grand_total for i in invoices)
    total_tax = sum(i.tax_amount for i in invoices)
    total_discount = sum(i.discount_amount for i in invoices)
    bill_count = len(invoices)

    total_cogs = 0.0
    total_units_sold = 0
    product_sales_map = {}

    for inv in invoices:
        for itm in inv.items:
            total_cogs += (itm.cost_price or 0.0) * itm.quantity
            total_units_sold += itm.quantity

            if itm.product_id:
                if itm.product_id not in product_sales_map:
                    product_sales_map[itm.product_id] = {
                        "name": itm.item_name,
                        "barcode": itm.barcode,
                        "quantity_sold": 0,
                        "revenue": 0.0
                    }
                product_sales_map[itm.product_id]["quantity_sold"] += itm.quantity
                product_sales_map[itm.product_id]["revenue"] += itm.total_price

    gross_profit = max(0.0, total_sales - total_cogs)
    gross_margin_percent = round((gross_profit / total_sales * 100), 2) if total_sales > 0 else 0.0

    cash_total = sum(i.paid_amount for i in invoices if i.payment_mode == PaymentMode.CASH)
    upi_total = sum(i.paid_amount for i in invoices if i.payment_mode == PaymentMode.UPI)
    credit_total = sum(i.due_amount for i in invoices if i.payment_mode == PaymentMode.CREDIT_KHATA or i.due_amount > 0)

    # Expenses in same period
    expenses = db.query(Expense).filter(
        Expense.expense_date >= start_dt,
        Expense.expense_date <= end_dt
    ).all()

    expenses_total = sum(e.amount for e in expenses)

    expense_categories = {}
    for e in expenses:
        cat = e.category or "MISCELLANEOUS"
        expense_categories[cat] = expense_categories.get(cat, 0.0) + e.amount

    take_home_net_profit = round(gross_profit - expenses_total, 2)
    avg_bill_value = round(total_sales / bill_count, 2) if bill_count > 0 else 0.0

    # Refunds in same period
    refunds = db.query(ReturnOrder).filter(
        ReturnOrder.created_at >= start_dt,
        ReturnOrder.created_at <= end_dt
    ).all()
    total_refunds = sum(r.total_refund_amount for r in refunds)
    refund_count = len(refunds)

    # Fast-moving products (Top 8 sorted by quantity)
    fast_moving = sorted(product_sales_map.values(), key=lambda x: x["quantity_sold"], reverse=True)[:8]

    # Dead stock & Slow moving (unsold in 365+ days / >1 Year)
    cutoff_dead = now - timedelta(days=365)
    dead_stock_totals = db.query(
        func.sum(Product.stock_quantity * Product.purchase_price).label("trapped_capital"),
        func.count(Product.id).label("total_count")
    ).filter(
        Product.is_active == True,
        Product.stock_quantity > 0,
        (
            (Product.last_sold_at != None) & (Product.last_sold_at < cutoff_dead)
        ) | (
            (Product.last_sold_at == None) & (Product.created_at < cutoff_dead)
        )
    ).first()

    dead_stock_data = analytics_service.get_dead_stock(db, days=365, limit=50)
    dead_stock_trapped = round(float(dead_stock_totals.trapped_capital or 0.0), 2) if dead_stock_totals else 0.0
    dead_stock_count = int(dead_stock_totals.total_count or 0) if dead_stock_totals else 0

    return {
        "period": period,
        "start_date": start_dt.isoformat(),
        "end_date": end_dt.isoformat(),
        "bill_count": bill_count,
        "total_sales": round(total_sales, 2),
        "total_cogs": round(total_cogs, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_margin_percent": gross_margin_percent,
        "total_units_sold": total_units_sold,
        "avg_bill_value": avg_bill_value,
        "total_tax": round(total_tax, 2),
        "total_discount": round(total_discount, 2),
        "total_refunds": round(total_refunds, 2),
        "refund_count": refund_count,
        "cash_total": round(cash_total, 2),
        "upi_total": round(upi_total, 2),
        "credit_total": round(credit_total, 2),
        "expenses_total": round(expenses_total, 2),
        "expense_breakdown": [{"category": k, "amount": round(v, 2)} for k, v in expense_categories.items()],
        "take_home_net_profit": take_home_net_profit,
        "fast_moving_products": fast_moving,
        "dead_stock_summary": {
            "dead_stock_products": dead_stock_data,
            "total_trapped_capital": dead_stock_trapped,
            "dead_stock_count": dead_stock_count
        }
    }

@router.get("/yoy-comparison")
def get_yoy_comparison(
    query: str = Query("Raincoat", description="Search product name or keyword (e.g. Raincoat, Holi, Kurta, Frock)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Year-over-Year (YoY) Sales Comparison Engine:
    Compares sales volume & revenue for any product keyword or seasonal category across 2026, 2025, 2024, etc.
    """
    clean_q = query.strip()
    now = datetime.utcnow()
    current_year = now.year

    # Get all invoice items matching query
    items = db.query(InvoiceItem, Invoice.created_at)\
              .join(Invoice, Invoice.id == InvoiceItem.invoice_id)\
              .filter(Invoice.is_cancelled == False)\
              .filter(InvoiceItem.item_name.ilike(f"%{clean_q}%")).all()

    yearly_data = defaultdict(lambda: {"units_sold": 0, "revenue": 0.0, "bill_count": 0})
    monthly_trend = defaultdict(lambda: {"units": 0, "revenue": 0.0})

    for item, created_at in items:
        yr = created_at.year
        month_str = created_at.strftime("%Y-%m")
        yearly_data[yr]["units_sold"] += item.quantity
        yearly_data[yr]["revenue"] += item.total_price
        yearly_data[yr]["bill_count"] += 1
        monthly_trend[month_str]["units"] += item.quantity
        monthly_trend[month_str]["revenue"] += item.total_price

    this_year_stats = yearly_data[current_year]
    last_year_stats = yearly_data[current_year - 1]
    two_years_ago_stats = yearly_data[current_year - 2]

    # Calculate growth %
    if last_year_stats["revenue"] > 0:
        yoy_growth_revenue = round(((this_year_stats["revenue"] - last_year_stats["revenue"]) / last_year_stats["revenue"]) * 100, 1)
        yoy_growth_units = round(((this_year_stats["units_sold"] - last_year_stats["units_sold"]) / last_year_stats["units_sold"]) * 100, 1)
    else:
        yoy_growth_revenue = 100.0 if this_year_stats["revenue"] > 0 else 0.0
        yoy_growth_units = 100.0 if this_year_stats["units_sold"] > 0 else 0.0

    sorted_monthly = [{"month": k, "units": v["units"], "revenue": round(v["revenue"], 2)} for k, v in sorted(monthly_trend.items())][-12:]

    # Get current active products in inventory matching query
    matching_prods = db.query(Product).options(joinedload(Product.category)).filter(
        Product.is_active == True,
        or_(Product.name.ilike(f"%{clean_q}%"), Product.category.has(Category.name.ilike(f"%{clean_q}%")))
    ).all()

    total_remaining_stock = sum(p.stock_quantity for p in matching_prods)
    total_damaged_stock = sum(p.damaged_quantity or 0 for p in matching_prods)
    total_stock_value = sum(p.stock_quantity * (p.purchase_price or 0.0) for p in matching_prods)

    # 1. Product-level Breakdown (Itemized by Product Name & Variant)
    prod_sales_map = defaultdict(lambda: {"sold_units": 0, "revenue": 0.0})
    for item, _ in items:
        if item.product_id:
            prod_sales_map[item.product_id]["sold_units"] += item.quantity
            prod_sales_map[item.product_id]["revenue"] += item.total_price

    product_breakdown = []
    for p in matching_prods:
        sold_u = prod_sales_map[p.id]["sold_units"]
        sold_r = round(prod_sales_map[p.id]["revenue"], 2)
        in_stk = p.stock_quantity
        dmg_qty = p.damaged_quantity or 0
        total_brought = sold_u + in_stk + dmg_qty
        sell_through = round((sold_u / max(1, total_brought)) * 100, 1) if total_brought > 0 else 0.0

        if sell_through >= 75:
            status = "🔥 Best Seller"
        elif sell_through >= 40:
            status = "⚡ Steady Mover"
        else:
            status = "❄️ High Stock Leftover"

        product_breakdown.append({
            "product_id": p.id,
            "name": p.name,
            "barcode": p.barcode,
            "sku": p.sku or "",
            "size": p.size or "Standard",
            "color": p.color or "Standard",
            "category_name": p.category.name if p.category else "",
            "purchase_price": p.purchase_price,
            "selling_price": p.selling_price,
            "sold_units": sold_u,
            "sold_revenue": sold_r,
            "in_stock": in_stk,
            "damaged_quantity": dmg_qty,
            "total_brought": total_brought,
            "sell_through_percent": sell_through,
            "status": status
        })

    product_breakdown.sort(key=lambda x: (x["sold_units"], x["in_stock"]), reverse=True)

    # 2. Size-by-Size Aggregated Summary
    size_sold_map = defaultdict(lambda: {"sold_units": 0, "revenue": 0.0})
    size_stock_map = defaultdict(int)
    size_damage_map = defaultdict(int)

    for item, _ in items:
        sz = (item.size or "Standard").strip().upper()
        size_sold_map[sz]["sold_units"] += item.quantity
        size_sold_map[sz]["revenue"] += item.total_price

    for p in matching_prods:
        sz = (p.size or "Standard").strip().upper()
        size_stock_map[sz] += p.stock_quantity
        size_damage_map[sz] += (p.damaged_quantity or 0)

    all_sizes = sorted(list(set(list(size_sold_map.keys()) + list(size_stock_map.keys()))))
    size_breakdown = []

    for sz in all_sizes:
        sold_u = size_sold_map[sz]["sold_units"]
        sold_r = round(size_sold_map[sz]["revenue"], 2)
        in_stk = size_stock_map[sz]
        dmg_u = size_damage_map[sz]
        procured = sold_u + in_stk + dmg_u
        sell_through = round((sold_u / max(1, procured)) * 100, 1) if procured > 0 else 0.0

        if sell_through >= 75:
            status = "🔥 Best Seller"
        elif sell_through >= 40:
            status = "⚡ Steady Mover"
        else:
            status = "❄️ High Stock Leftover"

        size_breakdown.append({
            "size": sz,
            "sold_units": sold_u,
            "sold_revenue": sold_r,
            "in_stock": in_stk,
            "damaged_quantity": dmg_u,
            "total_procured": procured,
            "sell_through_percent": sell_through,
            "status": status
        })

    # Sort size breakdown by most units sold
    size_breakdown.sort(key=lambda x: x["sold_units"], reverse=True)

    best_size = size_breakdown[0]["size"] if size_breakdown and size_breakdown[0]["sold_units"] > 0 else "N/A"
    most_stock_size = sorted(size_breakdown, key=lambda x: x["in_stock"], reverse=True)[0]["size"] if size_breakdown and size_breakdown[0]["in_stock"] > 0 else "N/A"

    total_units_sold_all_time = sum(s["sold_units"] for s in size_breakdown)
    overall_sell_through = round((total_units_sold_all_time / max(1, total_units_sold_all_time + total_remaining_stock + total_damaged_stock)) * 100, 1)

    smart_advice = (
        f"🏆 Top-Selling Size: '{best_size}'. Next season recommendation: Increase re-orders for {best_size} by 25-40% early in the season. "
        f"Monitor size '{most_stock_size}' (currently {size_stock_map.get(most_stock_size, 0)} units in stock) to avoid capital lockup."
        if best_size != "N/A" else f"Catalog currently has {total_remaining_stock} units in stock. Check seasonal promotion."
    )

    return {
        "search_query": clean_q,
        "current_year": current_year,
        "this_year": {
            "year": current_year,
            "units_sold": this_year_stats["units_sold"],
            "revenue": round(this_year_stats["revenue"], 2),
            "bill_count": this_year_stats["bill_count"]
        },
        "last_year": {
            "year": current_year - 1,
            "units_sold": last_year_stats["units_sold"],
            "revenue": round(last_year_stats["revenue"], 2),
            "bill_count": last_year_stats["bill_count"]
        },
        "two_years_ago": {
            "year": current_year - 2,
            "units_sold": two_years_ago_stats["units_sold"],
            "revenue": round(two_years_ago_stats["revenue"], 2),
            "bill_count": two_years_ago_stats["bill_count"]
        },
        "yoy_growth_revenue_percent": yoy_growth_revenue,
        "yoy_growth_units_percent": yoy_growth_units,
        "monthly_trend": sorted_monthly,
        "inventory_summary": {
            "total_in_stock": total_remaining_stock,
            "total_damaged_stock": total_damaged_stock,
            "total_stock_value": round(total_stock_value, 2),
            "total_sold_all_time": total_units_sold_all_time,
            "overall_sell_through_percent": overall_sell_through,
            "best_selling_size": best_size,
            "most_stock_remaining_size": most_stock_size,
            "smart_advice": smart_advice
        },
        "size_breakdown": size_breakdown,
        "product_breakdown": product_breakdown
    }

@router.get("/category-boom")
def get_category_boom_analysis(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Category Boom & Growth Radar:
    Compares category revenue and unit momentum for This Month vs Last Month and This Year vs Last Year.
    """
    now = datetime.utcnow()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0)
    last_month_end = this_month_start - timedelta(seconds=1)
    last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0)

    categories = db.query(Category).all()
    results = []

    for cat in categories:
        # This Month Sales
        this_month_items = db.query(func.sum(InvoiceItem.total_price).label("rev"), func.sum(InvoiceItem.quantity).label("qty"))\
                             .join(Invoice, Invoice.id == InvoiceItem.invoice_id)\
                             .join(Product, Product.id == InvoiceItem.product_id)\
                             .filter(Invoice.created_at >= this_month_start, Invoice.is_cancelled == False)\
                             .filter(Product.category_id == cat.id).first()

        # Last Month Sales
        last_month_items = db.query(func.sum(InvoiceItem.total_price).label("rev"), func.sum(InvoiceItem.quantity).label("qty"))\
                             .join(Invoice, Invoice.id == InvoiceItem.invoice_id)\
                             .join(Product, Product.id == InvoiceItem.product_id)\
                             .filter(Invoice.created_at >= last_month_start, Invoice.created_at <= last_month_end, Invoice.is_cancelled == False)\
                             .filter(Product.category_id == cat.id).first()

        this_rev = this_month_items.rev or 0.0
        this_qty = this_month_items.qty or 0
        last_rev = last_month_items.rev or 0.0
        last_qty = last_month_items.qty or 0

        growth = round(((this_rev - last_rev) / max(1.0, last_rev)) * 100, 1) if last_rev > 0 else (100.0 if this_rev > 0 else 0.0)

        if growth >= 40:
            status = "🔥 MEGA BOOM"
        elif growth >= 15:
            status = "🚀 HIGH GROWTH"
        elif growth >= -10:
            status = "⚡ STEADY"
        else:
            status = "📉 SLOWDOWN"

        results.append({
            "category_id": cat.id,
            "category_name": cat.name,
            "this_month_revenue": round(this_rev, 2),
            "this_month_units": this_qty,
            "last_month_revenue": round(last_rev, 2),
            "growth_percent": growth,
            "momentum_status": status
        })

    results.sort(key=lambda x: x["growth_percent"], reverse=True)
    return results

def get_festival_date_for_year(fest_key: str, year: int) -> str:
    """
    Perpetual Indian Festival Date Engine.
    Accurate astronomical mapping for 2024-2035, with lunisolar perpetual projection for 2036-2075+.
    """
    KNOWN_DATES: Dict[str, Dict[int, str]] = {
        "DIWALI": {
            2024: "2024-11-01", 2025: "2025-10-20", 2026: "2026-11-08", 2027: "2027-10-29",
            2028: "2028-10-17", 2029: "2029-11-05", 2030: "2030-10-26", 2031: "2031-11-14",
            2032: "2032-11-02", 2033: "2033-10-22", 2034: "2034-11-10", 2035: "2035-10-30"
        },
        "HOLI": {
            2024: "2024-03-25", 2025: "2025-03-14", 2026: "2026-03-04", 2027: "2027-03-22",
            2028: "2028-03-11", 2029: "2029-03-01", 2030: "2030-03-20", 2031: "2031-03-09",
            2032: "2032-03-26", 2033: "2033-03-15", 2034: "2034-03-05", 2035: "2035-03-24"
        },
        "GANESH": {
            2024: "2024-09-07", 2025: "2025-08-27", 2026: "2026-09-14", 2027: "2027-09-04",
            2028: "2028-08-24", 2029: "2029-09-11", 2030: "2030-09-01", 2031: "2031-09-19",
            2032: "2032-09-08", 2033: "2033-08-29", 2034: "2034-09-16", 2035: "2035-09-06"
        },
        "RAKSHA_BANDHAN": {
            2024: "2024-08-19", 2025: "2025-08-09", 2026: "2026-08-28", 2027: "2027-08-17",
            2028: "2028-08-05", 2029: "2029-08-24", 2030: "2030-08-13", 2031: "2031-08-02",
            2032: "2032-08-21", 2033: "2033-08-10", 2034: "2034-08-29", 2035: "2035-08-19"
        },
        "JANMASHTAMI": {
            2024: "2024-08-26", 2025: "2025-08-16", 2026: "2026-09-04", 2027: "2027-08-25",
            2028: "2028-08-13", 2029: "2029-09-01", 2030: "2030-08-21", 2031: "2031-08-10",
            2032: "2032-08-28", 2033: "2033-08-18", 2034: "2034-09-05", 2035: "2035-08-26"
        },
        "NAVRATRI": {
            2024: "2024-10-03", 2025: "2025-09-22", 2026: "2026-10-11", 2027: "2027-09-30",
            2028: "2028-10-19", 2029: "2029-10-08", 2030: "2030-09-28", 2031: "2031-10-16",
            2032: "2032-10-04", 2033: "2033-09-24", 2034: "2034-10-13", 2035: "2035-10-02"
        },
        "DUSSEHRA": {
            2024: "2024-10-12", 2025: "2025-10-02", 2026: "2026-10-20", 2027: "2027-10-09",
            2028: "2028-10-28", 2029: "2029-10-17", 2030: "2030-10-06", 2031: "2031-10-25",
            2032: "2032-10-14", 2033: "2033-10-03", 2034: "2034-10-22", 2035: "2035-10-11"
        },
        "EID_UL_FITR": {
            2024: "2024-04-11", 2025: "2025-03-31", 2026: "2026-03-20", 2027: "2027-03-10",
            2028: "2028-02-27", 2029: "2029-02-15", 2030: "2030-02-05", 2031: "2031-01-25",
            2032: "2032-01-14", 2033: "2033-01-03", 2034: "2034-12-13", 2035: "2035-12-02"
        },
        "SHIVRATRI": {
            2024: "2024-03-08", 2025: "2025-02-26", 2026: "2026-03-17", 2027: "2027-03-06",
            2028: "2028-02-23", 2029: "2029-03-13", 2030: "2030-03-03", 2031: "2031-02-20",
            2032: "2032-03-09", 2033: "2033-02-27", 2034: "2034-03-17", 2035: "2035-03-07"
        },
        "GUDI_PADWA": {
            2024: "2024-04-09", 2025: "2025-03-30", 2026: "2026-03-19", 2027: "2027-04-07",
            2028: "2028-03-27", 2029: "2029-04-14", 2030: "2030-04-03", 2031: "2031-03-24",
            2032: "2032-04-10", 2033: "2033-03-30", 2034: "2034-04-19", 2035: "2035-04-08"
        }
    }

    if fest_key in KNOWN_DATES and year in KNOWN_DATES[fest_key]:
        return KNOWN_DATES[fest_key][year]

    # Perpetual projection for 2036-2075+ based on 19-year Metonic cycle
    if fest_key in KNOWN_DATES:
        base_year = year - 19
        while base_year > 2035:
            base_year -= 19
        while base_year < 2024:
            base_year += 19
        if base_year in KNOWN_DATES[fest_key]:
            base_date_str = KNOWN_DATES[fest_key][base_year]
            month_day = base_date_str[5:]
            return f"{year}-{month_day}"

    return f"{year}-10-25"

@router.get("/seasonal-calendar")
def get_seasonal_festival_calendar(
    year: Optional[int] = Query(None, description="Year to calculate (e.g. 2025, 2026, 2030, 2035, 2050...)"),
    current_user: User = Depends(get_current_user)
):
    """
    Perpetual Indian Festival & Retail Peak Season Calendar.
    Perpetually calculates festival dates, countdowns, stocking advice, and today's active festival alert for ANY year (2024 to 2075+).
    """
    target_year = year or datetime.utcnow().year
    today_dt = date.today()

    festivals_db = [
        {
            "name": "Makar Sankranti & Pongal",
            "date": f"{target_year}-01-14",
            "category": "HARVEST_FESTIVAL",
            "icon": "🪁",
            "season": "Winter / Spring",
            "recommended_stock": ["Kite Toy Sets", "Winter Wear Clearance", "Sweets Packaging Bags", "Bright Ethnic Kurta Sets"],
            "stock_lead_days": 14
        },
        {
            "name": "Republic Day Sale",
            "date": f"{target_year}-01-26",
            "category": "NATIONAL",
            "icon": "🇮🇳",
            "season": "Winter",
            "recommended_stock": ["Tri-Color Kids Badges & Ribbons", "School Stationery Sets", "Winter Hoodies"],
            "stock_lead_days": 7
        },
        {
            "name": f"Dolly Toys {target_year - 2002}th Foundation Day & Shop Anniversary 🎉",
            "date": f"{target_year}-02-17",
            "category": "SHOP_ANNIVERSARY",
            "icon": "🎂",
            "season": "Store Foundation Day (Est. 17 Feb 2002)",
            "recommended_stock": ["Anniversary Celebration Offers", "Customer Loyalty Return Gifts", "Kids Free Balloons & Treats"],
            "stock_lead_days": 10
        },
        {
            "name": "Maha Shivratri",
            "date": get_festival_date_for_year("SHIVRATRI", target_year),
            "category": "RELIGIOUS",
            "icon": "🔱",
            "season": "Spring",
            "recommended_stock": ["Traditional Kurtas", "Puja Prop Toys", "Ethnic Frocks"],
            "stock_lead_days": 10
        },
        {
            "name": "Holi & Dhuleti Festival of Colors",
            "date": get_festival_date_for_year("HOLI", target_year),
            "category": "MAJOR_FESTIVAL",
            "icon": "🎨",
            "season": "Summer Arrival",
            "recommended_stock": ["100% Pure Cotton White T-Shirts & Shorts", "Water Guns & Pichkaris", "High-Pressure Water Tanks", "Light Summer Frocks"],
            "stock_lead_days": 21
        },
        {
            "name": "Gudi Padwa & Chaitra Navratri / Ugadi",
            "date": get_festival_date_for_year("GUDI_PADWA", target_year),
            "category": "NEW_YEAR",
            "icon": "🚩",
            "season": "Spring / Summer",
            "recommended_stock": ["Traditional Maharashtrian Dhoti Sets", "Nauvari Sarees for Kids", "Silk Frocks"],
            "stock_lead_days": 14
        },
        {
            "name": "Eid-ul-Fitr",
            "date": get_festival_date_for_year("EID_UL_FITR", target_year),
            "category": "MAJOR_FESTIVAL",
            "icon": "🌙",
            "season": "Summer",
            "recommended_stock": ["Grand Party Wear Sherwanis", "Embroidered Frocks & Gowns", "Musical Toys & Remote Cars for Eidi Gifts"],
            "stock_lead_days": 25
        },
        {
            "name": "Summer Vacation & Back to School Season",
            "date": f"{target_year}-06-01",
            "category": "RETAIL_SEASON",
            "icon": "🎒",
            "season": "Summer / School Reopen",
            "recommended_stock": ["School Backpacks & Trolleys", "Insulated Lunch Boxes & Steel Bottles", "Pencil Cases & Stationary Combos", "Battery Ride-On Trikes"],
            "stock_lead_days": 30
        },
        {
            "name": "Monsoon & Rainwear Season",
            "date": f"{target_year}-07-01",
            "category": "RETAIL_SEASON",
            "icon": "🌧️",
            "season": "Monsoon",
            "recommended_stock": ["Kids Character Raincoats", "Cartoon Umbrellas (LED / Auto-Open)", "Gumboots & Waterproof Sandals", "Waterproof Bag Covers"],
            "stock_lead_days": 20
        },
        {
            "name": "Raksha Bandhan",
            "date": get_festival_date_for_year("RAKSHA_BANDHAN", target_year),
            "category": "SIBLING_FESTIVAL",
            "icon": "🎁",
            "season": "Festive Arrival",
            "recommended_stock": ["Brother-Sister Matching Ethnic Sets", "Gift Toy Packs & Doll Sets", "Kurta Pyjamas & Lehengas"],
            "stock_lead_days": 20
        },
        {
            "name": "Shri Krishna Janmashtami",
            "date": get_festival_date_for_year("JANMASHTAMI", target_year),
            "category": "RELIGIOUS",
            "icon": "🦚",
            "season": "Festive Arrival",
            "recommended_stock": ["Bal Gopal / Kanha Costumes & Mor Pankh Mukuts", "Radha Gopi Lehengas", "Wooden & Plastic Flutes", "Traditional Mojaris"],
            "stock_lead_days": 15
        },
        {
            "name": "Ganesh Chaturthi (10 Days Festival)",
            "date": get_festival_date_for_year("GANESH", target_year),
            "category": "MAJOR_FESTIVAL",
            "icon": "🐘",
            "season": "Festive Peak",
            "recommended_stock": ["Silk Kurta Pajama Sets", "Traditional Dhotis & Waistcoats", "Lehenga Cholis", "Musical Toys & Aarti Props"],
            "stock_lead_days": 21
        },
        {
            "name": "Sharad Navratri & Durga Puja (9 Nights)",
            "date": get_festival_date_for_year("NAVRATRI", target_year),
            "category": "MAJOR_FESTIVAL",
            "icon": "💃",
            "season": "Festive Peak",
            "recommended_stock": ["Mirror-Work Chaniya Cholis", "Kedia & Dhoti Sets", "Dandiya Sticks (Wood & Light)", "Traditional Jewelry Props"],
            "stock_lead_days": 25
        },
        {
            "name": "Dussehra (Vijayadashami)",
            "date": get_festival_date_for_year("DUSSEHRA", target_year),
            "category": "MAJOR_FESTIVAL",
            "icon": "🏹",
            "season": "Festive Peak",
            "recommended_stock": ["Party Wear Suits & Blazers", "Kids Bow-Tie Shirt Sets", "Bow & Arrow Toy Sets", "Action Hero Toys"],
            "stock_lead_days": 15
        },
        {
            "name": "Dhanteras & Diwali Mega Shopping Week",
            "date": get_festival_date_for_year("DIWALI", target_year),
            "category": "MEGA_PEAK",
            "icon": "🪔",
            "season": "Biggest Retail Peak of the Year",
            "recommended_stock": [
                "Heavy Embroidered Lehengas & Gowns",
                "3-Piece Tuxedos & Velvet Blazers",
                "Large Rechargeable Battery Cars & Jeeps",
                "High-Speed Drones, RC Helicopters & Board Games",
                "Festival Gift Boxes & Accessories"
            ],
            "stock_lead_days": 35
        },
        {
            "name": "Bhai Dooj & Dev Uthani Ekadashi",
            "date": f"{target_year}-11-10",
            "category": "FESTIVAL",
            "icon": "✨",
            "season": "Wedding Season Start",
            "recommended_stock": ["Wedding Reception Kids Suits", "Sherwanis", "Designer Frocks", "Sibling Gift Packs"],
            "stock_lead_days": 14
        },
        {
            "name": "Children's Day Bonanza",
            "date": f"{target_year}-11-14",
            "category": "SPECIAL_DAY",
            "icon": "🧸",
            "season": "Winter Peak",
            "recommended_stock": ["STEM Educational Toys", "DIY Craft Kits", "Plush Soft Toys", "Board Games"],
            "stock_lead_days": 10
        },
        {
            "name": "Winter Season & Holiday Collection",
            "date": f"{target_year}-12-01",
            "category": "RETAIL_SEASON",
            "icon": "❄️",
            "season": "Winter",
            "recommended_stock": ["Quilted Jackets & Windcheaters", "Thermal Inners & Woolen Sets", "Caps, Gloves & Booties", "Indoor Games"],
            "stock_lead_days": 25
        },
        {
            "name": "Christmas & New Year Celebration",
            "date": f"{target_year}-12-25",
            "category": "HOLIDAY",
            "icon": "🎄",
            "season": "Year-End Holiday",
            "recommended_stock": ["Santa Costumes & Caps", "Red & White Winter Party Frocks", "Musical Christmas Toys", "Gift Sets"],
            "stock_lead_days": 15
        }
    ]

    calculated = []
    active_today_festivals = []

    for f in festivals_db:
        fest_date = datetime.strptime(f["date"], "%Y-%m-%d").date()
        days_diff = (fest_date - today_dt).days

        is_today = (fest_date == today_dt)
        if is_today:
            active_today_festivals.append(f)

        calculated.append({
            **f,
            "days_remaining": days_diff,
            "is_past": days_diff < 0,
            "is_today": is_today,
            "is_upcoming": 0 <= days_diff <= 45,
            "status_text": "TODAY! 🎉" if is_today else (f"in {days_diff} days" if days_diff > 0 else f"{abs(days_diff)} days ago")
        })

    calculated.sort(key=lambda x: x["date"])

    return {
        "year": target_year,
        "today_date": today_dt.strftime("%Y-%m-%d"),
        "has_active_festival_today": len(active_today_festivals) > 0,
        "today_festivals": active_today_festivals,
        "festivals": calculated
    }

@router.get("/export/sales-excel")
def export_sales_excel(
    period: str = Query("all", description="daily, weekly, monthly, yearly, all, custom"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Invoice).filter(Invoice.is_cancelled == False, Invoice.is_held == False)
    now = datetime.utcnow()

    if period == "all":
        pass
    elif period in ["daily", "today", "day"]:
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(Invoice.created_at >= start_dt)
    elif period in ["weekly", "week", "7days"]:
        start_dt = now - timedelta(days=7)
        query = query.filter(Invoice.created_at >= start_dt)
    elif period in ["monthly", "month", "30days"]:
        start_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(Invoice.created_at >= start_dt)
    elif period in ["yearly", "year", "1year"]:
        start_dt = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(Invoice.created_at >= start_dt)
    elif period == "custom" and start_date:
        query = query.filter(Invoice.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(Invoice.created_at <= datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59))
    elif start_date:
        query = query.filter(Invoice.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(Invoice.created_at <= datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59))

    invoices = query.order_by(desc(Invoice.created_at)).all()

    data = []
    for inv in invoices:
        ist_dt = inv.created_at + timedelta(hours=5, minutes=30)
        data.append({
            "Bill Number": inv.bill_number,
            "Date & Time (IST)": ist_dt.strftime("%d-%m-%Y %I:%M %p"),
            "Customer Name": inv.customer_name or "Walk-in Customer",
            "Customer Phone": inv.customer_phone or "-",
            "Subtotal (₹)": inv.subtotal,
            "Discount (₹)": inv.discount_amount,
            "Tax (₹)": inv.tax_amount,
            "Grand Total (₹)": inv.grand_total,
            "Paid Amount (₹)": inv.paid_amount,
            "Due Amount (₹)": inv.due_amount,
            "Payment Mode": inv.payment_mode.value if hasattr(inv.payment_mode, 'value') else str(inv.payment_mode)
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Sales Report')
    output.seek(0)

    filename = f"DollyToys_SalesReport_{period}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/export/inventory-excel")
def export_inventory_excel(
    category_id: Optional[int] = Query(None, description="Optional category filter"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Product).options(joinedload(Product.category)).filter(Product.is_active == True)
    if category_id:
        query = query.filter(Product.category_id == category_id)

    products = query.order_by(desc(Product.id)).all()

    data = []
    for p in products:
        data.append({
            "Barcode": p.barcode,
            "Speed Dial Code": p.speed_dial_code or "",
            "SKU": p.sku or "",
            "Product Name": p.name,
            "Category": p.category.name if p.category else "",
            "Size": p.size or "",
            "Color": p.color or "",
            "Fabric": p.fabric or "",
            "Purchase Price (₹)": p.purchase_price,
            "Selling Price (₹)": p.selling_price,
            "MRP (₹)": p.mrp,
            "GST (%)": p.gst_percent,
            "Margin (%)": p.margin_percent,
            "Stock Quantity": p.stock_quantity,
            "Total Value (₹)": round(p.stock_quantity * p.purchase_price, 2),
            "Min Alert Qty": p.min_stock_alert,
            "Damaged Qty": p.damaged_quantity
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Inventory Catalog')
    output.seek(0)

    filename = f"DollyToys_InventoryReport_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
