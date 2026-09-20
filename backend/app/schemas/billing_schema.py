from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.invoice import PaymentMode, PaymentStatus

class InvoiceItemCreate(BaseModel):
    product_id: Optional[int] = None
    item_name: str
    barcode: Optional[str] = None
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int = 1
    unit_price: float
    cost_price: float = 0.0
    discount_amount: float = 0.0
    tax_percent: float = 0.0
    tax_amount: float = 0.0
    total_price: float
    is_unlisted: bool = False

class InvoiceItemOut(BaseModel):
    id: int
    product_id: Optional[int] = None
    item_name: str
    barcode: Optional[str] = None
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int
    unit_price: float
    discount_amount: float
    tax_percent: float
    tax_amount: float
    total_price: float
    is_unlisted: bool

    class Config:
        from_attributes = True

class PaymentCreate(BaseModel):
    payment_mode: PaymentMode
    amount: float
    transaction_ref: Optional[str] = None

class PaymentOut(BaseModel):
    id: int
    payment_mode: PaymentMode
    amount: float
    transaction_ref: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class InvoiceCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    subtotal: float
    discount_amount: float = 0.0
    discount_type: str = "FLAT"
    tax_amount: float = 0.0
    extra_charges_amount: float = 0.0
    extra_charges_breakdown: Optional[str] = None
    round_off: float = 0.0
    grand_total: float
    paid_amount: float
    change_amount: float = 0.0
    due_amount: float = 0.0
    payment_mode: PaymentMode = PaymentMode.CASH
    payment_status: PaymentStatus = PaymentStatus.PAID
    is_held: bool = False
    is_gift_receipt: bool = False
    notes: Optional[str] = None
    items: List[InvoiceItemCreate]
    payments: Optional[List[PaymentCreate]] = None

class InvoiceOut(BaseModel):
    id: int
    bill_number: str
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    cashier_id: Optional[int] = None
    subtotal: float
    discount_amount: float
    discount_type: str
    tax_amount: float
    extra_charges_amount: float = 0.0
    extra_charges_breakdown: Optional[str] = None
    round_off: float
    grand_total: float
    paid_amount: float
    change_amount: float
    due_amount: float
    payment_mode: PaymentMode
    payment_status: PaymentStatus
    is_held: bool
    is_cancelled: bool
    is_gift_receipt: bool
    notes: Optional[str] = None
    created_at: datetime
    items: List[InvoiceItemOut] = []
    payments: List[PaymentOut] = []

    class Config:
        from_attributes = True

class HeldBillSummary(BaseModel):
    id: int
    bill_number: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    item_count: int
    grand_total: float
    created_at: datetime
