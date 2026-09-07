import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

class PaymentStatus(str, enum.Enum):
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    CREDIT = "CREDIT"
    REFUNDED = "REFUNDED"

class PaymentMode(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    CREDIT_KHATA = "CREDIT_KHATA"
    CREDIT = "CREDIT_KHATA"
    KHATA = "CREDIT_KHATA"
    CARD = "CARD"
    SPLIT = "SPLIT"

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    bill_number = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Financials
    subtotal = Column(Float, default=0.0, nullable=False)
    discount_amount = Column(Float, default=0.0, nullable=False)
    discount_type = Column(String(20), default="FLAT", nullable=False)  # 'FLAT' or 'PERCENT'
    tax_amount = Column(Float, default=0.0, nullable=False)
    round_off = Column(Float, default=0.0, nullable=False)
    grand_total = Column(Float, default=0.0, nullable=False)
    
    # Tender
    paid_amount = Column(Float, default=0.0, nullable=False)
    change_amount = Column(Float, default=0.0, nullable=False)
    due_amount = Column(Float, default=0.0, nullable=False)
    
    # State & Flags
    payment_mode = Column(Enum(PaymentMode), default=PaymentMode.CASH, nullable=False)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.PAID, nullable=False)
    is_held = Column(Boolean, default=False, nullable=False)
    is_cancelled = Column(Boolean, default=False, nullable=False)
    is_gift_receipt = Column(Boolean, default=False, nullable=False)
    
    # Customer Details Snapshot
    customer_name = Column(String(100), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    customer = relationship("Customer", back_populates="invoices")
    cashier = relationship("User", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")
    returns = relationship("ReturnOrder", back_populates="invoice")

    __table_args__ = (
        Index("idx_invoice_date_search", "created_at", "bill_number"),
    )

class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    
    # Product snapshot
    item_name = Column(String(200), nullable=False)
    barcode = Column(String(50), nullable=True)
    sku = Column(String(50), nullable=True)
    size = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    
    # Pricing & Quantities
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)
    cost_price = Column(Float, default=0.0, nullable=False)
    discount_amount = Column(Float, default=0.0, nullable=False)
    tax_percent = Column(Float, default=0.0, nullable=False)
    tax_amount = Column(Float, default=0.0, nullable=False)
    total_price = Column(Float, default=0.0, nullable=False)
    
    # Special flags
    is_unlisted = Column(Boolean, default=False, nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product", back_populates="invoice_items")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    payment_mode = Column(Enum(PaymentMode), nullable=False)
    amount = Column(Float, default=0.0, nullable=False)
    transaction_ref = Column(String(100), nullable=True)  # e.g., UPI ref / Card last 4 digits
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
