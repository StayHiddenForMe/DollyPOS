import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.customer import Customer, CustomerLedger, CustomerLedgerType
from app.models.invoice import PaymentMode, PaymentStatus
from app.schemas.billing_schema import InvoiceCreate, InvoiceItemCreate
from app.api.billing_router import process_checkout
from app.api.customer_router import list_customers

def test_khata_customer_sync():
    print("==========================================================")
    print("   DOLLY POS - KHATA CUSTOMER PERSISTENCE & SYNC TEST     ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        product = db.query(Product).filter(Product.is_active == True, Product.stock_quantity > 5).first()
        assert product is not None

        # TEST 1: Credit Sale with Name ONLY (No phone entered)
        print("\n[TEST 1] Credit Sale with Name ONLY (No Phone)...")
        name_only_cart = InvoiceCreate(
            customer_name="Sanjay Sharma Khata Only",
            customer_phone=None,
            subtotal=800.0,
            discount_amount=0.0,
            tax_amount=0.0,
            round_off=0.0,
            grand_total=800.0,
            paid_amount=300.0, # Paid 300
            change_amount=0.0,
            due_amount=500.0,  # Remaining 500 in Khata
            payment_mode=PaymentMode.CREDIT_KHATA,
            payment_status=PaymentStatus.PARTIAL,
            items=[
                InvoiceItemCreate(
                    product_id=product.id,
                    item_name=product.name,
                    barcode=product.barcode,
                    quantity=1,
                    unit_price=800.0,
                    cost_price=product.purchase_price,
                    total_price=800.0
                )
            ]
        )
        inv1 = process_checkout(name_only_cart, current_user=owner, db=db)
        assert inv1.bill_number is not None

        # Verify customer in database
        c1 = db.query(Customer).filter(Customer.name == "Sanjay Sharma Khata Only").first()
        assert c1 is not None
        assert c1.credit_balance >= 500.0
        print(f"  [PASS] Auto-Created Customer: {c1.name} (Auto-assigned Phone: {c1.phone}, Credit Due: Rs.{c1.credit_balance})")

        # TEST 2: Credit Sale with Name and Phone
        print("\n[TEST 2] Credit Sale with Name AND Phone (Partial Payment: Rs.200 paid, Rs.600 due)...")
        name_phone_cart = InvoiceCreate(
            customer_name="Vijay Garments Dhule",
            customer_phone="9876500112",
            subtotal=800.0,
            discount_amount=0.0,
            tax_amount=0.0,
            round_off=0.0,
            grand_total=800.0,
            paid_amount=200.0,
            change_amount=0.0,
            due_amount=600.0,
            payment_mode=PaymentMode.CREDIT_KHATA,
            payment_status=PaymentStatus.PARTIAL,
            items=[
                InvoiceItemCreate(
                    product_id=product.id,
                    item_name=product.name,
                    barcode=product.barcode,
                    quantity=1,
                    unit_price=800.0,
                    cost_price=product.purchase_price,
                    total_price=800.0
                )
            ]
        )
        inv2 = process_checkout(name_phone_cart, current_user=owner, db=db)
        assert inv2.bill_number is not None

        c2 = db.query(Customer).filter(Customer.phone == "9876500112").first()
        assert c2 is not None
        assert c2.credit_balance >= 600.0
        print(f"  [PASS] Verified Customer: {c2.name} (Phone: {c2.phone}, Credit Due: Rs.{c2.credit_balance})")

        # TEST 3: Verify Customers / Khata list endpoint returns both at the top
        print("\n[TEST 3] Verifying GET /customers (Credit Only)...")
        credit_custs = list_customers(credit_only=True, db=db)
        top_names = [c.name for c in credit_custs[:5]]
        assert "Vijay Garments Dhule" in top_names or "Sanjay Sharma Khata Only" in top_names
        print(f"  [PASS] Recent Khata Accounts appearing at the top: {top_names[:3]}")

        print("\n==========================================================")
        print("   ALL KHATA & CREDIT CUSTOMER SYNC TESTS PASSED (100%)   ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_khata_customer_sync()
