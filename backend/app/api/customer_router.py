import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.api.auth_router import get_current_user, require_owner
from app.models.user import User
from app.models.customer import Customer, CustomerLedger, CustomerLedgerType
from app.models.invoice import Invoice, PaymentStatus
from app.schemas.customer_schema import CustomerCreate, CustomerUpdate, CustomerOut, CustomerLedgerEntryCreate, CustomerLedgerEntryOut
from app.schemas.billing_schema import InvoiceOut
from app.core.audit import log_action

router = APIRouter(prefix="/customers", tags=["Customer CRM & Khata"])

@router.get("", response_model=List[CustomerOut])
def list_customers(search: Optional[str] = None, credit_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Customer).filter(Customer.is_active == True)
    if search:
        s = f"%{search}%"
        query = query.filter(or_(Customer.name.ilike(s), Customer.phone.ilike(s), Customer.city.ilike(s)))
    if credit_only:
        query = query.filter(Customer.credit_balance > 0)
    return query.order_by(desc(Customer.id)).all()

@router.get("/lookup/{phone}", response_model=CustomerOut)
def lookup_customer_by_phone(phone: str, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.phone == phone, Customer.is_active == True).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c

@router.post("", response_model=CustomerOut)
def create_customer(customer_in: CustomerCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    clean_phone = customer_in.phone.strip() if customer_in.phone and customer_in.phone.strip() else None
    if clean_phone:
        existing = db.query(Customer).filter(Customer.phone == clean_phone).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Customer with phone '{clean_phone}' already exists")

    customer_name = customer_in.name.strip() if customer_in.name and customer_in.name.strip() else "Customer"
    customer = Customer(
        name=customer_name,
        phone=clean_phone,
        alt_phone=customer_in.alt_phone,
        email=customer_in.email,
        address=customer_in.address,
        city=customer_in.city or "Dhule",
        date_of_birth=customer_in.date_of_birth,
        anniversary_date=customer_in.anniversary_date,
        favorite_category=customer_in.favorite_category,
        notes=customer_in.notes,
        credit_balance=customer_in.opening_credit_balance,
        is_active=customer_in.is_active
    )
    db.add(customer)
    db.flush()

    if customer_in.opening_credit_balance > 0:
        ledger = CustomerLedger(
            customer_id=customer.id,
            entry_type=CustomerLedgerType.ADJUSTMENT,
            reference_no="OPENING_BALANCE",
            credit_amount=customer_in.opening_credit_balance,
            debit_amount=0.0,
            balance_after=customer_in.opening_credit_balance,
            notes="Opening Khata balance"
        )
        db.add(ledger)

    db.commit()
    db.refresh(customer)
    log_action(db, user_id=current_user.id, action_type="CREATE_CUSTOMER", entity="CUSTOMER", entity_id=str(customer.id))
    return customer

@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, customer_in: CustomerUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    for field, val in customer_in.model_dump(exclude_unset=True).items():
        setattr(customer, field, val)

    db.commit()
    db.refresh(customer)
    return customer

@router.get("/{customer_id}/ledger", response_model=List[CustomerLedgerEntryOut])
def get_customer_ledger(customer_id: int, db: Session = Depends(get_db)):
    return db.query(CustomerLedger).filter(CustomerLedger.customer_id == customer_id).order_by(desc(CustomerLedger.created_at)).all()

@router.post("/ledger/payment", response_model=CustomerLedgerEntryOut)
def record_customer_payment(
    entry_in: CustomerLedgerEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == entry_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.credit_balance = max(0.0, customer.credit_balance - entry_in.amount)

    # FIFO Invoice Due Settlement: Clear oldest unpaid/due invoices first
    remaining_payment = entry_in.amount
    unpaid_invoices = db.query(Invoice).filter(
        Invoice.customer_id == customer.id,
        Invoice.due_amount > 0,
        Invoice.is_cancelled == False
    ).order_by(Invoice.created_at.asc()).all()

    for inv in unpaid_invoices:
        if remaining_payment <= 0:
            break
        if remaining_payment >= inv.due_amount:
            remaining_payment -= inv.due_amount
            inv.paid_amount += inv.due_amount
            inv.due_amount = 0.0
            inv.payment_status = PaymentStatus.PAID
        else:
            inv.paid_amount += remaining_payment
            inv.due_amount -= remaining_payment
            inv.payment_status = PaymentStatus.PARTIAL
            remaining_payment = 0.0

    ledger = CustomerLedger(
        customer_id=customer.id,
        entry_type=entry_in.entry_type,
        reference_no=entry_in.reference_no,
        debit_amount=entry_in.amount,
        credit_amount=0.0,
        balance_after=customer.credit_balance,
        payment_mode=entry_in.payment_mode,
        notes=entry_in.notes
    )
    db.add(ledger)
    db.commit()
    db.refresh(ledger)
    log_action(db, user_id=current_user.id, action_type="CUSTOMER_PAYMENT", entity="CUSTOMER", entity_id=str(customer.id), details={"amount": entry_in.amount})
    return ledger

# --- Excel Export & Import ---

@router.get("/export/excel")
def export_customers_excel(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    customers = db.query(Customer).filter(Customer.is_active == True).order_by(Customer.name).all()
    data = []
    for c in customers:
        data.append({
            "Customer Name": c.name,
            "Mobile Phone": c.phone,
            "City": c.city or "Dhule",
            "Birthday": c.date_of_birth or "",
            "Khata Due (₹)": c.credit_balance,
            "Lifetime Spend (₹)": c.total_spend,
            "Visits Count": c.visit_count,
            "Notes": c.notes or ""
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Customers')
    output.seek(0)

    filename = f"DollyToys_Customers_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/import/excel")
async def import_customers_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Bulk import customer records from Excel with automatic duplicate phone checking."""
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid Excel file format. Please upload a valid .xlsx or .xls file.")

    imported = 0
    skipped = 0

    for _, row in df.iterrows():
        name = str(row.get("Customer Name") or row.get("Name") or "").strip()
        phone = str(row.get("Mobile Phone") or row.get("Phone") or row.get("Mobile") or "").strip().replace(".0", "")
        city = str(row.get("City") or "Dhule").strip()
        dob = str(row.get("Birthday") or row.get("DOB") or "").strip()
        credit = float(row.get("Khata Due (₹)") or row.get("Opening Due") or row.get("Credit") or 0.0)

        if not name or name.lower() == "nan":
            name = "Customer"

        if not phone or phone.lower() == "nan":
            skipped += 1
            continue

        existing = db.query(Customer).filter(Customer.phone == phone).first()
        if existing:
            skipped += 1
            continue

        cust = Customer(
            name=name,
            phone=phone,
            city=city,
            date_of_birth=dob if dob != "nan" else None,
            credit_balance=credit
        )
        db.add(cust)
        db.flush()

        if credit > 0:
            ledger = CustomerLedger(
                customer_id=cust.id,
                entry_type=CustomerLedgerType.ADJUSTMENT,
                reference_no="BULK_IMPORT",
                credit_amount=credit,
                debit_amount=0.0,
                balance_after=credit,
                notes="Imported Opening Khata Balance"
            )
            db.add(ledger)

        imported += 1

    db.commit()
    log_action(db, user_id=current_user.id, action_type="IMPORT_CUSTOMERS", entity="CUSTOMER", details={"imported": imported, "skipped": skipped})
    return {"message": f"Successfully imported {imported} customers ({skipped} skipped/duplicates).", "imported": imported, "skipped": skipped}

@router.get("/reminders/birthdays")
def get_upcoming_birthdays(db: Session = Depends(get_db)):
    from app.core.timezone import get_ist_today
    today_month_day = get_ist_today().strftime("%m-%d")
    customers = db.query(Customer).filter(
        Customer.is_active == True,
        Customer.date_of_birth != None
    ).all()

    upcoming = []
    for c in customers:
        if c.date_of_birth and today_month_day in c.date_of_birth:
            upcoming.append({
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "date_of_birth": c.date_of_birth,
                "total_spend": c.total_spend
            })
    return upcoming
