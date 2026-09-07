from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.purchase import PurchaseStatus, PurchasePaymentStatus

class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: int = 1
    cost_price: float
    selling_price: float
    gst_percent: float = 0.0

class PurchaseItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    barcode: Optional[str] = None
    quantity: int
    cost_price: float
    selling_price: float
    gst_percent: float
    total_cost: float

    class Config:
        from_attributes = True

class PurchaseCreate(BaseModel):
    vendor_id: int
    supplier_invoice_no: Optional[str] = None
    invoice_date: Optional[datetime] = None
    shipping_charges: float = 0.0
    discount_amount: float = 0.0
    paid_amount: float = 0.0
    payment_mode: Optional[str] = "CASH"
    notes: Optional[str] = None
    items: List[PurchaseItemCreate]

class PurchaseOut(BaseModel):
    id: int
    purchase_number: str
    vendor_id: int
    supplier_invoice_no: Optional[str] = None
    invoice_date: datetime
    subtotal: float
    tax_amount: float
    discount_amount: float
    shipping_charges: float
    total_amount: float
    paid_amount: float
    due_amount: float
    status: PurchaseStatus
    payment_status: PurchasePaymentStatus
    notes: Optional[str] = None
    created_at: datetime
    vendor_name: Optional[str] = None
    items: List[PurchaseItemOut] = []

    class Config:
        from_attributes = True
