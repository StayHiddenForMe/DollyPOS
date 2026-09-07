import os
import sys
import asyncio
from starlette.requests import Request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.api.dashboard_router import get_dashboard_metrics
from app.models.user import User

def test_dashboard_routes():
    print("Testing Dashboard Metrics Endpoint Aliases...")
    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        res = get_dashboard_metrics(current_user=owner, db=db)
        assert "today_sales" in res
        assert "top_selling_products" in res
        print(f"[PASS] Dashboard metrics resolved! Today Sales: Rs.{res['today_sales']}, Bills: {res['today_bills_count']}")
    finally:
        db.close()

if __name__ == "__main__":
    test_dashboard_routes()
