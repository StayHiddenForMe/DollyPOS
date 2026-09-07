from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.customer import CustomerLedgerType

class CustomerBase(BaseModel):
    name: Optional[str] = "Customer"
    phone: Optional[str] = None
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "Dhule"
    date_of_birth: Optional[str] = None
    anniversary_date: Optional[str] = None
    favorite_category: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True

class CustomerCreate(CustomerBase):
    opening_credit_balance: float = 0.0

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    date_of_birth: Optional[str] = None
    anniversary_date: Optional[str] = None
    favorite_category: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class CustomerOut(CustomerBase):
    id: int
    phone: Optional[str] = None
    credit_balance: float
    total_spend: float
    visit_count: int
    created_at: datetime
    last_visit_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CustomerLedgerEntryCreate(BaseModel):
    customer_id: int
    entry_type: CustomerLedgerType
    amount: float
    payment_mode: Optional[str] = "CASH"
    reference_no: Optional[str] = None
    notes: Optional[str] = None

class CustomerLedgerEntryOut(BaseModel):
    id: int
    customer_id: int
    entry_type: CustomerLedgerType
    reference_no: Optional[str] = None
    debit_amount: float
    credit_amount: float
    balance_after: float
    payment_mode: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
