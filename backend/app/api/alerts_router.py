from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Dict, Any

from app.core.database import get_db
from app.api.auth_router import get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.vendor import Vendor
from app.services.analytics_service import analytics_service

from app.models.settings import StoreSettings

router = APIRouter(prefix="/alerts", tags=["Live System Alerts"])

@router.get("/summary")
def get_alerts_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Consolidated real-time alert center for Navbar & Status monitoring.
    """
    # 1. Low stock alerts
    low_stock_products = db.query(Product).filter(
        Product.is_active == True,
        Product.stock_quantity <= Product.min_stock_alert
    ).limit(10).all()

    # 2. Outstanding vendor dues
    pending_vendors = db.query(Vendor).filter(
        Vendor.is_active == True,
        Vendor.outstanding_due > 0
    ).all()
    total_vendor_dues = sum(v.outstanding_due for v in pending_vendors)

    # 3. Dead stock & trapped capital (>1 Year / 365+ days stagnation matching Smart Advisor)
    cutoff_dead = datetime.utcnow() - timedelta(days=365)
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

    dead_stock_capital = round(float(dead_stock_totals.trapped_capital or 0.0), 2) if dead_stock_totals else 0.0
    dead_stock_count = int(dead_stock_totals.total_count or 0) if dead_stock_totals else 0

    # 4. Check Shop Foundation Anniversary based on StoreSettings.opening_date
    st = db.query(StoreSettings).first()
    shop_name = st.shop_name if st and st.shop_name else "Dolly Toys & Kids Wear"
    opening_date_str = st.opening_date if st and st.opening_date else "2002-01-01"
    
    opening_year = 2002
    opening_month = 1
    opening_day = 1
    
    try:
        if "-" in opening_date_str:
            parts = [int(p) for p in opening_date_str.split("-") if p.isdigit()]
            if len(parts) == 3:
                if parts[0] > 1000: # YYYY-MM-DD
                    opening_year, opening_month, opening_day = parts[0], parts[1], parts[2]
                else: # DD-MM-YYYY
                    opening_day, opening_month, opening_year = parts[0], parts[1], parts[2]
        elif "/" in opening_date_str:
            parts = [int(p) for p in opening_date_str.split("/") if p.isdigit()]
            if len(parts) == 3:
                if parts[0] > 1000:
                    opening_year, opening_month, opening_day = parts[0], parts[1], parts[2]
                else:
                    opening_day, opening_month, opening_year = parts[0], parts[1], parts[2]
    except Exception:
        pass

    is_anniversary = (ist_now.month == opening_month and ist_now.day == opening_day)
    years_passed = max(0, ist_now.year - opening_year)

    anniversary_info = {
        "is_anniversary_today": is_anniversary,
        "foundation_date": opening_date_str,
        "opening_year": opening_year,
        "years_passed": years_passed,
        "current_year": ist_now.year,
        "shop_name": shop_name,
        "title": f"🎉 Happy {years_passed}th Shop Anniversary! (Est. {opening_year})",
        "message": f"{shop_name} celebrates {years_passed} glorious years of success, trust, and customer smiles today! Established {opening_date_str} • Thank you for {opening_year}–{ist_now.year}."
    }

    total_alert_count = (
        (1 if is_anniversary else 0) +
        (1 if len(low_stock_products) > 0 else 0) +
        (1 if total_vendor_dues > 0 else 0) +
        (1 if dead_stock_count > 0 else 0)
    )

    return {
        "total_alert_count": total_alert_count,
        "anniversary": anniversary_info,
        "low_stock": {
            "count": len(low_stock_products),
            "items": [{"id": p.id, "name": p.name, "stock": p.stock_quantity, "min": p.min_stock_alert} for p in low_stock_products]
        },
        "vendor_dues": {
            "vendor_count": len(pending_vendors),
            "total_due_amount": round(total_vendor_dues, 2),
            "vendors": [{"id": v.id, "name": v.name, "due": v.outstanding_due} for v in pending_vendors[:5]]
        },
        "dead_stock": {
            "item_count": dead_stock_count,
            "trapped_capital": dead_stock_capital
        }
    }
