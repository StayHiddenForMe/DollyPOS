import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.api.reports_router import get_yoy_comparison

def test_yoy_size_breakdown():
    print("==========================================================")
    print("  DOLLY POS - YoY & SIZE-BY-SIZE STOCK BREAKDOWN TEST     ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        # Test querying "Raincoat" or "Wear"
        data = get_yoy_comparison(query="Wear", current_user=owner, db=db)
        assert "size_breakdown" in data
        assert "inventory_summary" in data

        print(f"\n[PASS] YoY Comparison for query: '{data['search_query']}'")
        print(f"  • Live In Stock: {data['inventory_summary']['total_in_stock']} pcs")
        print(f"  • Total Sold: {data['inventory_summary']['total_sold_all_time']} pcs")
        print(f"  * Best Selling Size: {data['inventory_summary']['best_selling_size']}")
        print(f"  * Smart Advice: {data['inventory_summary']['smart_advice'].encode('ascii', 'replace').decode('ascii')}")

        print("\n  Size Matrix Breakdown:")
        for s in data["size_breakdown"][:5]:
            print(f"    - Size {s['size']}: Sold {s['sold_units']} pcs | In Stock: {s['in_stock']} pcs | Sell-Through: {s['sell_through_percent']}%")

        print("\n==========================================================")
        print("  SIZE-BY-SIZE & SEASONAL STOCK ANALYSIS PASSED (100%)   ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_yoy_size_breakdown()
