from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.api.auth_router import get_current_user, require_owner
from app.models.user import User
from app.models.vendor import Vendor, VendorLedger, VendorLedgerType
from app.models.purchase import Purchase, PurchaseItem, PurchaseStatus, PurchasePaymentStatus
from app.models.product import Product
from app.schemas.vendor_schema import VendorCreate, VendorUpdate, VendorOut, VendorLedgerEntryCreate, VendorLedgerEntryOut
from app.schemas.purchase_schema import PurchaseCreate, PurchaseOut
from app.core.audit import log_action

router = APIRouter(prefix="/vendors", tags=["Vendor & Purchase Management"])

@router.get("", response_model=List[VendorOut])
def list_vendors(search: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Vendor).filter(Vendor.is_active == True)
    if search:
        s = f"%{search}%"
        query = query.filter(or_(Vendor.name.ilike(s), Vendor.phone.ilike(s), Vendor.company_name.ilike(s)))
    return query.order_by(Vendor.name).all()

@router.post("", response_model=VendorOut)
def create_vendor(vendor_in: VendorCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vendor = Vendor(
        **vendor_in.model_dump(exclude={"opening_due"}),
        outstanding_due=vendor_in.opening_due
    )
    db.add(vendor)
    db.flush()

    if vendor_in.opening_due > 0:
        ledger = VendorLedger(
            vendor_id=vendor.id,
            entry_type=VendorLedgerType.ADJUSTMENT,
            reference_no="OPENING_BALANCE",
            credit_amount=vendor_in.opening_due,
            debit_amount=0.0,
            balance_after=vendor_in.opening_due,
            notes="Opening balance balance adjustment"
        )
        db.add(ledger)

    db.commit()
    db.refresh(vendor)
    log_action(db, user_id=current_user.id, action_type="CREATE_VENDOR", entity="VENDOR", entity_id=str(vendor.id))
    return vendor

@router.put("/{vendor_id}", response_model=VendorOut)
def update_vendor(vendor_id: int, vendor_in: VendorUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    for field, val in vendor_in.model_dump(exclude_unset=True).items():
        setattr(vendor, field, val)
        
    db.commit()
    db.refresh(vendor)
    return vendor

@router.get("/{vendor_id}/ledger", response_model=List[VendorLedgerEntryOut])
def get_vendor_ledger(vendor_id: int, db: Session = Depends(get_db)):
    return db.query(VendorLedger).filter(VendorLedger.vendor_id == vendor_id).order_by(desc(VendorLedger.created_at)).all()

@router.post("/ledger/payment", response_model=VendorLedgerEntryOut)
def make_vendor_payment(
    entry_in: VendorLedgerEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.id == entry_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor.outstanding_due = max(0.0, vendor.outstanding_due - entry_in.amount)
    
    ledger = VendorLedger(
        vendor_id=vendor.id,
        entry_type=entry_in.entry_type,
        reference_no=entry_in.reference_no,
        debit_amount=entry_in.amount,
        credit_amount=0.0,
        balance_after=vendor.outstanding_due,
        payment_mode=entry_in.payment_mode,
        notes=entry_in.notes
    )
    db.add(ledger)
    db.commit()
    db.refresh(ledger)
    log_action(db, user_id=current_user.id, action_type="VENDOR_PAYMENT", entity="VENDOR", entity_id=str(vendor.id), details={"amount": entry_in.amount})
    return ledger

# --- Purchase Inward Engine ---

def generate_purchase_number(db: Session) -> str:
    from app.core.timezone import get_ist_today
    today_str = get_ist_today().strftime("%Y%m%d")
    prefix = f"PO-{today_str}-"
    last_po = db.query(Purchase).filter(Purchase.purchase_number.like(f"{prefix}%")).order_by(desc(Purchase.id)).first()
    seq = (int(last_po.purchase_number.split("-")[-1]) + 1) if last_po else 1
    return f"{prefix}{seq:04d}"

@router.post("/purchases", response_model=PurchaseOut)
def create_purchase_inward(
    purchase_in: PurchaseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Records stock inward shipment:
    1. Auto-updates product stock quantity and cost/selling prices
    2. Updates vendor outstanding dues and ledger
    """
    vendor = db.query(Vendor).filter(Vendor.id == purchase_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    subtotal = sum(item.cost_price * item.quantity for item in purchase_in.items)
    tax_amount = sum((item.cost_price * item.quantity) * (item.gst_percent / 100) for item in purchase_in.items)
    total_amount = subtotal + tax_amount + purchase_in.shipping_charges - purchase_in.discount_amount
    due_amount = max(0.0, total_amount - purchase_in.paid_amount)
    
    payment_status = PurchasePaymentStatus.PAID if due_amount == 0 else (
        PurchasePaymentStatus.PARTIAL if purchase_in.paid_amount > 0 else PurchasePaymentStatus.UNPAID
    )

    po_number = generate_purchase_number(db)
    purchase = Purchase(
        purchase_number=po_number,
        vendor_id=vendor.id,
        supplier_invoice_no=purchase_in.supplier_invoice_no,
        invoice_date=purchase_in.invoice_date or datetime.utcnow(),
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=purchase_in.discount_amount,
        shipping_charges=purchase_in.shipping_charges,
        total_amount=total_amount,
        paid_amount=purchase_in.paid_amount,
        due_amount=due_amount,
        status=PurchaseStatus.RECEIVED,
        payment_status=payment_status,
        notes=purchase_in.notes
    )
    db.add(purchase)
    db.flush()

    for item in purchase_in.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if prod:
            # Update product stock & financials
            prod.stock_quantity += item.quantity
            prod.purchase_price = item.cost_price
            if item.selling_price > 0:
                prod.selling_price = item.selling_price
                if item.cost_price > 0:
                    prod.margin_percent = round(((item.selling_price - item.cost_price) / item.cost_price) * 100, 2)
            prod.last_purchased_at = datetime.utcnow()

            po_item = PurchaseItem(
                purchase_id=purchase.id,
                product_id=prod.id,
                product_name=prod.name,
                barcode=prod.barcode,
                quantity=item.quantity,
                cost_price=item.cost_price,
                selling_price=item.selling_price or prod.selling_price,
                gst_percent=item.gst_percent,
                total_cost=item.cost_price * item.quantity
            )
            db.add(po_item)

    # Update Vendor Due & Ledger
    vendor.outstanding_due += due_amount
    ledger = VendorLedger(
        vendor_id=vendor.id,
        entry_type=VendorLedgerType.PURCHASE_BILL,
        reference_no=po_number,
        credit_amount=total_amount,
        debit_amount=purchase_in.paid_amount,
        balance_after=vendor.outstanding_due,
        payment_mode=purchase_in.payment_mode,
        notes=f"Inward PO {po_number} (Supplier Inv: {purchase_in.supplier_invoice_no or 'N/A'})"
    )
    db.add(ledger)

    db.commit()
    db.refresh(purchase)
    log_action(db, user_id=current_user.id, action_type="CREATE_PURCHASE", entity="PURCHASE", entity_id=str(purchase.id))
    return purchase

@router.get("/purchases/history", response_model=List[PurchaseOut])
def get_purchases_history(limit: int = 50, db: Session = Depends(get_db)):
    purchases = db.query(Purchase).options(
        joinedload(Purchase.vendor),
        joinedload(Purchase.items)
    ).order_by(desc(Purchase.created_at)).limit(limit).all()

    results = []
    for p in purchases:
        p_out = PurchaseOut.model_validate(p)
        p_out.vendor_name = p.vendor.name if p.vendor else None
        results.append(p_out)
    return results

class QuickVendorBillCreate(BaseModel):
    vendor_id: int
    invoice_no: Optional[str] = None
    bill_date: Optional[str] = None
    total_amount: float
    paid_amount: float = 0.0
    payment_mode: str = "CASH"
    notes: Optional[str] = None

@router.post("/quick-bill")
def record_quick_vendor_bill(
    bill_in: QuickVendorBillCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Records a quick purchase invoice / note from a vendor and tracks due balance."""
    vendor = db.query(Vendor).filter(Vendor.id == bill_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    due_added = max(0.0, bill_in.total_amount - bill_in.paid_amount)
    vendor.outstanding_due += due_added

    dt = datetime.strptime(bill_in.bill_date.strip(), "%Y-%m-%d") if (bill_in.bill_date and bill_in.bill_date.strip()) else datetime.utcnow()

    # Record purchase bill ledger entry
    bill_ledger = VendorLedger(
        vendor_id=vendor.id,
        entry_type=VendorLedgerType.PURCHASE_BILL,
        reference_no=bill_in.invoice_no or f"BILL-{int(datetime.utcnow().timestamp())}",
        debit_amount=0.0,
        credit_amount=bill_in.total_amount,
        balance_after=vendor.outstanding_due if bill_in.paid_amount == 0 else (vendor.outstanding_due + bill_in.paid_amount),
        payment_mode=None,
        notes=f"Goods Purchase: ₹{bill_in.total_amount} | {bill_in.notes or ''}".strip(),
        created_at=dt
    )
    db.add(bill_ledger)

    # If any amount was paid upfront
    if bill_in.paid_amount > 0:
        pay_ledger = VendorLedger(
            vendor_id=vendor.id,
            entry_type=VendorLedgerType.PAYMENT_MADE,
            reference_no=bill_in.invoice_no,
            debit_amount=bill_in.paid_amount,
            credit_amount=0.0,
            balance_after=vendor.outstanding_due,
            payment_mode=bill_in.payment_mode,
            notes=f"Paid upfront on purchase: ₹{bill_in.paid_amount}",
            created_at=dt
        )
        db.add(pay_ledger)

    db.commit()
    db.refresh(vendor)
    log_action(db, user_id=current_user.id, action_type="VENDOR_QUICK_BILL", entity="VENDOR", entity_id=str(vendor.id), details={"total": bill_in.total_amount, "paid": bill_in.paid_amount, "due": vendor.outstanding_due})
    return {"message": "Vendor purchase bill recorded successfully", "outstanding_due": vendor.outstanding_due}
