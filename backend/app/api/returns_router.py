from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.api.auth_router import get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.customer import Customer, CustomerLedger, CustomerLedgerType
from app.models.invoice import Invoice, InvoiceItem, Payment, PaymentMode, PaymentStatus
from app.models.return_order import ReturnOrder, ReturnItem, ReturnType
from app.schemas.return_schema import ReturnOrderCreate, ReturnOrderOut
from app.core.audit import log_action
from app.api.billing_router import generate_bill_number

router = APIRouter(prefix="/returns", tags=["Returns & Exchanges Engine"])

class ExchangeItemPayload(BaseModel):
    product_id: int
    quantity: int = 1
    unit_price: float

class ExchangeProcessRequest(BaseModel):
    original_bill_number: Optional[str] = None
    invoice_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    returned_items: List[dict]  # [{"product_id": 1, "item_name": "...", "barcode": "...", "quantity": 1, "refund_price": 799, "is_defective": false}]
    exchange_items: List[ExchangeItemPayload] = [] # New replacement items
    total_returned_value: float
    total_new_items_value: float
    net_difference: float  # >0: Collect from customer, <0: Refund to customer, 0: Even
    settlement_mode: str = "CASH"  # CASH, UPI, STORE_CREDIT
    reason: Optional[str] = "Exchange / Return"

def generate_return_number(db: Session) -> str:
    from app.core.timezone import get_ist_now
    ist_now = get_ist_now()
    today_str = ist_now.strftime("%Y%m%d")
    prefix = f"RET-{today_str}-"
    last_ret = db.query(ReturnOrder).filter(ReturnOrder.return_number.like(f"{prefix}%")).order_by(desc(ReturnOrder.id)).first()
    seq = (int(last_ret.return_number.split("-")[-1]) + 1) if last_ret else 1
    return f"{prefix}{seq:04d}"

@router.post("/process-exchange")
def process_exchange_order(
    req: ExchangeProcessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Handles full Return & Exchange transaction:
    1. Records return voucher and restocks or marks defective returned items
    2. If new items chosen, deducts stock of new items and generates an exchange bill
    3. Handles cash collection / refund / store credit
    """
    if not req.returned_items and not req.exchange_items:
        raise HTTPException(status_code=400, detail="No return or exchange items provided")

    # 1. Create Return Record
    ret_number = generate_return_number(db)
    return_order = ReturnOrder(
        return_number=ret_number,
        invoice_id=req.invoice_id,
        cashier_id=current_user.id,
        total_refund_amount=req.total_returned_value,
        return_type=ReturnType.EXCHANGE if req.exchange_items else ReturnType.REFUND_CASH,
        reason=req.reason,
        created_at=datetime.utcnow()
    )
    db.add(return_order)
    db.flush()

    for item in req.returned_items:
        prod_id = item.get("product_id")
        qty = item.get("quantity", 1)
        is_def = item.get("is_defective", False)

        ret_item = ReturnItem(
            return_id=return_order.id,
            product_id=prod_id,
            item_name=item.get("item_name", "Returned Item"),
            barcode=item.get("barcode"),
            quantity=qty,
            refund_price=item.get("refund_price", 0.0),
            is_defective=is_def,
            restocked=not is_def
        )
        db.add(ret_item)

        # Restock / Defective pool
        if prod_id:
            prod = db.query(Product).filter(Product.id == prod_id).first()
            if prod:
                if is_def:
                    prod.damaged_quantity += qty
                else:
                    prod.stock_quantity += qty

    # 2. If new replacement items chosen, generate Exchange Invoice
    new_bill_number = None
    if req.exchange_items:
        new_bill_number = generate_bill_number(db)
        exchange_invoice = Invoice(
            bill_number=new_bill_number,
            customer_name=req.customer_name or "Walk-in Exchange",
            customer_phone=req.customer_phone or None,
            cashier_id=current_user.id,
            subtotal=req.total_new_items_value,
            discount_amount=req.total_returned_value,  # Value of returned item applied as discount
            discount_type="RETURN_EXCHANGE",
            tax_amount=0.0,
            round_off=0.0,
            grand_total=max(0.0, req.net_difference),
            paid_amount=max(0.0, req.net_difference),
            change_amount=0.0,
            due_amount=0.0,
            payment_mode=PaymentMode.CASH if req.settlement_mode == "CASH" else PaymentMode.UPI,
            payment_status=PaymentStatus.PAID,
            notes=f"Exchange for Return {ret_number} (Orig Bill: {req.original_bill_number or 'N/A'})",
            created_at=datetime.utcnow()
        )
        db.add(exchange_invoice)
        db.flush()

        for ex_item in req.exchange_items:
            p = db.query(Product).filter(Product.id == ex_item.product_id).first()
            if p:
                p.stock_quantity = max(0, p.stock_quantity - ex_item.quantity)
                inv_item = InvoiceItem(
                    invoice_id=exchange_invoice.id,
                    product_id=p.id,
                    item_name=p.name,
                    barcode=p.barcode,
                    size=p.size,
                    color=p.color,
                    quantity=ex_item.quantity,
                    unit_price=ex_item.unit_price,
                    cost_price=p.purchase_price,
                    discount_amount=0.0,
                    tax_percent=0.0,
                    tax_amount=0.0,
                    total_price=ex_item.unit_price * ex_item.quantity,
                    is_unlisted=False
                )
                db.add(inv_item)

    db.commit()
    db.refresh(return_order)

    log_action(db, user_id=current_user.id, action_type="EXCHANGE_PROCESSED", entity="RETURN", entity_id=str(return_order.id), details={"return_number": ret_number, "net_difference": req.net_difference})

    return {
        "success": True,
        "return_number": ret_number,
        "new_bill_number": new_bill_number,
        "net_difference": req.net_difference,
        "action": "COLLECT_DIFFERENCE" if req.net_difference > 0 else ("REFUND_DIFFERENCE" if req.net_difference < 0 else "EVEN_EXCHANGE"),
        "message": "Return / Exchange completed and stock adjusted."
    }

@router.get("/history", response_model=List[ReturnOrderOut])
def get_return_history(limit: int = 50, db: Session = Depends(get_db)):
    return db.query(ReturnOrder).options(
        joinedload(ReturnOrder.items)
    ).order_by(desc(ReturnOrder.created_at)).limit(limit).all()
