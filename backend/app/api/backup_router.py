import os
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.database import get_db
from app.api.auth_router import require_owner
from app.models.user import User
from app.models.product import Product
from app.models.category import Category, Subcategory
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.settings import StoreSettings
from app.services.backup_service import backup_service
from app.config import settings as app_settings

router = APIRouter(prefix="/backup", tags=["Database Backup & Safety"])

class BackupConfigRequest(BaseModel):
    backup_path: str
    auto_backup: bool = True
    backup_frequency: str = "MONTHLY"

@router.get("/status")
def get_backup_status(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """
    Returns the backup configuration, target folder path, auto-backup status,
    and runs monthly check automatically.
    """
    store_settings = db.query(StoreSettings).first()
    target_dir = backup_service.get_backup_directory(db)
    
    # Run monthly auto-backup check
    auto_res = backup_service.check_and_run_monthly_auto_backup(db)
    
    # Check existing files
    backups = []
    if os.path.exists(target_dir):
        for f in os.listdir(target_dir):
            if f.endswith(".json") or f.endswith(".sql") or f.endswith(".backup"):
                fpath = os.path.join(target_dir, f)
                size_kb = round(os.path.getsize(fpath) / 1024, 2)
                mtime = os.path.getmtime(fpath)
                backups.append({
                    "filename": f,
                    "path": fpath,
                    "size_kb": size_kb,
                    "created_timestamp": mtime,
                    "is_auto_monthly": "AutoMonthly" in f
                })
        backups.sort(key=lambda x: x["created_timestamp"], reverse=True)

    return {
        "auto_backup_enabled": store_settings.auto_backup if store_settings else True,
        "backup_frequency": store_settings.backup_frequency if store_settings else "MONTHLY",
        "backup_directory": target_dir,
        "monthly_check": auto_res,
        "total_backups_found": len(backups),
        "backups": backups
    }

@router.post("/save-config")
def save_backup_config(
    req: BackupConfigRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Saves custom backup path and auto-backup toggle preference."""
    store_settings = db.query(StoreSettings).first()
    if not store_settings:
        store_settings = StoreSettings()
        db.add(store_settings)

    clean_path = req.backup_path.strip()
    try:
        os.makedirs(clean_path, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot create or access directory '{clean_path}': {str(e)}")

    store_settings.backup_path = clean_path
    store_settings.auto_backup = req.auto_backup
    store_settings.backup_frequency = req.backup_frequency or "MONTHLY"
    db.commit()

    return {
        "success": True,
        "message": f"Backup directory set to: {clean_path}",
        "backup_path": clean_path,
        "auto_backup": store_settings.auto_backup
    }

@router.post("/create")
def create_instant_backup(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Triggers an instant full database JSON snapshot directly to the configured backup folder."""
    result = backup_service.create_database_backup(db)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result

@router.get("/list")
def list_existing_backups(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    target_dir = backup_service.get_backup_directory(db)
    
    if not os.path.exists(target_dir):
        return {"backup_directory": target_dir, "backups": []}

    backups = []
    for f in os.listdir(target_dir):
        if f.endswith(".sql") or f.endswith(".backup") or f.endswith(".json"):
            fpath = os.path.join(target_dir, f)
            size_kb = round(os.path.getsize(fpath) / 1024, 2)
            mtime = os.path.getmtime(fpath)
            backups.append({
                "filename": f,
                "path": fpath,
                "size_kb": size_kb,
                "created_timestamp": mtime,
                "is_auto_monthly": "AutoMonthly" in f
            })
            
    backups.sort(key=lambda x: x["created_timestamp"], reverse=True)
    return {"backup_directory": target_dir, "backups": backups}

@router.get("/download/{filename}")
def download_backup_file(
    filename: str,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    target_dir = backup_service.get_backup_directory(db)
    clean_filename = os.path.basename(filename)
    fpath = os.path.join(target_dir, clean_filename)

    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="Backup file not found")

    return FileResponse(
        path=fpath,
        filename=clean_filename,
        media_type="application/octet-stream"
    )

@router.get("/export-full-json")
def export_database_json(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Generates and downloads a complete portable JSON dump of all products, barcodes, customers, vendors."""
    target_dir = backup_service.get_backup_directory(db)
    res = backup_service.create_database_backup(db, custom_path=target_dir)
    
    if not res.get("success"):
        raise HTTPException(status_code=500, detail="Failed to create backup file.")

    return FileResponse(
        path=res["file_path"],
        filename=res["file_name"],
        media_type="application/json"
    )

@router.post("/import-full-json")
async def import_database_json(
    file: UploadFile = File(...),
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Restores database from portable JSON backup file."""
    contents = await file.read()
    try:
        data = json.loads(contents)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON backup file.")

    imported_products = 0
    imported_customers = 0
    imported_vendors = 0
    imported_expenses = 0

    # 1. Restore Store Settings
    if data.get("store_settings"):
        st_data = data["store_settings"]
        st = db.query(StoreSettings).first()
        if not st:
            st = StoreSettings()
            db.add(st)
        for k, v in st_data.items():
            if hasattr(st, k) and v is not None:
                setattr(st, k, v)

    # 2. Restore Categories & Subcategories
    for c_data in data.get("categories", []):
        cat = db.query(Category).filter(Category.name == c_data.get("name")).first()
        if not cat:
            cat = Category(name=c_data.get("name"))
            db.add(cat)
            db.commit()
            db.refresh(cat)
        for sc_data in c_data.get("subcategories", []):
            sc = db.query(Subcategory).filter(Subcategory.name == sc_data.get("name"), Subcategory.category_id == cat.id).first()
            if not sc:
                sc = Subcategory(name=sc_data.get("name"), category_id=cat.id)
                db.add(sc)

    # 3. Restore Vendors
    for v in data.get("vendors", []):
        existing = db.query(Vendor).filter(Vendor.phone == v.get("phone")).first()
        if not existing:
            vend = Vendor(
                vendor_code=v.get("vendor_code"),
                name=v.get("name"),
                company_name=v.get("company_name"),
                phone=v.get("phone"),
                city=v.get("city"),
                outstanding_due=v.get("outstanding_due", 0.0),
                notes=v.get("notes"),
                bank_name=v.get("bank_name"),
                bank_account_no=v.get("bank_account_no"),
                bank_ifsc=v.get("bank_ifsc")
            )
            db.add(vend)
            imported_vendors += 1

    # 4. Restore Customers
    for c in data.get("customers", []):
        existing = db.query(Customer).filter(Customer.phone == c.get("phone")).first()
        if not existing:
            cust = Customer(
                name=c.get("name"),
                phone=c.get("phone"),
                city=c.get("city", "Dhule"),
                credit_balance=c.get("credit_balance", 0.0),
                total_spend=c.get("total_spend", 0.0),
                visit_count=c.get("visit_count", 0)
            )
            db.add(cust)
            imported_customers += 1

    # 5. Restore Products
    for p in data.get("products", []):
        existing = db.query(Product).filter(Product.barcode == p.get("barcode")).first()
        if not existing:
            prod = Product(
                barcode=p.get("barcode"),
                sku=p.get("sku"),
                name=p.get("name"),
                category_id=p.get("category_id"),
                subcategory_id=p.get("subcategory_id"),
                vendor_code=p.get("vendor_code"),
                brand=p.get("brand"),
                size=p.get("size"),
                color=p.get("color"),
                purchase_price=p.get("purchase_price", 0.0),
                selling_price=p.get("selling_price", 0.0),
                mrp=p.get("mrp", 0.0),
                margin_percent=p.get("margin_percent", 0.0),
                stock_quantity=p.get("stock_quantity", 0),
                damaged_quantity=p.get("damaged_quantity", 0),
                min_stock_alert=p.get("min_stock_alert", 3),
                speed_dial_code=p.get("speed_dial_code"),
                is_speed_dial=p.get("is_speed_dial", False),
                is_active=p.get("is_active", True)
            )
            db.add(prod)
            imported_products += 1

    db.commit()
    return {
        "message": f"Backup restored successfully! Restored {imported_products} products, {imported_customers} customers, {imported_vendors} vendors.",
        "imported_products": imported_products,
        "imported_customers": imported_customers,
        "imported_vendors": imported_vendors
    }
