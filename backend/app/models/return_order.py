import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class ReturnType(str, enum.Enum):
    REFUND_CASH = "REFUND_CASH"
    REFUND_UPI = "REFUND_UPI"
    STORE_CREDIT = "STORE_CREDIT"
    EXCHANGE = "EXCHANGE"

class ReturnOrder(Base):
    __tablename__ = "returns"

    id = Column(Integer, primary_key=True, index=True)
    return_number = Column(String(50), unique=True, index=True, nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    total_refund_amount = Column(Float, default=0.0, nullable=False)
    return_type = Column(Enum(ReturnType), default=ReturnType.REFUND_CASH, nullable=False)
    reason = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="returns")
    customer = relationship("Customer", back_populates="returns")
    items = relationship("ReturnItem", back_populates="return_order", cascade="all, delete-orphan")

class ReturnItem(Base):
    __tablename__ = "return_items"

    id = Column(Integer, primary_key=True, index=True)
    return_id = Column(Integer, ForeignKey("returns.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    
    item_name = Column(String(200), nullable=False)
    barcode = Column(String(50), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    refund_price = Column(Float, default=0.0, nullable=False)
    is_defective = Column(Boolean, default=False, nullable=False)  # Restock vs Damaged pool
    restocked = Column(Boolean, default=True, nullable=False)

    # Relationships
    return_order = relationship("ReturnOrder", back_populates="items")
    product = relationship("Product", back_populates="return_items")
