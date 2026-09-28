import os
import json
import random
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
from app.models.customer import Customer, CustomerLedger, CustomerLedgerType
from app.models.vendor import Vendor, VendorLedger, VendorLedgerType
from app.models.settings import StoreSettings
from app.models.invoice import Invoice, InvoiceItem, Payment, PaymentMode, PaymentStatus
from app.models.purchase import Purchase, PurchaseItem, PurchaseStatus
from app.models.return_order import ReturnOrder, ReturnItem, ReturnType
from app.models.expense import Expense, ExpenseCategory
from app.models.lost_demand import LostDemand, ProcurementNote, LostDemandStatus, LostDemandUrgency
from app.services.backup_service import backup_service
from app.config import settings as app_settings

router = APIRouter(prefix="/backup", tags=["Database Backup & Safety"])

class BackupConfigRequest(BaseModel):
    backup_path: str
    auto_backup: bool = True
    backup_frequency: str = "DAILY"
    backup_filename_prefix: Optional[str] = "DollyToys"

@router.get("/status")
def get_backup_status(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """
    Returns the backup configuration, target folder path, auto-backup status,
    and runs scheduled check (Daily, Weekly Monday, or 1st of Month) automatically.
    """
    store_settings = db.query(StoreSettings).first()
    target_dir = backup_service.get_backup_directory(db)
    
    # Run scheduled auto-backup check (Daily / Weekly Monday / Monthly 1st)
    auto_res = backup_service.check_and_run_scheduled_auto_backup(db)
    
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
                    "is_auto_monthly": "AutoMonthly" in f or "AutoDaily" in f or "AutoWeekly" in f
                })
        backups.sort(key=lambda x: x["created_timestamp"], reverse=True)

    return {
        "auto_backup_enabled": store_settings.auto_backup if store_settings else True,
        "backup_frequency": store_settings.backup_frequency if store_settings else "DAILY",
        "backup_filename_prefix": getattr(store_settings, 'backup_filename_prefix', 'DollyToys') or 'DollyToys',
        "backup_directory": target_dir,
        "monthly_check": auto_res,
        "scheduled_check": auto_res,
        "total_backups_found": len(backups),
        "backups": backups
    }

@router.post("/save-config")
def save_backup_config(
    req: BackupConfigRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Saves custom backup path, auto-backup toggle, frequency preference, and filename prefix."""
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
    store_settings.backup_frequency = req.backup_frequency or "DAILY"
    if req.backup_filename_prefix is not None:
        clean_prefix = "".join(c for c in req.backup_filename_prefix.strip() if c.isalnum() or c in ("-", "_")).strip()
        store_settings.backup_filename_prefix = clean_prefix or "DollyToys"

    db.commit()

    return {
        "success": True,
        "message": f"Backup directory set to: {clean_path} (Frequency: {store_settings.backup_frequency}, Prefix: {store_settings.backup_filename_prefix})",
        "backup_path": clean_path,
        "auto_backup": store_settings.auto_backup,
        "backup_frequency": store_settings.backup_frequency,
        "backup_filename_prefix": store_settings.backup_filename_prefix
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

def parse_iso_datetime(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.strptime(val[:19], "%Y-%m-%dT%H:%M:%S")
        except Exception:
            return datetime.utcnow()

@router.post("/import-full-json")
async def import_database_json(
    file: UploadFile = File(...),
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """
    Restores 100% complete database state from portable JSON backup file:
    Categories, Subcategories, Vendors, Customers, Products, Purchases,
    Invoices, Payments, Returns, and Expenses.
    
    NOTE: StoreSettings (Shop Name, Address, Footers, Opening Date, Printers)
    are intentionally preserved and NEVER overwritten during restore.
    """
    contents = await file.read()
    try:
        data = json.loads(contents)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON backup file.")

    try:
        return backup_service.restore_database_from_dict(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database restore failed: {str(e)}")

@router.post("/restore-local/{filename}")
def restore_local_backup_file(
    filename: str,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Restores database directly from a local backup file on disk without re-uploading."""
    target_dir = backup_service.get_backup_directory(db)
    clean_filename = os.path.basename(filename)
    fpath = os.path.join(target_dir, clean_filename)

    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Local backup file '{clean_filename}' not found.")

    try:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON in local backup file: {str(e)}")

    try:
        return backup_service.restore_database_from_dict(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database restore failed: {str(e)}")

@router.post("/sync-offline-sqlite")
def sync_offline_sqlite(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """
    Manually triggers offline emergency SQLite synchronization into active PostgreSQL database.
    Transfers any missing offline bills, invoice items, payments, customer ledgers, and expenses.
    """
    from app.services.offline_sync_service import offline_sync_service
    return offline_sync_service.sync_offline_sqlite_to_postgres(db)

@router.post("/on-close")
def handle_app_close_backup(
    db: Session = Depends(get_db)
):
    """
    Triggers automated on-close backup, Google Drive cloud upload, and retention purge
    when Dolly POS application is being closed.
    """
    return backup_service.handle_on_close_backup(db)

@router.post("/shutdown")
def shutdown_system_server():
    """Cleanly terminates the desktop backend process when user closes the app (standalone/frozen only)."""
    import sys
    # If running in development mode (e.g. uvicorn dev server), do not kill the server
    if not getattr(sys, "frozen", False) and os.environ.get("ENVIRONMENT") != "production":
        return {"success": True, "message": "Development mode active: backend kept alive for dev reload."}

    import threading
    import time
    def _delayed_exit():
        try:
            from app.core.database import SessionLocal
            from app.services.backup_service import backup_service
            s_db = SessionLocal()
            try:
                backup_service.handle_on_close_backup(s_db)
            finally:
                s_db.close()
        except Exception:
            pass
        time.sleep(0.3)
        os._exit(0)
    threading.Thread(target=_delayed_exit, daemon=True).start()
    return {"success": True, "message": "Dolly POS server shutting down cleanly."}



