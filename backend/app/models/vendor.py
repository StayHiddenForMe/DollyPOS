import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    vendor_code = Column(String(20), unique=True, index=True, nullable=True) # e.g. SUR01, DEL01, MUM01
    name = Column(String(100), nullable=False, index=True)
    company_name = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=False, index=True)
    alt_phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    gstin = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(50), nullable=True)
    state = Column(String(50), default="Maharashtra", nullable=True)
    notes = Column(Text, nullable=True)
    
    # Banking Details
    bank_name = Column(String(100), nullable=True)
    bank_account_no = Column(String(50), nullable=True)
    bank_ifsc = Column(String(20), nullable=True)
    bank_holder_name = Column(String(100), nullable=True)
    vendor_upi_id = Column(String(100), nullable=True)

    outstanding_due = Column(Float, default=0.0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    purchases = relationship("Purchase", back_populates="vendor")
    ledger_entries = relationship("VendorLedger", back_populates="vendor", cascade="all, delete-orphan")

class VendorLedgerType(str, enum.Enum):
    PURCHASE_BILL = "PURCHASE_BILL"
    PAYMENT_MADE = "PAYMENT_MADE"
    PURCHASE_RETURN = "PURCHASE_RETURN"
    ADJUSTMENT = "ADJUSTMENT"

class VendorLedger(Base):
    __tablename__ = "vendor_ledger"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    entry_type = Column(Enum(VendorLedgerType), nullable=False)
    reference_no = Column(String(100), nullable=True)
    debit_amount = Column(Float, default=0.0, nullable=False)
    credit_amount = Column(Float, default=0.0, nullable=False)
    balance_after = Column(Float, default=0.0, nullable=False)
    payment_mode = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    vendor = relationship("Vendor", back_populates="ledger_entries")
