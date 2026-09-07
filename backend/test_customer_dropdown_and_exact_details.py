import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.customer import Customer
from app.models.invoice import PaymentMode, PaymentStatus
from app.schemas.billing_schema import InvoiceCreate, InvoiceItemCreate
from app.api.billing_router import process_checkout
from app.api.customer_router import list_customers

def test_exact_customer_details_and_search():
    print("==========================================================")
    print("    DOLLY POS - EXACT CUSTOMER DETAILS & AUTOCOMPLETE     ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        product = db.query(Product).filter(Product.is_active == True, Product.stock_quantity > 5).first()
        assert product is not None

        # TEST 1: Empty customer name & phone -> NO auto-filling or fake customer
        print("\n[TEST 1] Testing standard checkout with NO customer details...")
        cart1 = InvoiceCreate(
            customer_name=None,
            customer_phone=None,
            subtotal=product.selling_price,
            discount_amount=0.0,
            tax_amount=0.0,
            round_off=0.0,
            grand_total=product.selling_price,
            paid_amount=product.selling_price,
            change_amount=0.0,
            due_amount=0.0,
            payment_mode=PaymentMode.CASH,
            payment_status=PaymentStatus.PAID,
            items=[
                InvoiceItemCreate(
                    product_id=product.id,
                    item_name=product.name,
                    barcode=product.barcode,
                    quantity=1,
                    unit_price=product.selling_price,
                    cost_price=product.purchase_price,
                    total_price=product.selling_price
                )
            ]
        )
        inv1 = process_checkout(cart1, current_user=owner, db=db)
        assert inv1.customer_name is None
        assert inv1.customer_phone is None
        print(f"  [PASS] Invoice {inv1.bill_number}: Customer Name = None, Phone = None (No fake details attached!)")

        # TEST 2: Credit checkout with Name ONLY ("Sam New Person") -> NO fake phone number generated
        print("\n[TEST 2] Testing Credit checkout with Name ONLY ('Sam New Person')...")
        cart2 = InvoiceCreate(
            customer_name="Sam New Person",
            customer_phone=None,
            subtotal=500.0,
            discount_amount=0.0,
            tax_amount=0.0,
            round_off=0.0,
            grand_total=500.0,
            paid_amount=0.0,
            change_amount=0.0,
            due_amount=500.0,
            payment_mode=PaymentMode.CREDIT_KHATA,
            payment_status=PaymentStatus.CREDIT,
            items=[
                InvoiceItemCreate(
                    product_id=product.id,
                    item_name=product.name,
                    barcode=product.barcode,
                    quantity=1,
                    unit_price=500.0,
                    cost_price=product.purchase_price,
                    total_price=500.0
                )
            ]
        )
        inv2 = process_checkout(cart2, current_user=owner, db=db)
        assert inv2.customer_name == "Sam New Person"
        assert inv2.customer_phone is None
        print(f"  [PASS] Invoice {inv2.bill_number}: Customer Name = 'Sam New Person', Phone = None (Exact details only)")

        # TEST 3: Search for "Sam" to verify dropdown suggestions
        print("\n[TEST 3] Testing search for 'Sam' (Autocomplete dropdown)...")
        results = list_customers(search="Sam", db=db)
        assert len(results) > 0
        print(f"  [PASS] Search returned {len(results)} matches for 'Sam':")
        for r in results[:3]:
            print(f"    • {r.name} | Phone: {r.phone or 'None'} | Due: Rs.{r.credit_balance}")

        print("\n==========================================================")
        print("    ALL EXACT DETAILS & SEARCH TESTS PASSED (100%)        ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_exact_customer_details_and_search()
