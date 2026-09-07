import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class ExpenseCategory(str, enum.Enum):
    ELECTRICITY = "ELECTRICITY"
    TRANSPORT = "TRANSPORT"
    FOOD = "FOOD"
    MISCELLANEOUS = "MISCELLANEOUS"
    MARKETING = "MARKETING"
    REPAIRS = "REPAIRS"
    STAFF_SALARY = "STAFF_SALARY"
    SHOP_RENT = "SHOP_RENT"
    OTHER = "OTHER"

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(Enum(ExpenseCategory), default=ExpenseCategory.MISCELLANEOUS, nullable=False, index=True)
    title = Column(String(150), nullable=False)
    amount = Column(Float, default=0.0, nullable=False)
    payment_mode = Column(String(50), default="CASH", nullable=False)  # CASH, UPI, BANK
    paid_to = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    expense_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    logged_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    logged_by_user = relationship("User", back_populates="expenses")
