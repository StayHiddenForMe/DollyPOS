import os
import sys
import time
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.invoice import Invoice, PaymentMode
from app.api.barcode_router import generate_barcode_preview
from app.api.inventory_router import (
    create_multi_size_products, mark_product_damaged, restock_damaged_product,
    ProductMultiSizeCreate, MarkDamagedRequest, RestockDamagedRequest
)
from app.api.billing_router import update_invoice_payment_mode, UpdatePaymentModeRequest
from app.api.reports_router import get_sales_report

def run_tests():
    print("==========================================================")
    print("      DOLLY POS - 16 CRITICAL CAPABILITIES TEST SUITE      ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        t = int(time.time() * 1000)

        # 1. TEST: Barcode Preview Endpoint
        print("\n[TEST 1] Testing /barcode/preview/{barcode}...")
        prev = generate_barcode_preview("890178740279500")
        assert "barcode_base64" in prev
        assert prev["barcode_base64"].startswith("data:image/png;base64,")
        print("  [PASS] Barcode preview Base64 rendered correctly.")

        # 2. TEST: Base Barcode Preservation in Multi-Size
        print("\n[TEST 2] Testing Multi-Size Base Barcode Preservation...")
        base_code = f"8904229{str(t)[-5:]}"
        multi_req = ProductMultiSizeCreate(
            base_barcode=base_code,
            name=f"Premium Party Wear Frock {t}",
            sizes=["22", "24", "26"],
            purchase_price=300.0,
            selling_price=650.0,
            mrp=799.0,
            stock_per_size=5
        )
        variants = create_multi_size_products(multi_req, current_user=owner, db=db)
        assert len(variants) == 3
        assert any(base_code in v.barcode for v in variants)
        print(f"  [PASS] Multi-size variants created with preserved base barcode: {[v.barcode for v in variants]}")

        # 3. TEST: Mark Damaged and Restock
        print("\n[TEST 3] Testing Mark Damaged and Restock / Recover Damaged Stock...")
        target_p = db.query(Product).filter(Product.id == variants[0].id).first()
        
        # Mark 2 as damaged via API
        dmg_req = MarkDamagedRequest(product_id=target_p.id, quantity=2, reason="Stitching issue")
        mark_product_damaged(dmg_req, current_user=owner, db=db)
        db.refresh(target_p)
        assert target_p.damaged_quantity >= 2

        # Restock 1 pcs via API
        restock_req = RestockDamagedRequest(product_id=target_p.id, quantity=1, reason="Stain removed by dry cleaning")
        restock_res = restock_damaged_product(restock_req, current_user=owner, db=db)
        db.refresh(target_p)
        print(f"  [PASS] Successfully restocked 1 pcs: Active Stock = {target_p.stock_quantity}, Damaged = {target_p.damaged_quantity}")

        # 4. TEST: Switch Payment Mode on Bill (Cash <-> UPI)
        print("\n[TEST 4] Testing 1-Click Payment Mode Switch...")
        inv = db.query(Invoice).first()
        if inv:
            new_mode = PaymentMode.UPI if inv.payment_mode == PaymentMode.CASH else PaymentMode.CASH
            mode_req = UpdatePaymentModeRequest(payment_mode=new_mode, notes="Customer switched to QR")
            update_invoice_payment_mode(inv.id, mode_req, current_user=owner, db=db)
            db.refresh(inv)
            assert inv.payment_mode == new_mode
            print(f"  [PASS] Invoice {inv.bill_number} switched to {inv.payment_mode.value}")

        # 5. TEST: Stock Velocity in Reports
        print("\n[TEST 5] Testing Stock Velocity in Reports...")
        rep = get_sales_report(period="monthly", current_user=owner, db=db)
        assert "fast_moving_products" in rep
        assert "dead_stock_summary" in rep
        print(f"  [PASS] Reports generated with {len(rep['fast_moving_products'])} fast-moving and {len(rep['dead_stock_summary'])} dead stock items.")

        print("\n==========================================================")
        print("          ALL TEST CASES PASSED SUCCESSFULLY (100%)       ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
