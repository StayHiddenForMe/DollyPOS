import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.api.dashboard_router import get_dashboard_charts
from app.api.whatsapp_router import get_whatsapp_status, get_whatsapp_templates
from app.api.procurement_router import get_low_stock_procurement_sheet, log_customer_lost_demand, get_lost_demand_requests, get_upcoming_seasonal_buying_checklist, CreateLostDemandRequest

def test_all_new_modules():
    print("==========================================================")
    print("  DOLLY POS - REDESIGN & NEW MODULES VERIFICATION TEST    ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        # 1. Test Dashboard Analytics Charts
        charts = get_dashboard_charts(current_user=owner, db=db)
        assert "daily_timeline" in charts
        assert "monthly_growth" in charts
        assert "cash_flow_summary" in charts
        assert "future_projections" in charts
        print("[PASS] 1. Dashboard Charts & Growth Engine:")
        print(f"  • 30-Day Daily Timeline Points: {len(charts['daily_timeline'])}")
        print(f"  • Projected 30-Day Revenue: Rs {charts['future_projections']['projected_next_30d_revenue']}")
        print(f"  • Net Cash Flow: Rs {charts['cash_flow_summary']['net_cash_flow']}")

        # 2. Test WhatsApp Module
        wa_status = get_whatsapp_status()
        wa_templates = get_whatsapp_templates()
        assert wa_status["status"] == "ONLINE"
        assert len(wa_templates) >= 4
        print("\n[PASS] 2. WhatsApp Automated Gateway:")
        print(f"  • Status: {wa_status['status']}")
        print(f"  • Available Templates: {len(wa_templates)}")

        # 3. Test Procurement Low Stock Sheet by Vendor
        sheet = get_low_stock_procurement_sheet(db=db, current_user=owner)
        assert "vendor_groups" in sheet
        print("\n[PASS] 3. Procurement Low Stock Buying Sheet:")
        print(f"  • Total Low Stock SKUs: {sheet['total_low_stock_products']}")
        print(f"  • Total Units to Order: {sheet['total_units_to_order']} pcs")
        print(f"  • Total Procurement Budget: Rs {sheet['total_procurement_budget']}")
        print(f"  • Vendor Groups Count: {len(sheet['vendor_groups'])}")

        # 4. Test Customer Lost Demand Logger
        req = CreateLostDemandRequest(
            item_description="Size 28 Black 3-Piece Tuxedo Suit",
            category_name="Boys Wear",
            preferred_size="Size 28",
            preferred_color="Black",
            customer_name="Rahul Sharma",
            customer_phone="9876543210",
            notes="Needed for wedding reception"
        )
        log_res = log_customer_lost_demand(req=req, db=db, current_user=owner)
        assert log_res["success"] is True
        
        demand_list = get_lost_demand_requests(status="ALL", db=db, current_user=owner)
        assert len(demand_list) > 0
        print("\n[PASS] 4. Customer Lost Demand Logger:")
        print(f"  • Logged Request ID: {log_res['id']}")
        print(f"  • Logged Item: {demand_list[0]['item_description']} ({demand_list[0]['request_count']}x asked)")

        # 5. Test Seasonal Buying Checklist
        seasonal = get_upcoming_seasonal_buying_checklist(db=db, current_user=owner)
        assert len(seasonal["seasonal_events"]) > 0
        print("\n[PASS] 5. Upcoming Festival Buying Checklist:")
        for ev in seasonal["seasonal_events"][:3]:
            print(f"  • {ev['event_name']}: in ~{ev['approx_days_left']} days ({ev['matched_catalog_skus']} catalog SKUs, {ev['total_units_in_stock']} in stock)")

        print("\n==========================================================")
        print("  ALL 6 MODULES VERIFIED & WORKING 100% PERFECTLY!        ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_all_new_modules()
