from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.expense import ExpenseCategory

class ExpenseBase(BaseModel):
    category: ExpenseCategory
    title: str
    amount: float
    payment_mode: str = "CASH"
    paid_to: Optional[str] = None
    notes: Optional[str] = None
    expense_date: Optional[datetime] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    category: Optional[ExpenseCategory] = None
    title: Optional[str] = None
    amount: Optional[float] = None
    payment_mode: Optional[str] = None
    paid_to: Optional[str] = None
    notes: Optional[str] = None
    expense_date: Optional[datetime] = None

class ExpenseOut(ExpenseBase):
    id: int
    logged_by: Optional[int] = None
    created_at: datetime
    logged_by_name: Optional[str] = None

    class Config:
        from_attributes = True

class ExpenseSummary(BaseModel):
    total_amount: float
    by_category: dict
    count: int
