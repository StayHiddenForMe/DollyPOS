from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, func, case
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
from app.models.lost_demand import LostDemand, LostDemandStatus, LostDemandUrgency, ProcurementNote

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

class CreateProcurementNoteRequest(BaseModel):
    item_name: str
    quantity: Optional[int] = 1
    description: Optional[str] = None
    vendor_name: Optional[str] = None
    estimated_price: Optional[float] = 0.0
    priority: Optional[str] = "NORMAL" # LOW, NORMAL, HIGH, URGENT
    status: Optional[str] = "PENDING"  # PENDING, ORDERED, COMPLETED, CANCELLED

class UpdateProcurementNoteRequest(BaseModel):
    item_name: Optional[str] = None
    quantity: Optional[int] = None
    description: Optional[str] = None
    vendor_name: Optional[str] = None
    estimated_price: Optional[float] = None
    priority: Optional[str] = None
    status: Optional[str] = None

class UpdateProcurementNoteStatusRequest(BaseModel):
    status: str

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

    ordered_notes = db.query(ProcurementNote.item_name).filter(ProcurementNote.status == 'ORDERED').all()
    ordered_titles = {n[0] for n in ordered_notes if n[0]}

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

        item_title = f"{p.name} (Barcode: {p.barcode or p.sku or p.id})"
        is_ordered = (item_title in ordered_titles) or (p.name in ordered_titles)

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
            "mrp": p.mrp,
            "suggested_reorder_qty": suggested_qty,
            "estimated_cost": round(est_cost, 2),
            "vendor_code": v_code or "N/A",
            "is_ordered": is_ordered
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

# =======================================================================
# BUYING NOTES & PURCHASE WISHLIST ENDPOINTS (HOTKEY: F10)
# =======================================================================

@router.get("/notes")
def get_procurement_notes(
    status: Optional[str] = None,
    vendor: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all buying notes & purchase wishlists with real-time summary calculations.
    """
    query = db.query(ProcurementNote)
    if status and status != 'ALL':
        query = query.filter(ProcurementNote.status == status)
    if vendor and vendor != 'ALL':
        query = query.filter(ProcurementNote.vendor_name == vendor)
    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(or_(
            ProcurementNote.item_name.ilike(s),
            ProcurementNote.description.ilike(s),
            ProcurementNote.vendor_name.ilike(s)
        ))

    # Priority sorting: PENDING first, ORDERED second, COMPLETED third, CANCELLED last
    notes = query.order_by(
        case(
            (ProcurementNote.status == 'PENDING', 1),
            (ProcurementNote.status == 'ORDERED', 2),
            (ProcurementNote.status == 'COMPLETED', 3),
            else_=4
        ),
        case(
            (ProcurementNote.priority == 'URGENT', 1),
            (ProcurementNote.priority == 'HIGH', 2),
            (ProcurementNote.priority == 'NORMAL', 3),
            else_=4
        ),
        ProcurementNote.created_at.desc()
    ).all()

    total_notes = len(notes)
    pending_notes = sum(1 for n in notes if n.status == 'PENDING')
    ordered_notes = sum(1 for n in notes if n.status == 'ORDERED')
    completed_notes = sum(1 for n in notes if n.status == 'COMPLETED')
    total_units = sum(n.quantity for n in notes if n.status != 'CANCELLED')
    total_est_budget = sum((n.quantity * (n.estimated_price or 0.0)) for n in notes if n.status != 'CANCELLED')

    # Get distinct vendor list for filtering
    all_vendors = db.query(ProcurementNote.vendor_name).filter(ProcurementNote.vendor_name != None).distinct().all()
    vendor_list = sorted([v[0] for v in all_vendors if v[0]])

    # Map active products for quick linked restock
    prods = db.query(Product).filter(Product.is_active == True).all()
    prod_by_barcode = {p.barcode.lower(): p for p in prods if p.barcode}
    prod_by_sku = {p.sku.lower(): p for p in prods if p.sku}
    prod_by_name = {p.name.lower(): p for p in prods if p.name}
    prod_by_id = {p.id: p for p in prods}

    notes_result = []
    for n in notes:
        matched_prod = None
        if "(Barcode: " in n.item_name:
            try:
                bc = n.item_name.split("(Barcode: ")[1].split(")")[0].strip().lower()
                matched_prod = prod_by_barcode.get(bc) or prod_by_sku.get(bc)
                if not matched_prod and bc.isdigit():
                    matched_prod = prod_by_id.get(int(bc))
            except Exception:
                pass
        if not matched_prod:
            clean_name = n.item_name.split(" (Barcode:")[0].strip().lower()
            matched_prod = prod_by_name.get(clean_name)

        notes_result.append({
            "id": n.id,
            "item_name": n.item_name,
            "quantity": n.quantity,
            "description": n.description or "",
            "vendor_name": n.vendor_name or "",
            "estimated_price": n.estimated_price or 0.0,
            "total_estimated_cost": round(n.quantity * (n.estimated_price or 0.0), 2),
            "priority": n.priority,
            "status": n.status,
            "product_id": matched_prod.id if matched_prod else None,
            "product_name": matched_prod.name if matched_prod else n.item_name,
            "barcode": matched_prod.barcode if matched_prod else "",
            "current_stock": matched_prod.stock_quantity if matched_prod else 0,
            "purchase_price": (matched_prod.purchase_price if matched_prod and matched_prod.purchase_price else n.estimated_price) or 0.0,
            "selling_price": matched_prod.selling_price if matched_prod else 0.0,
            "mrp": matched_prod.mrp if matched_prod else 0.0,
            "created_at": n.created_at.strftime("%d-%m-%Y %I:%M %p") if n.created_at else "",
            "updated_at": n.updated_at.strftime("%d-%m-%Y %I:%M %p") if n.updated_at else ""
        })

    return {
        "notes": notes_result,
        "vendor_options": vendor_list,
        "summary": {
            "total_count": total_notes,
            "pending_count": pending_notes,
            "ordered_count": ordered_notes,
            "completed_count": completed_notes,
            "total_units": total_units,
            "total_estimated_budget": round(total_est_budget, 2)
        }
    }

@router.post("/notes")
def create_procurement_note(
    req: CreateProcurementNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new buying note or custom product purchase item.
    """
    if not req.item_name or not req.item_name.strip():
        raise HTTPException(status_code=400, detail="Item name is required")

    note = ProcurementNote(
        item_name=req.item_name.strip(),
        quantity=max(1, req.quantity or 1),
        description=req.description.strip() if req.description else None,
        vendor_name=req.vendor_name.strip() if req.vendor_name else None,
        estimated_price=max(0.0, req.estimated_price or 0.0),
        priority=(req.priority or "NORMAL").upper(),
        status=(req.status or "PENDING").upper()
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return {
        "success": True,
        "message": f"Added '{note.item_name}' (Qty: {note.quantity}) to Buying Notes",
        "note_id": note.id
    }

@router.put("/notes/{note_id}")
def update_procurement_note(
    note_id: int,
    req: UpdateProcurementNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates an existing buying note.
    """
    note = db.query(ProcurementNote).filter(ProcurementNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Buying note not found")

    if req.item_name is not None and req.item_name.strip():
        note.item_name = req.item_name.strip()
    if req.quantity is not None:
        note.quantity = max(1, req.quantity)
    if req.description is not None:
        note.description = req.description.strip() if req.description else None
    if req.vendor_name is not None:
        note.vendor_name = req.vendor_name.strip() if req.vendor_name else None
    if req.estimated_price is not None:
        note.estimated_price = max(0.0, req.estimated_price)
    if req.priority is not None:
        note.priority = req.priority.upper()
    if req.status is not None:
        note.status = req.status.upper()

    note.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": "Buying note updated successfully", "note_id": note.id}

@router.patch("/notes/{note_id}/status")
def update_procurement_note_status(
    note_id: int,
    req: UpdateProcurementNoteStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Quick status toggle (PENDING <-> ORDERED <-> COMPLETED <-> CANCELLED).
    """
    note = db.query(ProcurementNote).filter(ProcurementNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Buying note not found")

    note.status = req.status.upper()
    note.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": f"Updated status to {note.status}", "note_id": note.id}

@router.delete("/notes/{note_id}")
def delete_procurement_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes a buying note entry.
    """
    note = db.query(ProcurementNote).filter(ProcurementNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Buying note not found")

    db.delete(note)
    db.commit()
    return {"success": True, "message": "Buying note deleted successfully"}

@router.delete("/notes/clear/completed")
def clear_completed_procurement_notes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clears all completed and cancelled buying notes.
    """
    deleted_count = db.query(ProcurementNote).filter(
        ProcurementNote.status.in_(["COMPLETED", "CANCELLED"])
    ).delete(synchronize_session=False)
    db.commit()
    return {"success": True, "deleted_count": deleted_count, "message": f"Cleared {deleted_count} completed buying notes"}


class MarkOrderedRequest(BaseModel):
    product_id: int
    quantity: Optional[int] = 1
    vendor_name: Optional[str] = None
    estimated_price: Optional[float] = 0.0
    description: Optional[str] = None


@router.post("/mark-ordered")
def mark_product_ordered(
    req: MarkOrderedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Adds or updates a product in Buying Notes & Purchase Wishlist with status ORDERED.
    """
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    item_title = f"{product.name} (Barcode: {product.barcode or product.sku or product.id})"
    note = db.query(ProcurementNote).filter(
        ProcurementNote.item_name == item_title,
        ProcurementNote.status.in_(["PENDING", "ORDERED"])
    ).first()

    order_qty = max(1, req.quantity or 1)
    est_price = req.estimated_price if (req.estimated_price is not None and req.estimated_price > 0) else (product.purchase_price or 0.0)

    if note:
        note.status = "ORDERED"
        note.quantity = order_qty
        if req.vendor_name:
            note.vendor_name = req.vendor_name
        if est_price:
            note.estimated_price = est_price
        note.updated_at = datetime.utcnow()
    else:
        note = ProcurementNote(
            item_name=item_title,
            quantity=order_qty,
            description=req.description or f"Size: {product.size or 'N/A'}, Color: {product.color or 'N/A'}, Current Stock: {product.stock_quantity}",
            vendor_name=req.vendor_name or product.vendor_code or None,
            estimated_price=est_price,
            priority="HIGH",
            status="ORDERED",
            created_at=datetime.utcnow()
        )
        db.add(note)

    db.commit()
    db.refresh(note)
    return {
        "success": True,
        "message": f"'{product.name}' (Qty: {order_qty}) marked as ORDERED in Buying Notes",
        "note_id": note.id
    }


class QuickRestockRequest(BaseModel):
    product_id: int
    add_quantity: int
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None
    mrp: Optional[float] = None
    note_id: Optional[int] = None


@router.post("/quick-restock")
def quick_restock_product(
    req: QuickRestockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Directly adds restocked quantity to a product's inventory in the database,
    and optionally updates purchase price, selling price, and MRP.
    """
    if req.add_quantity <= 0:
        raise HTTPException(status_code=400, detail="Restock quantity must be greater than 0")

    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.stock_quantity += req.add_quantity
    if req.purchase_price is not None and req.purchase_price >= 0:
        product.purchase_price = req.purchase_price
    if req.selling_price is not None and req.selling_price >= 0:
        product.selling_price = req.selling_price
    if req.mrp is not None and req.mrp >= 0:
        product.mrp = req.mrp
    product.updated_at = datetime.utcnow()

    # If a specific note_id is provided, mark it COMPLETED
    if req.note_id:
        target_note = db.query(ProcurementNote).filter(ProcurementNote.id == req.note_id).first()
        if target_note:
            target_note.status = "COMPLETED"
            target_note.updated_at = datetime.utcnow()

    # If any buying note was ORDERED or PENDING for this product, mark it COMPLETED
    item_title = f"{product.name} (Barcode: {product.barcode or product.sku or product.id})"
    notes = db.query(ProcurementNote).filter(
        ProcurementNote.item_name == item_title,
        ProcurementNote.status.in_(["PENDING", "ORDERED"])
    ).all()
    for n in notes:
        n.status = "COMPLETED"
        n.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(product)
    return {
        "success": True,
        "message": f"Successfully restocked +{req.add_quantity} units of '{product.name}'. New stock: {product.stock_quantity}",
        "product_id": product.id,
        "new_stock": product.stock_quantity
    }

