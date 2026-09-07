from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.return_order import ReturnType

class ReturnItemCreate(BaseModel):
    product_id: Optional[int] = None
    item_name: str
    barcode: Optional[str] = None
    quantity: int = 1
    refund_price: float
    is_defective: bool = False
    restocked: bool = True

class ReturnItemOut(BaseModel):
    id: int
    product_id: Optional[int] = None
    item_name: str
    barcode: Optional[str] = None
    quantity: int
    refund_price: float
    is_defective: bool
    restocked: bool

    class Config:
        from_attributes = True

class ReturnOrderCreate(BaseModel):
    invoice_id: Optional[int] = None
    customer_id: Optional[int] = None
    return_type: ReturnType = ReturnType.REFUND_CASH
    total_refund_amount: float
    reason: Optional[str] = None
    notes: Optional[str] = None
    items: List[ReturnItemCreate]

class ReturnOrderOut(BaseModel):
    id: int
    return_number: str
    invoice_id: Optional[int] = None
    customer_id: Optional[int] = None
    cashier_id: Optional[int] = None
    total_refund_amount: float
    return_type: ReturnType
    reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    items: List[ReturnItemOut] = []

    class Config:
        from_attributes = True
