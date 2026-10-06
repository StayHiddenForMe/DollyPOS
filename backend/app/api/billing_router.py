from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, and_
from typing import List, Optional
from datetime import datetime, timedelta
import io
import math
from pydantic import BaseModel

from app.core.database import get_db
from app.api.auth_router import get_current_user, require_owner
from app.models.user import User
from app.models.invoice import Invoice, InvoiceItem, Payment, PaymentMode, PaymentStatus
from app.models.product import Product
from app.models.customer import Customer, CustomerLedger, CustomerLedgerType
from app.models.settings import StoreSettings
from app.schemas.billing_schema import InvoiceCreate, InvoiceOut, HeldBillSummary
from app.services.receipt_service import receipt_service
from app.services.upi_service import upi_service
from app.core.audit import log_action
from app.services.cloud_sync_service import trigger_instant_cloud_sync

router = APIRouter(prefix="/billing", tags=["Billing & Checkout"])

class UpdatePaymentModeRequest(BaseModel):
    payment_mode: PaymentMode
    notes: Optional[str] = None

def generate_bill_number(db: Session) -> str:
    from app.core.timezone import get_ist_now
    ist_now = get_ist_now()
    today_str = ist_now.strftime("%Y%m%d")
    settings = db.query(StoreSettings).first()
    pfx = (settings.bill_prefix.strip().upper() if settings and settings.bill_prefix and settings.bill_prefix.strip() else "DLY")
    prefix = f"{pfx}-{today_str}-"
    last_invoice = db.query(Invoice).filter(Invoice.bill_number.like(f"{prefix}%")).order_by(desc(Invoice.id)).first()
    seq = (int(last_invoice.bill_number.split("-")[-1]) + 1) if last_invoice else 1
    return f"{prefix}{seq:04d}"

@router.get("/by-number/{bill_number}")
def get_invoice_by_bill_number(bill_number: str, db: Session = Depends(get_db)):
    clean_no = bill_number.strip()
    inv = db.query(Invoice).options(
        joinedload(Invoice.items),
        joinedload(Invoice.payments)
    ).filter(Invoice.bill_number.ilike(clean_no)).first()

    if not inv:
        # Fallback: if user omitted prefix (e.g. entered 20260929-0001 or 29-0001)
        inv = db.query(Invoice).options(
            joinedload(Invoice.items),
            joinedload(Invoice.payments)
        ).filter(Invoice.bill_number.ilike(f"%{clean_no}%")).order_by(desc(Invoice.id)).first()

    if not inv:
        raise HTTPException(status_code=404, detail=f"Bill '{bill_number}' not found")
    return inv

@router.post("/checkout", response_model=InvoiceOut)
def create_invoice(
    invoice_in: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bill_no = generate_bill_number(db)
    
    # 1. Resolve / Create Customer - Auto-register even if only phone is provided
    customer_id = None
    customer = None
    clean_phone = invoice_in.customer_phone.strip() if (invoice_in.customer_phone and invoice_in.customer_phone.strip()) else None
    clean_name = invoice_in.customer_name.strip() if (invoice_in.customer_name and invoice_in.customer_name.strip()) else None

    if clean_phone:
        customer = db.query(Customer).filter(Customer.phone == clean_phone).first()
        if not customer:
            customer = Customer(
                name=clean_name or "Customer",
                phone=clean_phone,
                city="Dhule",
                created_at=datetime.utcnow(),
                last_visit_at=datetime.utcnow()
            )
            db.add(customer)
            db.flush()
        else:
            if clean_name and (customer.name == "Customer" or customer.name.startswith("Customer (") or not customer.name):
                customer.name = clean_name
            customer.last_visit_at = datetime.utcnow()
            db.flush()
    elif clean_name and (invoice_in.due_amount > 0 or invoice_in.payment_mode == PaymentMode.CREDIT_KHATA):
        # Credit sale with Name only - save customer with phone=None (no fake phone)
        customer = db.query(Customer).filter(Customer.name.ilike(clean_name)).first()
        if not customer:
            customer = Customer(
                name=clean_name,
                phone=None,
                city="Dhule",
                created_at=datetime.utcnow(),
                last_visit_at=datetime.utcnow()
            )
            db.add(customer)
            db.flush()
        else:
            customer.last_visit_at = datetime.utcnow()
            db.flush()

    if customer:
        customer_id = customer.id
        final_customer_name = clean_name or customer.name or "Customer"
        final_customer_phone = clean_phone or customer.phone
    else:
        final_customer_name = clean_name or ("Customer" if clean_phone else None)
        final_customer_phone = clean_phone

    # Resolve invoice-level CGST and SGST
    calc_cgst_amount = getattr(invoice_in, 'cgst_amount', 0.0) or 0.0
    calc_sgst_amount = getattr(invoice_in, 'sgst_amount', 0.0) or 0.0
    if (calc_cgst_amount == 0.0 and calc_sgst_amount == 0.0) and invoice_in.tax_amount > 0:
        calc_cgst_amount = round(invoice_in.tax_amount / 2.0, 2)
        calc_sgst_amount = round(invoice_in.tax_amount - calc_cgst_amount, 2)

    invoice = Invoice(
        bill_number=bill_no,
        customer_id=customer_id,
        cashier_id=current_user.id,
        customer_name=final_customer_name,
        customer_phone=final_customer_phone,
        subtotal=invoice_in.subtotal,
        discount_amount=invoice_in.discount_amount,
        discount_type=invoice_in.discount_type,
        tax_amount=invoice_in.tax_amount,
        cgst_amount=calc_cgst_amount,
        sgst_amount=calc_sgst_amount,
        extra_charges_amount=invoice_in.extra_charges_amount,
        extra_charges_breakdown=invoice_in.extra_charges_breakdown,
        round_off=invoice_in.round_off,
        grand_total=invoice_in.grand_total,
        paid_amount=invoice_in.paid_amount,
        change_amount=invoice_in.change_amount,
        due_amount=invoice_in.due_amount,
        payment_mode=invoice_in.payment_mode,
        payment_status=invoice_in.payment_status,
        is_held=False,
        is_cancelled=False,
        is_gift_receipt=invoice_in.is_gift_receipt,
        notes=invoice_in.notes
    )
    db.add(invoice)
    db.flush()

    # 2. Process Items & Deduct Stock
    sum_items_cgst = 0.0
    sum_items_sgst = 0.0
    for item in invoice_in.items:
        i_cgst_pct = getattr(item, 'cgst_percent', 0.0) or (item.tax_percent / 2.0 if item.tax_percent else 0.0)
        i_sgst_pct = getattr(item, 'sgst_percent', 0.0) or (item.tax_percent / 2.0 if item.tax_percent else 0.0)
        i_cgst_amt = getattr(item, 'cgst_amount', 0.0) or 0.0
        i_sgst_amt = getattr(item, 'sgst_amount', 0.0) or 0.0

        if (i_cgst_amt == 0.0 and i_sgst_amt == 0.0) and item.tax_amount > 0:
            i_cgst_amt = round((item.unit_price * i_cgst_pct / 100.0) * item.quantity, 2)
            i_sgst_amt = round((item.unit_price * i_sgst_pct / 100.0) * item.quantity, 2)

        sum_items_cgst += i_cgst_amt
        sum_items_sgst += i_sgst_amt

        inv_item = InvoiceItem(
            invoice_id=invoice.id,
            product_id=item.product_id,
            item_name=item.item_name,
            barcode=item.barcode,
            sku=item.sku,
            size=item.size,
            color=item.color,
            quantity=item.quantity,
            unit_price=item.unit_price,
            cost_price=item.cost_price,
            discount_amount=item.discount_amount,
            tax_percent=item.tax_percent,
            tax_amount=item.tax_amount,
            cgst_percent=i_cgst_pct,
            cgst_amount=i_cgst_amt,
            sgst_percent=i_sgst_pct,
            sgst_amount=i_sgst_amt,
            total_price=item.total_price,
            is_unlisted=item.is_unlisted
        )
        db.add(inv_item)

        if item.product_id and not item.is_unlisted:
            prod = db.query(Product).filter(Product.id == item.product_id).first()
            if prod:
                prod.stock_quantity = max(0, prod.stock_quantity - item.quantity)
                prod.last_sold_at = datetime.utcnow()

    if sum_items_cgst > 0 or sum_items_sgst > 0:
        invoice.cgst_amount = round(sum_items_cgst, 2)
        invoice.sgst_amount = round(sum_items_sgst, 2)

    # 3. Process Payments (Single mode or multi-tender SPLIT)
    if invoice_in.payments and len(invoice_in.payments) > 0:
        for p in invoice_in.payments:
            if p.amount > 0:
                payment = Payment(
                    invoice_id=invoice.id,
                    payment_mode=p.payment_mode,
                    amount=p.amount,
                    transaction_ref=p.transaction_ref
                )
                db.add(payment)
    elif invoice_in.paid_amount > 0:
        payment = Payment(
            invoice_id=invoice.id,
            payment_mode=invoice_in.payment_mode,
            amount=invoice_in.paid_amount
        )
        db.add(payment)

    # 4. If Credit Sale (Khata Due), update customer credit ledger
    if invoice_in.due_amount > 0 and customer:
        customer.credit_balance = float(math.floor(customer.credit_balance + invoice_in.due_amount + 0.5))
        customer.total_spend += invoice_in.grand_total
        customer.visit_count += 1
        customer.last_visit_at = datetime.utcnow()

        ledger = CustomerLedger(
            customer_id=customer.id,
            entry_type=CustomerLedgerType.BILL_CREDIT,
            reference_no=bill_no,
            credit_amount=invoice_in.due_amount,
            debit_amount=0.0,
            balance_after=customer.credit_balance,
            payment_mode=str(invoice_in.payment_mode.value),
            notes=f"Bill {bill_no} Credit Purchase (Paid: ₹{invoice_in.paid_amount}, Due: ₹{invoice_in.due_amount})"
        )
        db.add(ledger)
    elif customer:
        customer.total_spend += invoice_in.grand_total
        customer.visit_count += 1
        customer.last_visit_at = datetime.utcnow()

    db.commit()
    db.refresh(invoice)

    log_action(db, user_id=current_user.id, action_type="CREATE_INVOICE", entity="INVOICE", entity_id=str(invoice.id), details={"bill_number": invoice.bill_number, "total": invoice.grand_total})
    trigger_instant_cloud_sync()
    return invoice

@router.post("/hold", response_model=InvoiceOut)
def hold_current_cart(
    invoice_in: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bill_no = f"HELD-{int(datetime.utcnow().timestamp())}"
    invoice = Invoice(
        bill_number=bill_no,
        customer_name=invoice_in.customer_name,
        customer_phone=invoice_in.customer_phone,
        subtotal=invoice_in.subtotal,
        discount_amount=invoice_in.discount_amount,
        tax_amount=invoice_in.tax_amount,
        grand_total=invoice_in.grand_total,
        paid_amount=0.0,
        due_amount=invoice_in.grand_total,
        payment_mode=PaymentMode.CASH,
        payment_status=PaymentStatus.UNPAID,
        is_held=True,
        is_cancelled=False,
        cashier_id=current_user.id
    )
    db.add(invoice)
    db.flush()

    for item in invoice_in.items:
        inv_item = InvoiceItem(
            invoice_id=invoice.id,
            product_id=item.product_id,
            item_name=item.item_name,
            barcode=item.barcode,
            sku=item.sku,
            size=item.size,
            color=item.color,
            quantity=item.quantity,
            unit_price=item.unit_price,
            cost_price=item.cost_price,
            total_price=item.total_price,
            is_unlisted=item.is_unlisted
        )
        db.add(inv_item)

    db.commit()
    db.refresh(invoice)
    return invoice

@router.get("/held-bills", response_model=List[HeldBillSummary])
def get_held_bills(db: Session = Depends(get_db)):
    held_invoices = db.query(Invoice).options(joinedload(Invoice.items)).filter(Invoice.is_held == True).order_by(desc(Invoice.created_at)).all()
    results = []
    for inv in held_invoices:
        results.append(HeldBillSummary(
            id=inv.id,
            bill_number=inv.bill_number,
            customer_name=inv.customer_name,
            customer_phone=inv.customer_phone,
            item_count=len(inv.items),
            grand_total=inv.grand_total,
            created_at=inv.created_at
        ))
    return results

@router.post("/held-bills/{bill_id}/resume", response_model=InvoiceOut)
def resume_held_bill(bill_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).options(
        joinedload(Invoice.items),
        joinedload(Invoice.payments)
    ).filter(Invoice.id == bill_id, Invoice.is_held == True).first()
    
    if not inv:
        raise HTTPException(status_code=404, detail="Held bill not found")
    return inv

@router.delete("/held-bills/{bill_id}")
def discard_held_bill(bill_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == bill_id, Invoice.is_held == True).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Held bill not found")
    db.delete(inv)
    db.commit()
    return {"message": "Held bill discarded"}

@router.get("/receipt/{invoice_id}")
def get_thermal_receipt_payload(
    invoice_id: int,
    is_gift: bool = False,
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).options(joinedload(Invoice.items)).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    settings = db.query(StoreSettings).first()
    return receipt_service.build_thermal_receipt_data(invoice, settings, is_gift_receipt=is_gift)

@router.get("/dynamic-upi-qr")
def get_dynamic_upi_qr(
    amount: float = Query(..., gt=0),
    bill_number: str = Query(...),
    db: Session = Depends(get_db)
):
    settings = db.query(StoreSettings).first()
    upi_id = settings.upi_id if settings and settings.upi_id else "7972558842@upi"
    shop_name = settings.shop_name if settings else "Dolly Toys and Kids Wear"
    
    return upi_service.generate_upi_qr_base64(
        upi_id=upi_id,
        merchant_name=shop_name,
        amount=amount,
        bill_number=bill_number
    )

@router.get("/history", response_model=List[InvoiceOut])
def get_invoice_history(
    limit: int = 100,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Invoice).options(
        joinedload(Invoice.items),
        joinedload(Invoice.payments)
    ).filter(Invoice.is_held == False)

    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Invoice.bill_number.ilike(s),
                Invoice.customer_phone.ilike(s),
                Invoice.customer_name.ilike(s)
            )
        )

    return query.order_by(desc(Invoice.created_at)).limit(limit).all()

@router.put("/{invoice_id}/payment-mode")
def update_invoice_payment_mode(
    invoice_id: int,
    req: UpdatePaymentModeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allows cashiers to switch payment tender (Cash <-> UPI <-> Card) if customer changes their mind."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.is_cancelled:
        raise HTTPException(status_code=400, detail="Cannot change payment mode on cancelled bill")

    old_mode = invoice.payment_mode
    invoice.payment_mode = req.payment_mode
    if req.notes:
        invoice.notes = f"{invoice.notes or ''} | Changed mode: {old_mode} -> {req.payment_mode} ({req.notes})".strip()

    db.commit()
    db.refresh(invoice)
    log_action(db, user_id=current_user.id, action_type="UPDATE_PAYMENT_MODE", entity="INVOICE", entity_id=str(invoice.id), details={"old": str(old_mode), "new": str(req.payment_mode)})
    return {"message": f"Payment mode for {invoice.bill_number} updated to {req.payment_mode}", "payment_mode": invoice.payment_mode}

@router.post("/cancel/{invoice_id}")
def cancel_invoice(
    invoice_id: int,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).options(joinedload(Invoice.items)).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.is_cancelled:
        raise HTTPException(status_code=400, detail="Bill is already cancelled")

    for item in invoice.items:
        if item.product_id:
            prod = db.query(Product).filter(Product.id == item.product_id).first()
            if prod:
                prod.stock_quantity += item.quantity

    invoice.is_cancelled = True
    db.commit()
    log_action(db, user_id=current_user.id, action_type="CANCEL_BILL", entity="INVOICE", entity_id=str(invoice.id), details={"bill_number": invoice.bill_number})
    trigger_instant_cloud_sync()
    return {"message": f"Bill {invoice.bill_number} cancelled and items restocked."}

@router.get("/export-excel")
def export_invoices_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    all_time: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Exports historical invoices to Excel (.xlsx) with full financial breakdown,
    supporting specific date ranges or high-speed streaming for all-time bills history (100,000+ rows).
    """
    import openpyxl
    from sqlalchemy import text

    params = {}
    where_clauses = ["i.is_held = FALSE"]

    if not all_time and start_date and end_date:
        try:
            from app.core.timezone import get_ist_day_bounds_in_utc
            s_date = datetime.strptime(start_date.strip(), "%Y-%m-%d").date()
            e_date = datetime.strptime(end_date.strip(), "%Y-%m-%d").date()
            s_dt, _ = get_ist_day_bounds_in_utc(s_date)
            _, e_dt = get_ist_day_bounds_in_utc(e_date)
            where_clauses.append("i.created_at >= :s_dt AND i.created_at <= :e_dt")
            params["s_dt"] = s_dt
            params["e_dt"] = e_dt
        except Exception:
            pass

    where_sql = " AND ".join(where_clauses)
    sql = text(f"""
        SELECT 
            i.bill_number,
            i.created_at,
            COALESCE(i.customer_name, 'Walk-in Customer') AS customer_name,
            COALESCE(i.customer_phone, '') AS customer_phone,
            i.subtotal,
            i.discount_amount,
            i.tax_amount,
            i.grand_total,
            i.paid_amount,
            i.due_amount,
            i.payment_mode,
            i.payment_status,
            CASE WHEN i.is_cancelled THEN 'Yes' ELSE 'No' END AS is_cancelled
        FROM invoices i
        WHERE {where_sql}
        ORDER BY i.created_at DESC
    """)

    results = db.execute(sql, params).fetchall()

    wb = openpyxl.Workbook(write_only=True)
    ws = wb.create_sheet(title="Sales Invoices")

    headers = [
        "Bill Number", "Date & Time (IST)", "Customer Name", "Customer Mobile",
        "Subtotal (₹)", "Discount (₹)", "Tax GST (₹)", "Grand Total (₹)",
        "Paid Amount (₹)", "Due Amount (₹)", "Payment Mode", "Payment Status", "Is Cancelled"
    ]
    ws.append(headers)

    ist_offset = timedelta(hours=5, minutes=30)
    for r in results:
        ist_time = (r[1] + ist_offset) if r[1] else None
        date_str = ist_time.strftime("%d-%m-%Y %I:%M %p") if ist_time else ""
        ws.append([
            r[0],
            date_str,
            r[2],
            r[3],
            float(r[4] or 0),
            float(r[5] or 0),
            float(r[6] or 0),
            float(r[7] or 0),
            float(r[8] or 0),
            float(r[9] or 0),
            str(r[10] or ""),
            str(r[11] or ""),
            r[12]
        ])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"DollyToys_Bills_{start_date or 'All'}_to_{end_date or 'Time'}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
