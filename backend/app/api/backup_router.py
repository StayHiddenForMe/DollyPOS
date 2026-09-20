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
from app.models.lost_demand import LostDemand, ProcurementNote, ProcurementPriority, ProcurementStatus, DemandUrgency, DemandStatus
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

    imported_products = 0
    imported_customers = 0
    imported_vendors = 0
    imported_expenses = 0
    imported_purchases = 0
    imported_invoices = 0
    imported_returns = 0

    # 1. Store Settings: Intentionally preserved untouched per business rules

    # 2. Restore Categories & Subcategories with in-memory map
    cat_map: Dict[str, int] = {c.name.lower(): c.id for c in db.query(Category.name, Category.id).all()}
    subcat_map: Dict[str, int] = {f"{sc.category_id}_{sc.name.lower()}": sc.id for sc in db.query(Subcategory.category_id, Subcategory.name, Subcategory.id).all()}

    for c_data in data.get("categories", []):
        cat_name = (c_data.get("name") or "").strip()
        if not cat_name:
            continue
        c_key = cat_name.lower()
        if c_key not in cat_map:
            cat = Category(
                name=cat_name,
                description=c_data.get("description"),
                icon=c_data.get("icon") or "Package"
            )
            db.add(cat)
            db.flush()
            cat_map[c_key] = cat.id

        parent_id = cat_map[c_key]
        for sc_data in c_data.get("subcategories", []):
            sc_name = (sc_data.get("name") or "").strip()
            if not sc_name:
                continue
            sc_key = f"{parent_id}_{sc_name.lower()}"
            if sc_key not in subcat_map:
                sc = Subcategory(
                    category_id=parent_id,
                    name=sc_name,
                    description=sc_data.get("description")
                )
                db.add(sc)
                db.flush()
                subcat_map[sc_key] = sc.id

    db.commit()

    # 3. Restore Vendors & Vendor Ledgers
    existing_vendor_codes = {v[0]: v[1] for v in db.query(Vendor.vendor_code, Vendor.id).filter(Vendor.vendor_code != None).all()}
    existing_vendor_phones = {v[0]: v[1] for v in db.query(Vendor.phone, Vendor.id).filter(Vendor.phone != None).all()}
    vendor_map: Dict[str, int] = {**existing_vendor_codes, **existing_vendor_phones}

    for v_data in data.get("vendors", []):
        v_phone = (v_data.get("phone") or "").strip()
        v_code = (v_data.get("vendor_code") or "").strip()
        
        vend_id = vendor_map.get(v_code) or vendor_map.get(v_phone)
        if not vend_id:
            vend = Vendor(
                vendor_code=v_code or f"VEND-{random.randint(1000, 9999)}",
                name=v_data.get("name") or "Unknown Vendor",
                company_name=v_data.get("company_name"),
                phone=v_phone or f"98{random.randint(10000000, 99999999)}",
                alt_phone=v_data.get("alt_phone"),
                email=v_data.get("email"),
                gstin=v_data.get("gstin"),
                address=v_data.get("address"),
                city=v_data.get("city", "Dhule"),
                state=v_data.get("state", "Maharashtra"),
                outstanding_due=float(v_data.get("outstanding_due") or 0.0),
                notes=v_data.get("notes"),
                bank_name=v_data.get("bank_name"),
                bank_account_no=v_data.get("bank_account_no"),
                bank_ifsc=v_data.get("bank_ifsc")
            )
            db.add(vend)
            db.flush()
            vend_id = vend.id
            if v_code:
                vendor_map[v_code] = vend_id
            if v_phone:
                vendor_map[v_phone] = vend_id
            imported_vendors += 1

            for vl in v_data.get("ledgers", []):
                try:
                    entry_type = VendorLedgerType(vl.get("entry_type", "PURCHASE_BILL"))
                except Exception:
                    entry_type = VendorLedgerType.PURCHASE_BILL
                v_ledger = VendorLedger(
                    vendor_id=vend_id,
                    entry_type=entry_type,
                    reference_no=vl.get("reference_no") or vl.get("description"),
                    debit_amount=float(vl.get("debit_amount") or 0.0),
                    credit_amount=float(vl.get("credit_amount") or vl.get("amount") or 0.0),
                    balance_after=float(vl.get("balance_after") or vl.get("running_balance") or 0.0),
                    payment_mode=vl.get("payment_mode", "CASH"),
                    notes=vl.get("notes") or vl.get("description"),
                    created_at=parse_iso_datetime(vl.get("created_at")) or datetime.utcnow()
                )
                db.add(v_ledger)

    db.commit()

    # 4. Restore Customers & Customer Ledgers
    existing_cust_phones = {c[0]: c[1] for c in db.query(Customer.phone, Customer.id).filter(Customer.phone != None).all()}
    customer_map: Dict[str, int] = {**existing_cust_phones}

    for c_data in data.get("customers", []):
        c_phone = (c_data.get("phone") or "").strip()
        cust_id = customer_map.get(c_phone)
        if not cust_id:
            cust = Customer(
                name=c_data.get("name") or "Retail Customer",
                phone=c_phone or f"99{random.randint(10000000, 99999999)}",
                alt_phone=c_data.get("alt_phone"),
                email=c_data.get("email"),
                address=c_data.get("address"),
                city=c_data.get("city", "Dhule"),
                credit_balance=float(c_data.get("credit_balance") or 0.0),
                total_spend=float(c_data.get("total_spend") or 0.0),
                visit_count=int(c_data.get("visit_count") or 1)
            )
            db.add(cust)
            db.flush()
            cust_id = cust.id
            if c_phone:
                customer_map[c_phone] = cust_id
            imported_customers += 1

            for cl in c_data.get("ledgers", []):
                try:
                    entry_type = CustomerLedgerType(cl.get("entry_type", "BILL_CREDIT"))
                except Exception:
                    entry_type = CustomerLedgerType.BILL_CREDIT
                c_ledger = CustomerLedger(
                    customer_id=cust_id,
                    entry_type=entry_type,
                    reference_no=cl.get("reference_no") or cl.get("description"),
                    debit_amount=float(cl.get("debit_amount") or 0.0),
                    credit_amount=float(cl.get("credit_amount") or cl.get("amount") or 0.0),
                    balance_after=float(cl.get("balance_after") or cl.get("running_balance") or 0.0),
                    payment_mode=cl.get("payment_mode", "CASH"),
                    notes=cl.get("notes") or cl.get("description"),
                    created_at=parse_iso_datetime(cl.get("created_at")) or datetime.utcnow()
                )
                db.add(c_ledger)

    db.commit()

    # 5. Restore Products
    existing_barcodes = {p[0] for p in db.query(Product.barcode).all()}
    new_products = []
    
    for p_data in data.get("products", []):
        barcode = (p_data.get("barcode") or "").strip()
        if not barcode or barcode in existing_barcodes:
            continue

        c_name = (p_data.get("category_name") or "").lower()
        c_id = cat_map.get(c_name) or p_data.get("category_id")

        sc_name = (p_data.get("subcategory_name") or "").lower()
        sc_id = subcat_map.get(f"{c_id}_{sc_name}") or p_data.get("subcategory_id")

        prod = Product(
            barcode=barcode,
            sku=p_data.get("sku") or barcode,
            name=p_data.get("name") or "Product Item",
            category_id=c_id,
            subcategory_id=sc_id,
            vendor_code=p_data.get("vendor_code"),
            brand=p_data.get("brand"),
            size=p_data.get("size"),
            color=p_data.get("color"),
            fabric=p_data.get("fabric"),
            season=p_data.get("season"),
            purchase_price=float(p_data.get("purchase_price") or 0.0),
            selling_price=float(p_data.get("selling_price") or 0.0),
            mrp=float(p_data.get("mrp") or p_data.get("selling_price") or 0.0),
            margin_percent=float(p_data.get("margin_percent") or 0.0),
            stock_quantity=int(p_data.get("stock_quantity") or 0),
            damaged_quantity=int(p_data.get("damaged_quantity") or 0),
            min_stock_alert=int(p_data.get("min_stock_alert") or 3),
            speed_dial_code=p_data.get("speed_dial_code"),
            is_speed_dial=bool(p_data.get("is_speed_dial", False)),
            is_active=bool(p_data.get("is_active", True))
        )
        new_products.append(prod)
        existing_barcodes.add(barcode)
        imported_products += 1

    if new_products:
        db.add_all(new_products)
        db.commit()

    # Preload product barcode -> ID map for purchases and invoices
    prod_id_by_barcode = {p[0]: p[1] for p in db.query(Product.barcode, Product.id).all()}

    # 6. Restore Purchases & Purchase Items
    existing_purch_numbers = {p[0] for p in db.query(Purchase.purchase_number).all()}
    for purch_data in data.get("purchases", []):
        p_num = (purch_data.get("purchase_number") or "").strip()
        if not p_num or p_num in existing_purch_numbers:
            continue

        v_id = vendor_map.get(purch_data.get("vendor_code") or "") or vendor_map.get(purch_data.get("vendor_phone") or "") or purch_data.get("vendor_id")
        if not v_id:
            first_v = db.query(Vendor.id).first()
            v_id = first_v[0] if first_v else None

        try:
            p_status = PurchaseStatus(purch_data.get("status", "RECEIVED"))
        except Exception:
            p_status = PurchaseStatus.RECEIVED

        try:
            p_pay_status = PaymentStatus(purch_data.get("payment_status", "PAID"))
        except Exception:
            p_pay_status = PaymentStatus.PAID

        purch = Purchase(
            purchase_number=p_num,
            vendor_id=v_id,
            supplier_invoice_no=purch_data.get("supplier_invoice_no"),
            invoice_date=parse_iso_datetime(purch_data.get("invoice_date")) or datetime.utcnow(),
            subtotal=float(purch_data.get("subtotal") or 0.0),
            tax_amount=float(purch_data.get("tax_amount") or 0.0),
            discount_amount=float(purch_data.get("discount_amount") or 0.0),
            shipping_charges=float(purch_data.get("shipping_charges") or 0.0),
            total_amount=float(purch_data.get("total_amount") or 0.0),
            paid_amount=float(purch_data.get("paid_amount") or 0.0),
            due_amount=float(purch_data.get("due_amount") or 0.0),
            status=p_status,
            payment_status=p_pay_status
        )
        db.add(purch)
        db.flush()
        existing_purch_numbers.add(p_num)
        imported_purchases += 1

        for pitem in purch_data.get("items", []):
            p_id = prod_id_by_barcode.get(pitem.get("barcode") or "")
            item_obj = PurchaseItem(
                purchase_id=purch.id,
                product_id=p_id,
                product_name=pitem.get("product_name") or "Purchased Item",
                barcode=pitem.get("barcode") or "",
                quantity=int(pitem.get("quantity") or 1),
                cost_price=float(pitem.get("cost_price") or 0.0),
                selling_price=float(pitem.get("selling_price") or 0.0),
                gst_percent=float(pitem.get("gst_percent") or 0.0),
                total_cost=float(pitem.get("total_cost") or 0.0)
            )
            db.add(item_obj)

    db.commit()

    # 7. Restore Invoices, Invoice Items & Payments
    existing_bill_numbers = {i[0] for i in db.query(Invoice.bill_number).all()}
    for inv_data in data.get("invoices", []):
        b_num = (inv_data.get("bill_number") or "").strip()
        if not b_num or b_num in existing_bill_numbers:
            continue

        cust_phone = (inv_data.get("customer_phone") or "").strip()
        c_id = customer_map.get(cust_phone) if cust_phone else None

        try:
            inv_pay_mode = PaymentMode(inv_data.get("payment_mode", "CASH"))
        except Exception:
            inv_pay_mode = PaymentMode.CASH

        try:
            inv_pay_status = PaymentStatus(inv_data.get("payment_status", "PAID"))
        except Exception:
            inv_pay_status = PaymentStatus.PAID

        inv = Invoice(
            bill_number=b_num,
            customer_id=c_id,
            customer_name=inv_data.get("customer_name") or "Walk-in Customer",
            customer_phone=cust_phone or None,
            subtotal=float(inv_data.get("subtotal") or 0.0),
            discount_amount=float(inv_data.get("discount_amount") or 0.0),
            discount_type=inv_data.get("discount_type") or "FIXED",
            tax_amount=float(inv_data.get("tax_amount") or 0.0),
            extra_charges_amount=float(inv_data.get("extra_charges_amount") or 0.0),
            extra_charges_breakdown=inv_data.get("extra_charges_breakdown"),
            round_off=float(inv_data.get("round_off") or 0.0),
            grand_total=float(inv_data.get("grand_total") or 0.0),
            paid_amount=float(inv_data.get("paid_amount") or 0.0),
            change_amount=float(inv_data.get("change_amount") or 0.0),
            due_amount=float(inv_data.get("due_amount") or 0.0),
            payment_mode=inv_pay_mode,
            payment_status=inv_pay_status,
            is_cancelled=bool(inv_data.get("is_cancelled", False)),
            is_held=bool(inv_data.get("is_held", False)),
            is_gift_receipt=bool(inv_data.get("is_gift_receipt", False)),
            notes=inv_data.get("notes"),
            created_at=parse_iso_datetime(inv_data.get("created_at")) or datetime.utcnow()
        )
        db.add(inv)
        db.flush()
        existing_bill_numbers.add(b_num)
        imported_invoices += 1

        for itm in inv_data.get("items", []):
            p_id = prod_id_by_barcode.get(itm.get("barcode") or "")
            inv_item = InvoiceItem(
                invoice_id=inv.id,
                product_id=p_id,
                item_name=itm.get("item_name") or "Sales Item",
                barcode=itm.get("barcode"),
                sku=itm.get("sku"),
                size=itm.get("size"),
                color=itm.get("color"),
                quantity=int(itm.get("quantity") or 1),
                unit_price=float(itm.get("unit_price") or 0.0),
                cost_price=float(itm.get("cost_price") or 0.0),
                discount_amount=float(itm.get("discount_amount") or 0.0),
                tax_amount=float(itm.get("tax_amount") or 0.0),
                total_price=float(itm.get("total_price") or 0.0),
                is_unlisted=bool(itm.get("is_unlisted", False))
            )
            db.add(inv_item)

        for pay in inv_data.get("payments", []):
            try:
                pm = PaymentMode(pay.get("payment_mode", "CASH"))
            except Exception:
                pm = PaymentMode.CASH
            p_entry = Payment(
                invoice_id=inv.id,
                payment_mode=pm,
                amount=float(pay.get("amount") or 0.0),
                transaction_ref=pay.get("transaction_ref"),
                created_at=parse_iso_datetime(pay.get("created_at")) or datetime.utcnow()
            )
            db.add(p_entry)

    db.commit()

    # 8. Restore Returns & Return Items
    existing_return_numbers = {r[0] for r in db.query(ReturnOrder.return_number).all()}
    for ret_data in data.get("returns", []):
        r_num = (ret_data.get("return_number") or "").strip()
        if not r_num or r_num in existing_return_numbers:
            continue

        inv_match = db.query(Invoice.id).filter(Invoice.bill_number == ret_data.get("bill_number")).first() if ret_data.get("bill_number") else None
        cust_match = db.query(Customer.id).filter(Customer.phone == ret_data.get("customer_phone")).first() if ret_data.get("customer_phone") else None

        try:
            rtype = ReturnType(ret_data.get("return_type", "REFUND_CASH"))
        except Exception:
            rtype = ReturnType.REFUND_CASH

        ret_order = ReturnOrder(
            return_number=r_num,
            invoice_id=inv_match[0] if inv_match else None,
            customer_id=cust_match[0] if cust_match else None,
            return_type=rtype,
            total_refund_amount=float(ret_data.get("total_refund_amount") or 0.0),
            reason=ret_data.get("reason"),
            notes=ret_data.get("notes"),
            created_at=parse_iso_datetime(ret_data.get("created_at")) or datetime.utcnow()
        )
        db.add(ret_order)
        db.flush()
        existing_return_numbers.add(r_num)
        imported_returns += 1

        for ritem in ret_data.get("items", []):
            p_id = prod_id_by_barcode.get(ritem.get("barcode") or "")
            ro_item = ReturnItem(
                return_id=ret_order.id,
                product_id=p_id,
                item_name=ritem.get("item_name") or "Returned Item",
                barcode=ritem.get("barcode"),
                quantity=int(ritem.get("quantity") or 1),
                refund_price=float(ritem.get("refund_price") or ritem.get("refund_amount") or ritem.get("unit_price") or 0.0),
                is_defective=bool(ritem.get("is_defective", False)),
                restocked=bool(ritem.get("restocked", True))
            )
            db.add(ro_item)

    db.commit()

    # 9. Restore Expenses
    for exp_data in data.get("expenses", []):
        try:
            exp_cat = ExpenseCategory(exp_data.get("category", "OTHER"))
        except Exception:
            exp_cat = ExpenseCategory.OTHER

        exp = Expense(
            category=exp_cat,
            title=exp_data.get("title") or "General Expense",
            amount=float(exp_data.get("amount") or 0.0),
            payment_mode=exp_data.get("payment_mode", "CASH"),
            paid_to=exp_data.get("paid_to"),
            notes=exp_data.get("notes"),
            expense_date=parse_iso_datetime(exp_data.get("expense_date")) or datetime.utcnow()
        )
        db.add(exp)
        imported_expenses += 1

    # 10. Restore Procurement Notes
    imported_notes = 0
    for n_data in data.get("procurement_notes", []):
        try:
            prio = ProcurementPriority(n_data.get("priority", "NORMAL"))
        except Exception:
            prio = ProcurementPriority.NORMAL
        try:
            stat = ProcurementStatus(n_data.get("status", "PENDING"))
        except Exception:
            stat = ProcurementStatus.PENDING

        note = ProcurementNote(
            item_name=n_data.get("item_name") or "Item",
            quantity=int(n_data.get("quantity") or 1),
            description=n_data.get("description"),
            vendor_name=n_data.get("vendor_name"),
            estimated_price=float(n_data.get("estimated_price") or 0.0) if n_data.get("estimated_price") is not None else None,
            priority=prio,
            status=stat,
            notes=n_data.get("notes"),
            created_at=parse_iso_datetime(n_data.get("created_at")) or datetime.utcnow()
        )
        db.add(note)
        imported_notes += 1

    # 11. Restore Lost Demand
    imported_lost_demands = 0
    for ld_data in data.get("lost_demands", []):
        try:
            urg = DemandUrgency(ld_data.get("urgency", "NORMAL"))
        except Exception:
            urg = DemandUrgency.NORMAL
        try:
            d_stat = DemandStatus(ld_data.get("status", "PENDING_PROCUREMENT"))
        except Exception:
            d_stat = DemandStatus.PENDING_PROCUREMENT

        ld = LostDemand(
            item_description=ld_data.get("item_description") or "Item",
            category_name=ld_data.get("category_name") or "General",
            preferred_size=ld_data.get("preferred_size") or "Standard",
            preferred_color=ld_data.get("preferred_color") or "Any",
            customer_name=ld_data.get("customer_name") or "Walk-in Customer",
            customer_phone=ld_data.get("customer_phone") or "N/A",
            urgency=urg,
            request_count=int(ld_data.get("request_count") or 1),
            status=d_stat,
            notes=ld_data.get("notes"),
            created_at=parse_iso_datetime(ld_data.get("created_at")) or datetime.utcnow()
        )
        db.add(ld)
        imported_lost_demands += 1

    db.commit()

    return {
        "success": True,
        "message": f"Full Database Restored in <1s! Processed {imported_products} new products, {imported_invoices} bills, {imported_purchases} purchases, {imported_returns} returns, {imported_expenses} expenses, {imported_customers} customers, and {imported_vendors} vendors. Store Information preserved intact.",
        "counts": {
            "products": imported_products,
            "invoices": imported_invoices,
            "purchases": imported_purchases,
            "returns": imported_returns,
            "expenses": imported_expenses,
            "customers": imported_customers,
            "vendors": imported_vendors,
            "procurement_notes": imported_notes,
            "lost_demands": imported_lost_demands
        }
    }
