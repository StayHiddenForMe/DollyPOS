from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from collections import defaultdict

from app.core.database import get_db
from app.api.auth_router import get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.vendor import Vendor
from app.models.lost_demand import LostDemand, LostDemandStatus, LostDemandUrgency

router = APIRouter(prefix="/procurement", tags=["Procurement & Smart Buying Planner"])

class CreateLostDemandRequest(BaseModel):
    item_description: str
    category_name: Optional[str] = None
    preferred_size: Optional[str] = None
    preferred_color: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    urgency: Optional[LostDemandUrgency] = LostDemandUrgency.NORMAL
    notes: Optional[str] = None

class UpdateLostDemandStatusRequest(BaseModel):
    status: LostDemandStatus

@router.get("/low-stock-sheet")
def get_low_stock_procurement_sheet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns an itemized procurement buying sheet of all low stock products,
    grouped by Vendor with vendor code, contact details, and suggested reorder quantities.
    """
    low_stock_prods = db.query(Product).options(joinedload(Product.category)).filter(
        Product.is_active == True,
        Product.stock_quantity <= Product.min_stock_alert
    ).order_by(Product.stock_quantity.asc()).all()

    vendors = db.query(Vendor).all()
    vendor_map = {v.vendor_code: v for v in vendors if v.vendor_code}
    vendor_name_map = {v.name.lower(): v for v in vendors}

    grouped_data = defaultdict(lambda: {
        "vendor_code": "GENERAL",
        "vendor_name": "General / Local Market Procurement",
        "vendor_phone": "N/A",
        "vendor_city": "Dhule",
        "total_items_count": 0,
        "total_estimated_budget": 0.0,
        "items": []
    })

    total_units_needed = 0
    total_budget_needed = 0.0

    for p in low_stock_prods:
        v_code = (p.vendor_code or "").strip()
        matched_vendor = vendor_map.get(v_code) or vendor_name_map.get(v_code.lower())

        group_key = matched_vendor.name if matched_vendor else (v_code or "Unassigned Vendor")
        group = grouped_data[group_key]
        if matched_vendor:
            group["vendor_code"] = matched_vendor.vendor_code or v_code
            group["vendor_name"] = matched_vendor.name
            group["vendor_phone"] = matched_vendor.phone or "N/A"
            group["vendor_city"] = matched_vendor.city or "Dhule"

        suggested_qty = max(6, (p.min_stock_alert * 3) - p.stock_quantity)
        est_cost = suggested_qty * p.purchase_price

        item_entry = {
            "product_id": p.id,
            "name": p.name,
            "barcode": p.barcode,
            "sku": p.sku,
            "size": p.size or "Standard",
            "color": p.color or "Standard",
            "category_name": p.category.name if p.category else "Kids Wear",
            "current_stock": p.stock_quantity,
            "min_stock_alert": p.min_stock_alert,
            "purchase_price": p.purchase_price,
            "selling_price": p.selling_price,
            "suggested_reorder_qty": suggested_qty,
            "estimated_cost": round(est_cost, 2),
            "vendor_code": v_code or "N/A"
        }

        group["items"].append(item_entry)
        group["total_items_count"] += 1
        group["total_estimated_budget"] = round(group["total_estimated_budget"] + est_cost, 2)

        total_units_needed += suggested_qty
        total_budget_needed += est_cost

    return {
        "total_low_stock_products": len(low_stock_prods),
        "total_units_to_order": total_units_needed,
        "total_procurement_budget": round(total_budget_needed, 2),
        "vendor_groups": list(grouped_data.values())
    }

@router.get("/lost-demand")
def get_lost_demand_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all logged customer requests for out-of-stock or missing items."""
    query = db.query(LostDemand)
    if status and status != "ALL":
        query = query.filter(LostDemand.status == status)

    logs = query.order_by(
        desc(LostDemand.request_count),
        desc(LostDemand.created_at)
    ).all()

    return [
        {
            "id": l.id,
            "item_description": l.item_description,
            "category_name": l.category_name or "Kids Wear",
            "preferred_size": l.preferred_size or "Any Size",
            "preferred_color": l.preferred_color or "Any Color",
            "customer_name": l.customer_name or "Walk-in Customer",
            "customer_phone": l.customer_phone or "N/A",
            "request_count": l.request_count,
            "urgency": l.urgency.value,
            "status": l.status.value,
            "notes": l.notes or "",
            "created_at": l.created_at.strftime("%d-%b-%Y %I:%M %p")
        }
        for l in logs
    ]

@router.post("/lost-demand")
def log_customer_lost_demand(
    req: CreateLostDemandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Logs when a customer leaves empty-handed or requests an item not in stock.
    If the exact item was already requested, it increments the demand count.
    """
    clean_desc = req.item_description.strip()
    if not clean_desc:
        raise HTTPException(status_code=400, detail="Item description is required")

    existing = db.query(LostDemand).filter(
        LostDemand.item_description.ilike(clean_desc),
        LostDemand.status == LostDemandStatus.PENDING_PROCUREMENT
    ).first()

    if existing:
        existing.request_count += 1
        if req.customer_name and not existing.customer_name:
            existing.customer_name = req.customer_name
        if req.customer_phone and not existing.customer_phone:
            existing.customer_phone = req.customer_phone
        if req.notes:
            existing.notes = f"{existing.notes or ''}; {req.notes}".strip("; ")
        db.commit()
        db.refresh(existing)
        return {
            "success": True,
            "message": f"Updated request count to {existing.request_count} customers for '{existing.item_description}'",
            "id": existing.id,
            "request_count": existing.request_count
        }

    new_log = LostDemand(
        item_description=clean_desc,
        category_name=req.category_name,
        preferred_size=req.preferred_size,
        preferred_color=req.preferred_color,
        customer_name=req.customer_name,
        customer_phone=req.customer_phone,
        request_count=1,
        urgency=req.urgency or LostDemandUrgency.NORMAL,
        status=LostDemandStatus.PENDING_PROCUREMENT,
        notes=req.notes,
        created_at=datetime.utcnow()
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    return {
        "success": True,
        "message": f"Successfully logged customer demand for '{clean_desc}'. Ready for market purchasing.",
        "id": new_log.id
    }

@router.put("/lost-demand/{demand_id}/status")
def update_lost_demand_status(
    demand_id: int,
    req: UpdateLostDemandStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates status to ORDERED_WITH_VENDOR or FULFILLED."""
    log = db.query(LostDemand).filter(LostDemand.id == demand_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Lost demand record not found")

    log.status = req.status
    db.commit()
    return {"success": True, "message": f"Updated status to {req.status.value}", "id": log.id}

@router.delete("/lost-demand/{demand_id}")
def delete_lost_demand(
    demand_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a customer demand entry."""
    log = db.query(LostDemand).filter(LostDemand.id == demand_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Record not found")

    db.delete(log)
    db.commit()
    return {"success": True, "message": "Record removed"}

@router.get("/seasonal-checklist")
def get_upcoming_seasonal_buying_checklist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cross-references the Perpetual Festival Calendar with store catalog products
    to build an actionable pre-festival purchasing and stocking list.
    """
    now = datetime.utcnow()
    # Upcoming retail events
    events = [
        {"name": "Ganesh Chaturthi", "season_tag": "Ganesh", "window": "Festive Ethnic Wear & Modak Toys", "lead_days": 18},
        {"name": "Diwali Festival of Lights", "season_tag": "Diwali", "window": "Premium Party Dresses, Sherwanis, Gifts & Lights", "lead_days": 65},
        {"name": "Navratri & Dandiya", "season_tag": "Choli", "window": "Ghagra Cholis, Kediyu & Dandiya Sets", "lead_days": 40},
        {"name": "Monsoon Season", "season_tag": "Monsoon", "window": "Raincoats, Gumboots & Umbrellas", "lead_days": 5},
        {"name": "Holi Festival of Colors", "season_tag": "Holi", "window": "Pichkaris, Water Guns & White T-Shirts", "lead_days": 190},
        {"name": "Winter Woolen Season", "season_tag": "Winter", "window": "Sweaters, Jackets, Caps & Thermals", "lead_days": 90}
    ]

    checklist = []
    for ev in events:
        tag = ev["season_tag"]
        matching_prods = db.query(Product).filter(
            Product.is_active == True,
            or_(
                Product.season.ilike(f"%{tag}%"),
                Product.name.ilike(f"%{tag}%")
            )
        ).all()

        total_stock = sum(p.stock_quantity for p in matching_prods)
        low_stock_items = [p for p in matching_prods if p.stock_quantity <= p.min_stock_alert]

        checklist.append({
            "event_name": ev["name"],
            "focus_products": ev["window"],
            "approx_days_left": ev["lead_days"],
            "matched_catalog_skus": len(matching_prods),
            "total_units_in_stock": total_stock,
            "low_stock_skus_count": len(low_stock_items),
            "readiness_status": "Ready in Stock" if total_stock >= 100 else ("Action Required - Low Stock" if total_stock < 30 else "Moderate Stock"),
            "sample_items": [
                {
                    "name": p.name,
                    "size": p.size or "Std",
                    "stock": p.stock_quantity,
                    "price": p.selling_price
                }
                for p in matching_prods[:5]
            ]
        })

    return {
        "timestamp": now.isoformat(),
        "seasonal_events": checklist
    }
