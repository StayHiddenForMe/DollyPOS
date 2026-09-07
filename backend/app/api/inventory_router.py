from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc, func, case
from typing import List, Optional
from datetime import datetime
import io
import pandas as pd
from pydantic import BaseModel

from app.core.database import get_db
from app.api.auth_router import get_current_user, require_owner
from app.models.user import User, UserRole
from app.models.product import Product
from app.models.category import Category, Subcategory
from app.models.product_price_history import ProductPriceHistory
from app.schemas.product_schema import (
    ProductCreate, ProductUpdate, ProductOut, ProductSearchResult,
    ProductMultiSizeCreate, ProductPriceHistoryOut, MarkDamagedRequest, RestockDamagedRequest
)
from app.core.audit import log_action
from app.services.analytics_service import analytics_service

router = APIRouter(prefix="/inventory", tags=["Inventory Management"])

class SpeedDialToggleRequest(BaseModel):
    is_speed_dial: bool
    speed_dial_code: Optional[str] = None
    speed_dial_color: Optional[str] = "#3B82F6"

@router.get("/check-speed-dial/{code}")
def check_speed_dial_unique(
    code: str,
    exclude_product_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Checks if a speed dial code is already assigned to avoid cashier conflicts."""
    clean_code = code.strip().upper()
    query = db.query(Product).filter(
        Product.is_speed_dial == True,
        Product.is_active == True,
        Product.speed_dial_code.ilike(clean_code)
    )
    if exclude_product_id:
        query = query.filter(Product.id != exclude_product_id)
        
    existing = query.first()
    if existing:
        return {
            "available": False,
            "message": f"Speed dial '{clean_code}' is already assigned to: {existing.name} (Size: {existing.size or 'N/A'})"
        }
    return {"available": True, "message": f"Speed dial '{clean_code}' is available."}

@router.get("/search", response_model=List[ProductOut])
def fast_search_products(
    q: str = Query("", description="Barcode, SKU, Shortcode, Name, Size, or Color"),
    limit: int = 30,
    db: Session = Depends(get_db)
):
    clean_q = q.strip()
    if not clean_q:
        # Return newest products added to inventory first
        latest_products = db.query(Product).options(
            joinedload(Product.category),
            joinedload(Product.subcategory)
        ).filter(
            Product.is_active == True
        ).order_by(Product.id.desc()).limit(limit).all()

        results = []
        for p in latest_products:
            p_out = ProductOut.model_validate(p)
            p_out.category_name = p.category.name if p.category else None
            p_out.subcategory_name = p.subcategory.name if p.subcategory else None
            results.append(p_out)
        return results

    search_term = f"%{clean_q}%"
    prefix_term = f"{clean_q}%"

    # Single-pass ultra-fast indexed search query with SQL ranking
    products = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.subcategory)
    ).filter(
        Product.is_active == True,
        or_(
            Product.speed_dial_code.ilike(clean_q),
            Product.barcode.ilike(prefix_term),
            Product.barcode.ilike(search_term),
            Product.name.ilike(prefix_term),
            Product.name.ilike(search_term),
            Product.sku.ilike(prefix_term),
            Product.speed_dial_code.ilike(search_term),
            Product.size.ilike(clean_q),
            Product.color.ilike(clean_q),
            Product.brand.ilike(search_term)
        )
    ).order_by(
        case(
            (func.upper(Product.speed_dial_code) == clean_q.upper(), 0),
            (Product.barcode == clean_q, 1),
            (Product.name.ilike(prefix_term), 2),
            else_=3
        ),
        Product.id.desc()
    ).limit(limit).all()
    
    results = []
    for p in products:
        p_out = ProductOut.model_validate(p)
        p_out.category_name = p.category.name if p.category else None
        p_out.subcategory_name = p.subcategory.name if p.subcategory else None
        results.append(p_out)
    return results

@router.get("/barcode/{barcode_val}", response_model=ProductOut)
def get_product_by_barcode_or_code(barcode_val: str, db: Session = Depends(get_db)):
    clean_val = barcode_val.strip()
    p = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.subcategory)
    ).filter(
        or_(
            Product.barcode == clean_val,
            Product.speed_dial_code.ilike(clean_val)
        ),
        Product.is_active == True
    ).first()
    
    if not p:
        raise HTTPException(status_code=404, detail=f"Product with barcode / code '{barcode_val}' not found")
    
    p_out = ProductOut.model_validate(p)
    p_out.category_name = p.category.name if p.category else None
    p_out.subcategory_name = p.subcategory.name if p.subcategory else None
    return p_out

@router.get("/speed-dials", response_model=List[ProductOut])
def get_speed_dial_products(db: Session = Depends(get_db)):
    products = db.query(Product).filter(
        Product.is_speed_dial == True,
        Product.is_active == True
    ).order_by(Product.name).all()

    return [ProductOut.model_validate(p) for p in products]

@router.get("", response_model=ProductSearchResult)
def list_products(
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    size: Optional[str] = None,
    color: Optional[str] = None,
    low_stock_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.subcategory)
    ).filter(Product.is_active == True)

    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Product.barcode.ilike(s),
                Product.speed_dial_code.ilike(s),
                Product.sku.ilike(s),
                Product.name.ilike(s),
                Product.manufacture_code.ilike(s),
                Product.vendor_code.ilike(s),
                Product.brand.ilike(s)
            )
        )
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if size:
        query = query.filter(Product.size.ilike(f"%{size}%"))
    if color:
        query = query.filter(Product.color.ilike(f"%{color}%"))
    if low_stock_only:
        query = query.filter(Product.stock_quantity <= Product.min_stock_alert)

    total = query.count()
    products = query.order_by(desc(Product.id)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for p in products:
        p_out = ProductOut.model_validate(p)
        p_out.category_name = p.category.name if p.category else None
        p_out.subcategory_name = p.subcategory.name if p.subcategory else None
        items.append(p_out)

    return ProductSearchResult(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )

@router.post("", response_model=ProductOut)
def create_product(
    product_in: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(Product).filter(Product.barcode == product_in.barcode).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Barcode '{product_in.barcode}' already exists. Please use a unique barcode.")

    if product_in.speed_dial_code and product_in.speed_dial_code.strip():
        clean_code = product_in.speed_dial_code.strip().upper()
        dup_code = db.query(Product).filter(Product.is_active == True, func.upper(Product.speed_dial_code) == clean_code).first()
        if dup_code:
            raise HTTPException(status_code=400, detail=f"Speed dial code '{clean_code}' is already assigned to '{dup_code.name}'")

    margin_percent = product_in.margin_percent
    if margin_percent == 0 and product_in.purchase_price > 0 and product_in.selling_price > 0:
        margin_percent = round(((product_in.selling_price - product_in.purchase_price) / product_in.purchase_price) * 100, 2)

    product_dict = product_in.model_dump(exclude={"category_name", "subcategory_name"})
    product_dict["margin_percent"] = margin_percent
    product = Product(**product_dict)
    
    db.add(product)
    db.flush()

    history = ProductPriceHistory(
        product_id=product.id,
        old_purchase_price=0.0,
        new_purchase_price=product.purchase_price,
        old_selling_price=0.0,
        new_selling_price=product.selling_price,
        old_mrp=0.0,
        new_mrp=product.mrp,
        reason="Initial Product Setup",
        changed_by=current_user.full_name or current_user.username
    )
    db.add(history)

    db.commit()
    db.refresh(product)
    
    log_action(db, user_id=current_user.id, action_type="CREATE_PRODUCT", entity="PRODUCT", entity_id=str(product.id), details={"name": product.name, "barcode": product.barcode})
    return ProductOut.model_validate(product)

@router.post("/multi-size", response_model=List[ProductOut])
def create_multi_size_products(
    payload: ProductMultiSizeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not payload.sizes:
        raise HTTPException(status_code=400, detail="Please select at least one size")

    created_products = []
    base_timestamp = int(datetime.utcnow().timestamp())

    margin_percent = 0.0
    if payload.purchase_price > 0 and payload.selling_price > 0:
        margin_percent = round(((payload.selling_price - payload.purchase_price) / payload.purchase_price) * 100, 2)

    user_base_barcode = payload.base_barcode.strip() if (payload.base_barcode and payload.base_barcode.strip()) else None

    for idx, sz in enumerate(payload.sizes):
        if user_base_barcode:
            if idx == 0 and len(payload.sizes) == 1:
                barcode_val = user_base_barcode
            elif len(user_base_barcode) <= 10 and user_base_barcode.isdigit():
                barcode_val = f"{user_base_barcode}{idx:02d}"
            else:
                barcode_val = f"{user_base_barcode}-{sz}"
        else:
            barcode_val = f"890{base_timestamp}{idx:02d}"

        # Check unique barcode collision
        existing = db.query(Product).filter(Product.barcode == barcode_val).first()
        if existing:
            barcode_val = f"{barcode_val}_{base_timestamp % 1000}"

        sku_val = f"DLY-{sz}-{base_timestamp}"
        speed_code = f"{payload.speed_dial_code}-{sz}" if (payload.speed_dial_code and len(payload.sizes) > 1) else payload.speed_dial_code

        prod = Product(
            barcode=barcode_val,
            sku=sku_val,
            name=f"{payload.name}",
            category_id=payload.category_id,
            subcategory_id=payload.subcategory_id,
            vendor_code=payload.vendor_code,
            brand=payload.brand,
            gender=payload.gender,
            age_group=payload.age_group,
            size=sz,
            color=payload.color,
            fabric=payload.fabric,
            season=payload.season,
            purchase_price=payload.purchase_price,
            selling_price=payload.selling_price,
            mrp=payload.mrp or 0.0,
            gst_percent=payload.gst_percent,
            margin_percent=margin_percent,
            stock_quantity=payload.stock_per_size,
            min_stock_alert=payload.min_stock_alert,
            is_speed_dial=payload.is_speed_dial,
            speed_dial_code=speed_code,
            speed_dial_color=payload.speed_dial_color,
            is_active=True
        )
        db.add(prod)
        db.flush()

        history = ProductPriceHistory(
            product_id=prod.id,
            old_purchase_price=0.0,
            new_purchase_price=prod.purchase_price,
            old_selling_price=0.0,
            new_selling_price=prod.selling_price,
            old_mrp=0.0,
            new_mrp=prod.mrp,
            reason="Multi-size setup",
            changed_by=current_user.full_name or current_user.username
        )
        db.add(history)
        created_products.append(prod)

    db.commit()
    for p in created_products:
        db.refresh(p)

    log_action(db, user_id=current_user.id, action_type="CREATE_MULTI_SIZE_PRODUCT", entity="PRODUCT", details={"count": len(created_products), "name": payload.name})
    return [ProductOut.model_validate(p) for p in created_products]

@router.get("/{product_id}/price-history", response_model=List[ProductPriceHistoryOut])
def get_product_price_history(product_id: int, db: Session = Depends(get_db)):
    return db.query(ProductPriceHistory).filter(ProductPriceHistory.product_id == product_id).order_by(desc(ProductPriceHistory.created_at)).all()

@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product_in.model_dump(exclude_unset=True)
    reason = update_data.pop("price_change_reason", "Price Update")
    
    if "barcode" in update_data and update_data["barcode"] != product.barcode:
        existing = db.query(Product).filter(Product.barcode == update_data["barcode"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Barcode already assigned to another product")

    new_dial_code = update_data.get("speed_dial_code")
    if new_dial_code and new_dial_code.strip() and new_dial_code.strip().upper() != (product.speed_dial_code or "").upper():
        clean_code = new_dial_code.strip().upper()
        dup = db.query(Product).filter(Product.is_active == True, Product.id != product.id, func.upper(Product.speed_dial_code) == clean_code).first()
        if dup:
            raise HTTPException(status_code=400, detail=f"Speed dial code '{clean_code}' is already assigned to '{dup.name}'")
        update_data["speed_dial_code"] = clean_code

    p_price_old = product.purchase_price
    s_price_old = product.selling_price
    mrp_old = product.mrp

    p_price = update_data.get("purchase_price", product.purchase_price)
    s_price = update_data.get("selling_price", product.selling_price)
    mrp_new = update_data.get("mrp", product.mrp)

    if p_price > 0 and s_price > 0:
        update_data["margin_percent"] = round(((s_price - p_price) / p_price) * 100, 2)

    price_changed = (p_price != p_price_old) or (s_price != s_price_old) or (mrp_new != mrp_old)

    for field, value in update_data.items():
        setattr(product, field, value)

    if price_changed:
        history = ProductPriceHistory(
            product_id=product.id,
            old_purchase_price=p_price_old,
            new_purchase_price=p_price,
            old_selling_price=s_price_old,
            new_selling_price=s_price,
            old_mrp=mrp_old,
            new_mrp=mrp_new,
            reason=reason,
            changed_by=current_user.full_name or current_user.username
        )
        db.add(history)

    product.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(product)

    log_action(db, user_id=current_user.id, action_type="UPDATE_PRODUCT", entity="PRODUCT", entity_id=str(product.id))
    return ProductOut.model_validate(product)

@router.put("/{product_id}/speed-dial", response_model=ProductOut)
def toggle_product_speed_dial(
    product_id: int,
    req: SpeedDialToggleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if req.speed_dial_code and req.speed_dial_code.strip():
        clean_code = req.speed_dial_code.strip().upper()
        dup = db.query(Product).filter(Product.is_active == True, Product.id != product.id, func.upper(Product.speed_dial_code) == clean_code).first()
        if dup:
            raise HTTPException(status_code=400, detail=f"Speed dial code '{clean_code}' is already assigned to '{dup.name}'")
        product.speed_dial_code = clean_code

    product.is_speed_dial = req.is_speed_dial
    if req.speed_dial_color:
        product.speed_dial_color = req.speed_dial_color

    db.commit()
    db.refresh(product)
    return ProductOut.model_validate(product)

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_active = False
    db.commit()
    log_action(db, user_id=current_user.id, action_type="DELETE_PRODUCT", entity="PRODUCT", entity_id=str(product.id))
    return {"message": "Product deactivated successfully"}

# --- Damaged & Defective Products Section ---

@router.get("/damaged-products")
def get_damaged_products(db: Session = Depends(get_db)):
    damaged = db.query(Product).options(joinedload(Product.category)).filter(
        Product.damaged_quantity > 0,
        Product.is_active == True
    ).all()

    total_loss = sum(p.damaged_quantity * p.purchase_price for p in damaged)
    total_qty = sum(p.damaged_quantity for p in damaged)

    items = []
    for p in damaged:
        items.append({
            "id": p.id,
            "name": p.name,
            "barcode": p.barcode,
            "size": p.size,
            "color": p.color,
            "category_name": p.category.name if p.category else "",
            "damaged_quantity": p.damaged_quantity,
            "cost_price": p.purchase_price,
            "selling_price": p.selling_price,
            "loss_value": round(p.damaged_quantity * p.purchase_price, 2)
        })

    return {
        "items": items,
        "total_damaged_items_count": len(damaged),
        "total_damaged_quantity": total_qty,
        "total_trapped_loss": round(total_loss, 2)
    }

@router.post("/mark-damaged")
def mark_product_damaged(
    req: MarkDamagedRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    product.stock_quantity = max(0, product.stock_quantity - req.quantity)
    product.damaged_quantity += req.quantity

    db.commit()
    db.refresh(product)
    log_action(db, user_id=current_user.id, action_type="MARK_DAMAGED", entity="PRODUCT", entity_id=str(product.id), details={"qty": req.quantity, "reason": req.reason})
    return {"message": f"Marked {req.quantity} pcs of '{product.name}' as damaged/defective.", "damaged_quantity": product.damaged_quantity, "stock_quantity": product.stock_quantity}

@router.post("/restock-damaged")
def restock_damaged_product(
    req: RestockDamagedRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restores/recovers quantity from damaged pool back into active saleable inventory."""
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    if req.quantity > product.damaged_quantity:
        raise HTTPException(status_code=400, detail=f"Cannot restock {req.quantity} pcs. Only {product.damaged_quantity} pcs are in damaged stock.")

    product.damaged_quantity -= req.quantity
    product.stock_quantity += req.quantity

    db.commit()
    db.refresh(product)
    log_action(db, user_id=current_user.id, action_type="RESTOCK_DAMAGED", entity="PRODUCT", entity_id=str(product.id), details={"qty": req.quantity, "reason": req.reason})
    return {"message": f"Successfully recovered and restocked {req.quantity} pcs of '{product.name}' into active inventory!", "damaged_quantity": product.damaged_quantity, "stock_quantity": product.stock_quantity}

@router.get("/dead-stock")
def get_dead_stock(days: int = 60, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return analytics_service.get_dead_stock(db, days=days)

@router.get("/export-excel")
def export_inventory_excel(
    category_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Exports full active stock or filtered category stock to Excel (.xlsx)
    with all product attributes for easy bulk edits and re-importing.
    """
    query = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.subcategory)
    ).filter(Product.is_active == True)

    if category_id:
        query = query.filter(Product.category_id == category_id)

    products = query.order_by(Product.name).all()

    data = []
    for p in products:
        data.append({
            "Barcode": p.barcode,
            "Product Name": p.name,
            "Category": p.category.name if p.category else "",
            "Subcategory": p.subcategory.name if p.subcategory else "",
            "Size": p.size or "",
            "Color": p.color or "",
            "Fabric": p.fabric or "",
            "Season / Festival": p.season or "",
            "Vendor Code": p.vendor_code or "",
            "Speed Dial Code": p.speed_dial_code or "",
            "Cost Price (₹)": p.purchase_price,
            "Selling Price (₹)": p.selling_price,
            "MRP (₹)": p.mrp or p.selling_price,
            "Margin (%)": p.margin_percent,
            "Stock Quantity": p.stock_quantity,
            "Min Alert Qty": p.min_stock_alert,
            "GST (%)": p.gst_percent
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Inventory Catalog')
    output.seek(0)

    filename = f"DollyToys_Stock_{'Category_' + str(category_id) if category_id else 'All_Inventory'}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/import-excel")
async def import_inventory_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Imports products from Excel (.xlsx / .xls) or CSV into active inventory catalog."""
    contents = await file.read()
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")

    # Normalize column headers
    df.columns = [str(c).strip().lower().replace(" ", "_").replace("_(₹)", "").replace("(%)", "").replace("(rs)", "").replace("(inr)", "").replace("/", "_") for c in df.columns]

    created_count = 0
    updated_count = 0

    # Cache existing categories
    cats = db.query(Category).all()
    cat_map = {c.name.lower().strip(): c.id for c in cats}

    for _, row in df.iterrows():
        barcode = str(row.get("barcode", "")).strip()
        if not barcode or barcode.lower() == 'nan':
            barcode = f"890{int(datetime.utcnow().timestamp() * 1000) % 1000000000:09d}"

        name = str(row.get("product_name", row.get("name", row.get("item_name", "")))).strip()
        if not name or name.lower() == 'nan':
            continue

        cat_name = str(row.get("category", "")).strip()
        cat_id = None
        if cat_name and cat_name.lower() != 'nan':
            c_key = cat_name.lower().strip()
            if c_key in cat_map:
                cat_id = cat_map[c_key]
            else:
                # Auto-create missing category
                new_cat = Category(name=cat_name.title())
                db.add(new_cat)
                db.flush()
                cat_map[c_key] = new_cat.id
                cat_id = new_cat.id

        size = str(row.get("size", "")).strip()
        if size.lower() == 'nan': size = None

        color = str(row.get("color", "")).strip()
        if color.lower() == 'nan': color = None

        fabric = str(row.get("fabric", "")).strip()
        if fabric.lower() == 'nan': fabric = None

        vendor_code = str(row.get("vendor_code", row.get("vendor", ""))).strip()
        if vendor_code.lower() == 'nan': vendor_code = None

        season = str(row.get("season___festival", row.get("season", row.get("festival", "")))).strip()
        if season.lower() == 'nan': season = None

        speed_dial = str(row.get("speed_dial_code", row.get("speed_dial", ""))).strip()
        if speed_dial.lower() == 'nan': speed_dial = None

        def safe_float(v, default=0.0):
            try:
                val = float(v)
                return 0.0 if pd.isna(val) else val
            except (ValueError, TypeError):
                return default

        def safe_int(v, default=0):
            try:
                val = int(float(v))
                return 0 if pd.isna(val) else val
            except (ValueError, TypeError):
                return default

        purchase_price = safe_float(row.get("cost_price", row.get("purchase_price", row.get("cost", 0.0))))
        selling_price = safe_float(row.get("selling_price", row.get("price", 0.0)))
        mrp = safe_float(row.get("mrp", selling_price))
        stock_qty = safe_int(row.get("stock_quantity", row.get("stock", row.get("qty", 0))))
        min_alert = safe_int(row.get("min_alert_qty", row.get("min_stock_alert", 3)), default=3)
        gst = safe_float(row.get("gst", row.get("gst_percent", 0.0)))

        margin_percent = round(((selling_price - purchase_price) / purchase_price * 100), 2) if purchase_price > 0 else 0.0

        existing = db.query(Product).filter(Product.barcode == barcode).first()
        if existing:
            existing.name = name
            if cat_id: existing.category_id = cat_id
            if size: existing.size = size
            if color: existing.color = color
            if fabric: existing.fabric = fabric
            if vendor_code: existing.vendor_code = vendor_code
            if season: existing.season = season
            if speed_dial:
                existing.speed_dial_code = speed_dial
                existing.is_speed_dial = True
            existing.purchase_price = purchase_price
            existing.selling_price = selling_price
            existing.mrp = mrp
            existing.stock_quantity = stock_qty
            existing.min_stock_alert = min_alert
            existing.gst_percent = gst
            existing.margin_percent = margin_percent
            updated_count += 1
        else:
            prod = Product(
                barcode=barcode,
                sku=str(row.get("sku", f"DLY-{barcode[-6:]}")),
                name=name,
                category_id=cat_id,
                size=size,
                color=color,
                fabric=fabric,
                vendor_code=vendor_code,
                season=season,
                speed_dial_code=speed_dial,
                is_speed_dial=bool(speed_dial),
                purchase_price=purchase_price,
                selling_price=selling_price,
                mrp=mrp,
                gst_percent=gst,
                margin_percent=margin_percent,
                stock_quantity=stock_qty,
                min_stock_alert=min_alert,
                is_active=True
            )
            db.add(prod)
            created_count += 1

    db.commit()
    log_action(db, user_id=current_user.id, action_type="IMPORT_INVENTORY_EXCEL", entity="PRODUCT", details={"created": created_count, "updated": updated_count})
    return {
        "message": f"Successfully processed Stock Sheet: Added {created_count} new products, updated {updated_count} existing products.",
        "created_count": created_count,
        "updated_count": updated_count
    }

