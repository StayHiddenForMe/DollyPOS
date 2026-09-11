from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.api.auth_router import get_current_user, require_owner
from app.models.user import User
from app.models.expense import Expense, ExpenseCategory
from app.schemas.expense_schema import ExpenseCreate, ExpenseUpdate, ExpenseOut, ExpenseSummary
from app.core.audit import log_action
from app.core.timezone import (
    get_ist_now,
    get_ist_today,
    get_ist_day_bounds_in_utc,
    get_ist_month_bounds_in_utc,
    get_ist_year_bounds_in_utc
)

router = APIRouter(prefix="/expenses", tags=["Expense Management"])

class BulkDeleteRequest(BaseModel):
    expense_ids: List[int]

@router.get("", response_model=List[ExpenseOut])
def list_expenses(
    category: Optional[ExpenseCategory] = None,
    period: Optional[str] = Query(None, description="daily, monthly, yearly, all, custom"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 500,
    db: Session = Depends(get_db)
):
    query = db.query(Expense).options(joinedload(Expense.logged_by_user))

    if period == "daily":
        start_dt, end_dt = get_ist_day_bounds_in_utc()
        query = query.filter(Expense.expense_date >= start_dt, Expense.expense_date <= end_dt)
    elif period == "monthly":
        start_dt, end_dt = get_ist_month_bounds_in_utc()
        query = query.filter(Expense.expense_date >= start_dt, Expense.expense_date <= end_dt)
    elif period == "yearly":
        start_dt, end_dt = get_ist_year_bounds_in_utc()
        query = query.filter(Expense.expense_date >= start_dt, Expense.expense_date <= end_dt)
    elif period == "custom" or start_date or end_date:
        if start_date:
            try:
                s_date = datetime.strptime(start_date.strip(), "%Y-%m-%d").date() if len(start_date.strip()) == 10 else datetime.fromisoformat(start_date).date()
                s_dt, _ = get_ist_day_bounds_in_utc(s_date)
                query = query.filter(Expense.expense_date >= s_dt)
            except Exception:
                pass
        if end_date:
            try:
                e_date = datetime.strptime(end_date.strip(), "%Y-%m-%d").date() if len(end_date.strip()) == 10 else datetime.fromisoformat(end_date).date()
                _, e_dt = get_ist_day_bounds_in_utc(e_date)
                query = query.filter(Expense.expense_date <= e_dt)
            except Exception:
                pass

    if category:
        query = query.filter(Expense.category == category)
        
    expenses = query.order_by(desc(Expense.expense_date)).limit(limit).all()
    results = []
    for e in expenses:
        e_out = ExpenseOut.model_validate(e)
        e_out.logged_by_name = e.logged_by_user.full_name if e.logged_by_user else None
        results.append(e_out)
    return results

@router.post("", response_model=ExpenseOut)
def create_expense(
    expense_in: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    expense = Expense(
        **expense_in.model_dump(),
        logged_by=current_user.id,
        created_at=datetime.utcnow()
    )
    if not expense.expense_date:
        expense.expense_date = datetime.utcnow()

    db.add(expense)
    db.commit()
    db.refresh(expense)

    log_action(db, user_id=current_user.id, action_type="CREATE_EXPENSE", entity="EXPENSE", entity_id=str(expense.id), details={"title": expense.title, "amount": expense.amount})
    
    e_out = ExpenseOut.model_validate(expense)
    e_out.logged_by_name = current_user.full_name
    return e_out

@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    log_action(db, user_id=current_user.id, action_type="DELETE_EXPENSE", entity="EXPENSE", entity_id=str(expense_id))
    return {"message": "Expense deleted"}

@router.post("/bulk-delete")
def bulk_delete_expenses(
    req: BulkDeleteRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    deleted_count = db.query(Expense).filter(Expense.id.in_(req.expense_ids)).delete(synchronize_session=False)
    db.commit()
    log_action(db, user_id=current_user.id, action_type="BULK_DELETE_EXPENSES", entity="EXPENSE", details={"count": deleted_count, "ids": req.expense_ids})
    return {"message": f"Successfully deleted {deleted_count} expenses"}

@router.get("/summary", response_model=ExpenseSummary)
def get_expense_summary(
    period: str = Query("monthly", description="daily, monthly, yearly, all"),
    category: Optional[ExpenseCategory] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Expense)

    if period == "daily":
        start_dt, end_dt = get_ist_day_bounds_in_utc()
        query = query.filter(Expense.expense_date >= start_dt, Expense.expense_date <= end_dt)
    elif period == "monthly":
        start_dt, end_dt = get_ist_month_bounds_in_utc()
        query = query.filter(Expense.expense_date >= start_dt, Expense.expense_date <= end_dt)
    elif period == "yearly":
        start_dt, end_dt = get_ist_year_bounds_in_utc()
        query = query.filter(Expense.expense_date >= start_dt, Expense.expense_date <= end_dt)

    if category:
        query = query.filter(Expense.category == category)

    expenses = query.all()
    
    total = sum(e.amount for e in expenses)
    by_cat = {}
    for e in expenses:
        cat_key = e.category.value if hasattr(e.category, 'value') else str(e.category)
        by_cat[cat_key] = round(by_cat.get(cat_key, 0.0) + e.amount, 2)

    return ExpenseSummary(
        total_amount=round(total, 2),
        by_category=by_cat,
        count=len(expenses)
    )
