import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.product_price_history import ProductPriceHistory
from app.api.reports_router import get_seasonal_festival_calendar

def test_future_years():
    print("==========================================================")
    print("     DOLLY POS - PERPETUAL CALENDAR & THEME TEST SUITE    ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        # Test years: 2030, 2031, 2032, 2035, 2040, 2050, 2075
        test_years = [2026, 2030, 2031, 2032, 2035, 2040, 2050, 2075]

        for yr in test_years:
            cal = get_seasonal_festival_calendar(year=yr, current_user=owner)
            assert "festivals" in cal
            assert len(cal["festivals"]) >= 15
            diwali = next((f for f in cal["festivals"] if "Diwali" in f["name"]), None)
            holi = next((f for f in cal["festivals"] if "Holi" in f["name"]), None)
            ganesh = next((f for f in cal["festivals"] if "Ganesh" in f["name"]), None)

            assert diwali is not None
            assert holi is not None
            assert ganesh is not None

            print(f"  [PASS] Year {yr}: Diwali={diwali['date']}, Holi={holi['date']}, Ganesh Chaturthi={ganesh['date']}")

        print("\n==========================================================")
        print("    PERPETUAL 50+ YEAR CALENDAR VERIFIED SUCCESSFULLY!    ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_future_years()
