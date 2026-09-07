import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    alt_phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(50), default="Dhule", nullable=True)
    date_of_birth = Column(String(20), nullable=True)     # DD-MM or YYYY-MM-DD for child/parent birthday
    anniversary_date = Column(String(20), nullable=True)  # DD-MM or YYYY-MM-DD
    
    # Financials & Loyalty
    credit_balance = Column(Float, default=0.0, nullable=False)  # Khata dues balance
    total_spend = Column(Float, default=0.0, nullable=False)
    visit_count = Column(Integer, default=0, nullable=False)
    favorite_category = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_visit_at = Column(DateTime, nullable=True)

    # Relationships
    invoices = relationship("Invoice", back_populates="customer")
    ledger_entries = relationship("CustomerLedger", back_populates="customer", cascade="all, delete-orphan")
    returns = relationship("ReturnOrder", back_populates="customer")

class CustomerLedgerType(str, enum.Enum):
    BILL_CREDIT = "BILL_CREDIT"            # Customer purchased on credit (+ due)
    CREDIT_SALE = "BILL_CREDIT"            # Backward compatibility alias
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"  # Customer paid (- due)
    RETURN_CREDIT = "RETURN_CREDIT"        # Customer returned item (- due)
    ADJUSTMENT = "ADJUSTMENT"

class CustomerLedger(Base):
    __tablename__ = "customer_ledger"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    entry_type = Column(Enum(CustomerLedgerType), nullable=False)
    reference_no = Column(String(100), nullable=True)  # e.g., Bill Number or Receipt No
    debit_amount = Column(Float, default=0.0, nullable=False)   # Payment received (reduces credit due)
    credit_amount = Column(Float, default=0.0, nullable=False)  # Credit sale (increases customer due)
    balance_after = Column(Float, default=0.0, nullable=False)
    payment_mode = Column(String(50), nullable=True)  # 'CASH', 'UPI', etc.
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="ledger_entries")
