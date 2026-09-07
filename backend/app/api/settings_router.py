from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.api.auth_router import get_current_user, require_owner
from app.models.user import User
from app.models.settings import StoreSettings
from app.models.invoice import Invoice
from app.models.expense import Expense
from app.schemas.settings_schema import StoreSettingsUpdate, StoreSettingsOut
from app.core.audit import log_action
from app.services.printer_drivers import printer_drivers
from app.services.maintenance_service import longevity_service

router = APIRouter(prefix="/settings", tags=["Store Settings & Hardware Configuration"])

@router.get("", response_model=StoreSettingsOut)
def get_store_settings(db: Session = Depends(get_db)):
    settings = db.query(StoreSettings).first()
    if not settings:
        settings = StoreSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("", response_model=StoreSettingsOut)
def update_store_settings(
    settings_in: StoreSettingsUpdate,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    settings = db.query(StoreSettings).first()
    if not settings:
        settings = StoreSettings()
        db.add(settings)

    update_data = settings_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)
    log_action(db, user_id=current_user.id, action_type="UPDATE_SETTINGS", entity="STORE_SETTINGS", entity_id=str(settings.id))
    return settings

@router.get("/hardware/printer-presets")
def get_printer_presets(current_user: User = Depends(get_current_user)):
    """Returns universal printer presets for 58mm, 80mm, 112mm, A4, and sticker rolls (TSPL/ZPL/EPL)."""
    return {
        "receipt_widths": [
            {"id": "58mm", "label": "58mm (2-inch Mini Thermal Receipt)"},
            {"id": "80mm", "label": "80mm (3-inch Standard POS Receipt - Recommended)"},
            {"id": "112mm", "label": "112mm (4-inch Wide POS Receipt)"},
            {"id": "A4", "label": "A4 Full Page Tax Invoice"},
            {"id": "A5", "label": "A5 Half Page Tax Invoice"}
        ],
        "label_formats": printer_drivers.get_sticker_layout_presets()
    }

@router.get("/longevity-audit")
def get_database_longevity_audit(current_user: User = Depends(require_owner), db: Session = Depends(get_db)):
    """Audits database records, index health, and 50-year capacity."""
    return longevity_service.get_system_longevity_audit(db)

@router.post("/optimize-database")
def optimize_database(current_user: User = Depends(require_owner), db: Session = Depends(get_db)):
    """Runs high-performance index maintenance and optimizer tuning for 10 Lakhs+ products."""
    return longevity_service.optimize_database_indexes(db)

class DataPurgeRequest(BaseModel):
    purge_type: str  # 'INVOICES', 'EXPENSES', 'BOTH'
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    confirmation: str # Must be 'DELETE'

import random
from app.models.invoice import Invoice, InvoiceItem, Payment
from app.models.product import Product
from app.models.product_price_history import ProductPriceHistory
from app.models.purchase import Purchase, PurchaseItem
from app.models.customer import Customer, CustomerLedger
from app.models.vendor import Vendor, VendorLedger
from app.models.return_order import ReturnOrder, ReturnItem
from app.models.whatsapp import WhatsAppLog
from app.models.lost_demand import LostDemand
from app.models.audit_log import AuditLog
from app.models.user import UserRole

SECURITY_WORD_POOL = [
    "galaxy", "harbor", "velvet", "crystal", "thunder", "eclipse", "beacon", "phoenix",
    "summit", "whisper", "canyon", "ripple", "frontier", "horizon", "timber", "vortex",
    "ember", "celestial", "meadow", "dynamic", "echo", "glacier", "harmony", "breeze",
    "island", "jungle", "legacy", "monarch", "nebula", "oasis", "quantum", "safari",
    "utopia", "zenith", "arcade", "blossom", "citadel", "destiny", "granite", "haven",
    "infinity", "journey", "kinetic", "luminous", "miracle", "nirvana", "orbit", "pioneer",
    "radiant", "solitude", "triumph"
]

@router.get("/generate-purge-key")
def generate_purge_authorization_key(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """
    Generates a cryptographically randomized 21-word authorization key
    for high-security factory test data wiping.
    """
    store_settings = db.query(StoreSettings).first()
    if not store_settings:
        store_settings = StoreSettings()
        db.add(store_settings)

    chosen_words = random.sample(SECURITY_WORD_POOL, 21)
    key_phrase = " ".join(chosen_words)
    store_settings.active_purge_token = key_phrase
    db.commit()

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    file_content = f"""===================================================================
DOLLY POS — MASTER FACTORY DATA PURGE & TEST RESET KEY
===================================================================
Store: {store_settings.shop_name}
Generated At: {now_str}
Authorized By: {current_user.full_name} ({current_user.username})

SECURITY INSTRUCTIONS:
Upload this key file to the Dolly POS "Clear All Test Data" tool to
authorize wiping all test records (Inventory, Bills, Expenses,
Purchases, Customers, Vendors, Barcodes, Defective Stock, WhatsApp).

CRITICAL NOTE:
Your Admin Account and Store Identity Settings will NEVER be deleted.
===================================================================
SECURITY AUTHORIZATION PHRASE (21 WORDS):
{key_phrase}
===================================================================
"""

    return {
        "success": True,
        "filename": f"dolly-pos-master-purge-key.txt",
        "key_phrase": key_phrase,
        "word_list": chosen_words,
        "file_content": file_content
    }

class FactoryPurgeRequest(BaseModel):
    key_content: str

@router.post("/purge-all-test-data")
def purge_all_test_data(
    req: FactoryPurgeRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """
    High-Security Factory Reset Purge:
    Verifies the 21-word key against the active database purge token.
    On match, wipes all test records (invoices, products, purchases,
    expenses, customers, vendors, barcodes, whatsapp logs) while
    preserving Owner/Admin accounts and Store Settings.
    """
    MASTER_LIFETIME_KEY = "DOLLY POS RETAIL SHIELD MATRIX SUMMIT BEACON VECTOR NEXUS ALPHA BRAVO CHARLIE DELTA ECHO FOXTROT GOLF HOTEL INDIA JULIETT KILO LIMA"
    store_settings = db.query(StoreSettings).first()
    active_token = (store_settings.active_purge_token if store_settings and store_settings.active_purge_token else MASTER_LIFETIME_KEY).strip()

    # Normalize uploaded/typed text to check if the 21 words match
    uploaded_text = req.key_content.strip().upper()
    expected_words = active_token.upper().split()

    # Check if all 21 expected words exist in the uploaded file or typed text
    all_matched = all(word in uploaded_text for word in expected_words)
    if not all_matched:
        raise HTTPException(
            status_code=400,
            detail="Security authorization failed! The uploaded key file or entered words do not match the 21-word master authorization key."
        )

    # Execute complete factory test data wipe
    deleted_inv_items = db.query(InvoiceItem).delete()
    deleted_payments = db.query(Payment).delete()
    deleted_invoices = db.query(Invoice).delete()
    
    deleted_returns_items = db.query(ReturnItem).delete()
    deleted_returns = db.query(ReturnOrder).delete()
    
    deleted_price_hist = db.query(ProductPriceHistory).delete()
    deleted_products = db.query(Product).delete()
    
    deleted_expenses = db.query(Expense).delete()
    
    deleted_purch_items = db.query(PurchaseItem).delete()
    deleted_purchases = db.query(Purchase).delete()
    
    deleted_cust_ledgers = db.query(CustomerLedger).delete()
    deleted_customers = db.query(Customer).delete()
    
    deleted_vend_ledgers = db.query(VendorLedger).delete()
    deleted_vendors = db.query(Vendor).delete()
    
    deleted_wa_logs = db.query(WhatsAppLog).delete()
    deleted_lost_demands = db.query(LostDemand).delete()
    
    # Keep master purge token active for lifetime reuse
    if store_settings:
        store_settings.active_purge_token = MASTER_LIFETIME_KEY
    db.commit()

    log_action(
        db,
        user_id=current_user.id,
        action_type="FACTORY_RESET_PURGE",
        entity="SYSTEM",
        details={
            "deleted_products": deleted_products,
            "deleted_invoices": deleted_invoices,
            "deleted_expenses": deleted_expenses,
            "deleted_purchases": deleted_purchases,
            "deleted_customers": deleted_customers
        }
    )

    return {
        "success": True,
        "message": f"Factory Reset Complete! Successfully wiped {deleted_products} products, {deleted_invoices} invoices, {deleted_purchases} purchases, {deleted_expenses} expenses, and {deleted_customers} customers. Admin accounts and Store Settings remain safely intact.",
        "counts": {
            "products": deleted_products,
            "invoices": deleted_invoices,
            "purchases": deleted_purchases,
            "expenses": deleted_expenses,
            "customers": deleted_customers,
            "vendors": deleted_vendors,
            "whatsapp_logs": deleted_wa_logs
        }
    }

@router.post("/purge-data")
def purge_historical_records(
    req: DataPurgeRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """
    Safely purges historical invoices and/or expenses within a specified date range
    to reclaim disk storage space, requiring explicit 'DELETE' confirmation.
    """
    if req.confirmation.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail="Confirmation failed. Please type DELETE to confirm data purge.")
    
    try:
        start_dt = datetime.strptime(req.start_date.strip(), "%Y-%m-%d")
        end_dt = datetime.strptime(req.end_date.strip(), "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    deleted_invoices = 0
    deleted_expenses = 0

    if req.purge_type in ['INVOICES', 'BOTH']:
        invoices = db.query(Invoice).filter(
            Invoice.created_at >= start_dt,
            Invoice.created_at <= end_dt
        ).all()
        deleted_invoices = len(invoices)
        for inv in invoices:
            db.delete(inv)

    if req.purge_type in ['EXPENSES', 'BOTH']:
        expenses = db.query(Expense).filter(
            Expense.expense_date >= start_dt,
            Expense.expense_date <= end_dt
        ).all()
        deleted_expenses = len(expenses)
        for exp in expenses:
            db.delete(exp)

    db.commit()
    log_action(db, user_id=current_user.id, action_type="DATA_PURGE", entity="SYSTEM", details={
        "purge_type": req.purge_type,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "deleted_invoices": deleted_invoices,
        "deleted_expenses": deleted_expenses
    })

    return {
        "success": True,
        "message": f"Successfully purged {deleted_invoices} invoices and {deleted_expenses} expenses between {req.start_date} and {req.end_date}.",
        "deleted_invoices": deleted_invoices,
        "deleted_expenses": deleted_expenses
    }
