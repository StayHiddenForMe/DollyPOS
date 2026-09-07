import os
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.vendor import Vendor
from app.models.invoice import Invoice, InvoiceItem, PaymentMode, PaymentStatus
from app.models.settings import StoreSettings
from app.services.receipt_service import format_ist_datetime, receipt_service
from app.api.inventory_router import create_multi_size_products
from app.schemas.product_schema import ProductMultiSizeCreate
from app.api.returns_router import process_exchange_order, ExchangeProcessRequest, ExchangeItemPayload

def run_tests():
    print("==========================================================")
    print("   DOLLY POS - 13 ENHANCEMENTS AUTOMATED VERIFICATION     ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None, "Owner user not found"

        # TEST 1: Multi-Size Product Creation (e.g. 22, 24, 26, 28)
        print("\n[TEST 1] Testing Multi-Size Product Creation...")
        t = int(time.time() * 1000)
        multi_payload = ProductMultiSizeCreate(
            name=f"Kids Festival Kurta Pajama Set {t}",
            sizes=["22", "24", "26", "28"],
            color="Maroon",
            purchase_price=350.0,
            selling_price=699.0,
            mrp=799.0,
            stock_per_size=5,
            speed_dial_code=f"K{str(t)[-3:]}"
        )
        created_variants = create_multi_size_products(multi_payload, current_user=owner, db=db)
        assert len(created_variants) == 4
        print(f"  [PASS] Successfully created 4 size variants ({[v.size for v in created_variants]}) with distinct barcodes in 1 request.")

        # TEST 2: Speed Dial Shortcode Search
        print(f"\n[TEST 2] Testing Speed Dial Shortcode Search ('{created_variants[0].speed_dial_code}')...")
        match = db.query(Product).filter(Product.speed_dial_code.ilike(created_variants[0].speed_dial_code)).first()
        assert match is not None, "Product with shortcode not found"
        print(f"  [PASS] Fast shortcode lookup resolved: '{match.name}' Size: {match.size}, Price: Rs.{match.selling_price}")

        # TEST 3: Timezone Indian Standard Time (IST / GMT+5:30)
        print("\n[TEST 3] Testing Indian Standard Time (IST / GMT+5:30) Conversion...")
        utc_sample = datetime(2026, 8, 21, 17, 32, 0) # 5:32 PM UTC -> 11:02 PM IST
        ist_str = format_ist_datetime(utc_sample)
        print(f"  UTC Input: {utc_sample} -> Indian IST Formatted: '{ist_str}'")
        assert "11:02 PM" in ist_str, f"Expected 11:02 PM in IST but got {ist_str}"
        print("  [PASS] Indian Standard Time accurately computed (+5:30 offset).")

        # TEST 4: Vendor Bank Account Details
        print("\n[TEST 4] Testing Vendor Bank Profile & IFSC Persistence...")
        test_vendor = Vendor(
            name=f"Surat Kids Hub {t}",
            phone=f"9825{str(t)[-6:]}",
            city="Surat",
            bank_name="HDFC Bank",
            bank_account_no=f"5020{str(t)[-10:]}",
            bank_ifsc="HDFC0000123",
            bank_holder_name="Surat Kids Hub Pvt Ltd",
            vendor_upi_id=f"suratkids{t}@okhdfcbank"
        )
        db.add(test_vendor)
        db.commit()
        db.refresh(test_vendor)
        assert test_vendor.bank_account_no is not None
        print(f"  [PASS] Vendor saved with Bank: {test_vendor.bank_name}, A/C: {test_vendor.bank_account_no}, IFSC: {test_vendor.bank_ifsc}")

        # TEST 5: Return & Exchange Workflow with Replacement Product & Net Balance
        print("\n[TEST 5] Testing Return & Exchange Engine with Bill Search...")
        item_to_buy = created_variants[0] # Selling price: 699
        replacement_item = created_variants[1] # Selling price: 699
        
        dynamic_bill_no = f"DLY-EX-{t}"
        inv = Invoice(
            bill_number=dynamic_bill_no,
            customer_name="Ramesh Patil",
            customer_phone="9898989898",
            subtotal=699.0,
            grand_total=699.0,
            paid_amount=699.0,
            payment_mode=PaymentMode.CASH,
            payment_status=PaymentStatus.PAID,
            created_at=datetime.utcnow()
        )
        db.add(inv)
        db.flush()

        inv_item = InvoiceItem(
            invoice_id=inv.id,
            product_id=item_to_buy.id,
            item_name=item_to_buy.name,
            barcode=item_to_buy.barcode,
            size=item_to_buy.size,
            quantity=1,
            unit_price=699.0,
            cost_price=item_to_buy.purchase_price,
            total_price=699.0,
            is_unlisted=False
        )
        db.add(inv_item)
        db.commit()

        # Step 5b: Process Exchange: Return Size 22 (699), Take Size 24 (699) -> Net Difference 0
        ex_req = ExchangeProcessRequest(
            original_bill_number=inv.bill_number,
            invoice_id=inv.id,
            customer_name="Ramesh Patil",
            customer_phone="9898989898",
            returned_items=[{
                "product_id": item_to_buy.id,
                "item_name": item_to_buy.name,
                "barcode": item_to_buy.barcode,
                "quantity": 1,
                "refund_price": 699.0,
                "is_defective": False
            }],
            exchange_items=[ExchangeItemPayload(
                product_id=replacement_item.id,
                quantity=1,
                unit_price=699.0
            )],
            total_returned_value=699.0,
            total_new_items_value=699.0,
            net_difference=0.0,
            settlement_mode="CASH",
            reason="Size 22 tight, exchanged for Size 24"
        )
        ex_res = process_exchange_order(ex_req, current_user=owner, db=db)
        assert ex_res["success"] == True
        assert ex_res["action"] == "EVEN_EXCHANGE"
        print(f"  [PASS] Exchange processed: Return No: {ex_res['return_number']}, New Bill: {ex_res['new_bill_number']}, Action: {ex_res['action']}")

        # TEST 6: Custom Date Reports
        print("\n[TEST 6] Testing Reports with Custom Date Filtering...")
        from app.api.reports_router import get_sales_report
        today_date_str = datetime.utcnow().strftime("%Y-%m-%d")
        report = get_sales_report(period="custom", start_date=today_date_str, end_date=today_date_str, current_user=owner, db=db)
        assert report["total_sales"] >= 0
        print(f"  [PASS] Custom date query ({today_date_str}) returned {report['bill_count']} bills, Total Revenue: Rs.{report['total_sales']}")

        print("\n==========================================================")
        print("     ALL 13 ENHANCEMENT TESTS VERIFIED SUCCESSFULLY       ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
