from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.vendor import VendorLedgerType

class VendorBase(BaseModel):
    vendor_code: Optional[str] = None
    name: str
    company_name: Optional[str] = None
    phone: str
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    notes: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_holder_name: Optional[str] = None
    vendor_upi_id: Optional[str] = None
    is_active: bool = True

class VendorCreate(VendorBase):
    opening_due: float = 0.0

class VendorUpdate(BaseModel):
    vendor_code: Optional[str] = None
    name: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    notes: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_holder_name: Optional[str] = None
    vendor_upi_id: Optional[str] = None
    is_active: Optional[bool] = None

class VendorOut(VendorBase):
    id: int
    outstanding_due: float
    created_at: datetime

    class Config:
        from_attributes = True

class VendorLedgerEntryCreate(BaseModel):
    vendor_id: int
    entry_type: VendorLedgerType
    amount: float
    payment_mode: Optional[str] = "CASH"
    reference_no: Optional[str] = None
    notes: Optional[str] = None

class VendorLedgerEntryOut(BaseModel):
    id: int
    vendor_id: int
    entry_type: VendorLedgerType
    reference_no: Optional[str] = None
    debit_amount: float
    credit_amount: float
    balance_after: float
    payment_mode: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
