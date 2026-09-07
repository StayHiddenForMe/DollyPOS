import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.product_price_history import ProductPriceHistory
from app.api.reports_router import get_sales_report, get_yoy_comparison, get_category_boom_analysis, get_seasonal_festival_calendar
from app.api.ai_router import ask_ai_copilot, AIChatRequest

def test_reports_and_calendar():
    print("==========================================================")
    print("    DOLLY POS - YoY, CALENDAR & AI ADVISOR TEST SUITE     ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        # 1. Custom Range Report
        print("\n[TEST 1] Testing Custom Date Range in Reports & P&L...")
        custom_rep = get_sales_report(period="custom", start_date="2026-01-01", end_date="2026-08-25", current_user=owner, db=db)
        assert "total_sales" in custom_rep
        assert "take_home_net_profit" in custom_rep
        print(f"  [PASS] Custom Range (2026-01-01 to 2026-08-25): Sales = Rs.{custom_rep['total_sales']}, Net Profit = Rs.{custom_rep['take_home_net_profit']}")

        # 2. YoY Comparison Engine
        print("\n[TEST 2] Testing YoY Comparison for 'Raincoat' & 'Wear'...")
        yoy_res = get_yoy_comparison(query="Raincoat", current_user=owner, db=db)
        assert "this_year" in yoy_res
        assert "last_year" in yoy_res
        assert "monthly_trend" in yoy_res
        print(f"  [PASS] YoY 'Raincoat': This Year = Rs.{yoy_res['this_year']['revenue']} ({yoy_res['this_year']['units_sold']} pcs), Last Year = Rs.{yoy_res['last_year']['revenue']} ({yoy_res['last_year']['units_sold']} pcs), Growth = {yoy_res['yoy_growth_revenue_percent']}%")

        # 3. Category Boom Radar
        print("\n[TEST 3] Testing Category Boom & Surge Momentum...")
        boom_res = get_category_boom_analysis(current_user=owner, db=db)
        assert len(boom_res) > 0
        clean_status = boom_res[0]['momentum_status'].encode('ascii', 'ignore').decode('ascii').strip()
        print(f"  [PASS] #1 Trending Category: '{boom_res[0]['category_name']}', Revenue: Rs.{boom_res[0]['this_month_revenue']}, Status: {clean_status}")

        # 4. Seasonal & Festival Calendar
        print("\n[TEST 4] Testing Perpetual Festival Calendar (2026)...")
        cal_res = get_seasonal_festival_calendar(year=2026, current_user=owner)
        assert "festivals" in cal_res
        assert len(cal_res["festivals"]) >= 15
        ganesh = next((f for f in cal_res["festivals"] if "Ganesh" in f["name"]), None)
        diwali = next((f for f in cal_res["festivals"] if "Diwali" in f["name"]), None)
        assert ganesh is not None
        assert diwali is not None
        print(f"  [PASS] Found Ganesh Chaturthi on {ganesh['date']} ({ganesh['status_text']})")
        print(f"  [PASS] Found Diwali on {diwali['date']} ({diwali['status_text']})")

        # 5. AI Copilot YoY & Boom Query Tests
        print("\n[TEST 5] Testing AI Copilot Natural Language Answers...")
        ai_res1 = ask_ai_copilot(AIChatRequest(query="Compare raincoat sales this year vs last year"), current_user=owner, db=db)
        assert "Year-over-Year" in ai_res1["answer"]
        print(f"  [PASS] AI Copilot YoY Query Answer Length: {len(ai_res1['answer'])} chars")

        ai_res2 = ask_ai_copilot(AIChatRequest(query="Which category boomed this month?"), current_user=owner, db=db)
        assert "Momentum" in ai_res2["answer"]
        print(f"  [PASS] AI Copilot Category Boom Answer Length: {len(ai_res2['answer'])} chars")

        print("\n==========================================================")
        print("          ALL ADVANCED FEATURES PASSED (100%)             ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_reports_and_calendar()
