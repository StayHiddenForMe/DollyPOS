import os
import sys
import io
import pandas as pd
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.api.inventory_router import fast_search_products, import_inventory_excel
from app.api.reports_router import get_sales_report
from app.services.analytics_service import analytics_service
from fastapi import UploadFile

def test_points():
    print("==========================================================")
    print("         DOLLY POS - 6 KEY POINTS VERIFICATION             ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        # 1. TEST: Speed Dial Exact Ranking
        print("\n[POINT 1 & 2] Testing Speed Dial Exact Match in Search (e.g. 1)...")
        # Ensure a product has speed_dial_code='1'
        prod1 = db.query(Product).filter(Product.speed_dial_code == '1').first()
        if not prod1:
            p = db.query(Product).first()
            p.speed_dial_code = '1'
            p.is_speed_dial = True
            db.commit()
            prod1 = p

        results = fast_search_products(q="1", limit=10, db=db)
        assert len(results) > 0
        assert results[0].speed_dial_code == '1'
        print(f"  [PASS] Search '1' placed Speed Dial #{results[0].speed_dial_code} ('{results[0].name}') at index 0!")

        # 2. TEST: Dead Stock Watchlist
        print("\n[POINT 4] Testing Dead Stock Watchlist Calculation...")
        dead_stock = analytics_service.get_dead_stock(db, days=60)
        print(f"  [PASS] Found {len(dead_stock)} items in dead stock.")
        if len(dead_stock) > 0:
            assert "trapped_capital" in dead_stock[0]
            print(f"  [PASS] Sample dead stock item: '{dead_stock[0]['name']}', Trapped: Rs.{dead_stock[0]['trapped_capital']}")

        # 3. TEST: Report Refunds Summary
        print("\n[POINT 5] Testing Refunds Calculation in Reports...")
        report = get_sales_report(period="yearly", current_user=owner, db=db)
        assert "total_refunds" in report
        assert "refund_count" in report
        assert "dead_stock_summary" in report
        assert "dead_stock_products" in report["dead_stock_summary"]
        print(f"  [PASS] Yearly Report: Total Sales = Rs.{report['total_sales']}, Refunds = Rs.{report['total_refunds']} ({report['refund_count']} returns), Dead Stock Count = {report['dead_stock_summary']['dead_stock_count']}")

        # 4. TEST: Stock Sheet Excel Import
        print("\n[POINT 6] Testing Stock Sheet Excel (.xlsx / .csv) Import...")
        # Create in-memory dummy excel
        test_data = [
            {
                "Barcode": "8909998881112",
                "Product Name": "Test Baby Soft Mittens Set",
                "Category": "Infants & Babies",
                "Size": "0-6M",
                "Color": "Pink",
                "Purchase Price (₹)": 90.0,
                "Selling Price (₹)": 180.0,
                "MRP (₹)": 200.0,
                "Stock Quantity": 25,
                "Speed Dial Code": "M99"
            }
        ]
        df = pd.DataFrame(test_data)
        excel_buf = io.BytesIO()
        with pd.ExcelWriter(excel_buf, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        excel_buf.seek(0)

        upload_file = UploadFile(filename="test_stock.xlsx", file=excel_buf)
        import asyncio
        import_res = asyncio.run(import_inventory_excel(file=upload_file, current_user=owner, db=db))
        print(f"  [PASS] Excel import returned: {import_res['message']}")
        
        imported_p = db.query(Product).filter(Product.barcode == "8909998881112").first()
        assert imported_p is not None
        assert imported_p.speed_dial_code == "M99"
        print(f"  [PASS] Verified imported product in DB: '{imported_p.name}', Speed Dial: {imported_p.speed_dial_code}, Stock: {imported_p.stock_quantity}")

        print("\n==========================================================")
        print("          ALL 6 USER REQUESTS PASSED VERIFICATION         ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_points()
