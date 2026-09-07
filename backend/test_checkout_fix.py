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

def test_billing_checkout_scenarios():
    print("==========================================================")
    print("      DOLLY POS - BILLING CHECKOUT VERIFICATION TEST      ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        # Find or create a test product
        product = db.query(Product).filter(Product.is_active == True, Product.stock_quantity > 5).first()
        assert product is not None
        initial_stock = product.stock_quantity

        # 1. Test Regular Paid Checkout (No Credit)
        print("\n[TEST 1] Testing standard full cash checkout...")
        cart1 = InvoiceCreate(
            customer_name="Test Walk-in Customer",
            customer_phone="9876543210",
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
        assert inv1.bill_number is not None
        print(f"  [PASS] Standard Invoice Created: {inv1.bill_number} (Grand Total: Rs.{inv1.grand_total})")

        # 2. Test Khata / Credit Sale Checkout (due_amount > 0)
        print("\n[TEST 2] Testing Khata Credit Sale Checkout (with customer due amount)...")
        customer_phone = "9988776655"
        cart2 = InvoiceCreate(
            customer_name="Ramesh Bhai Khata",
            customer_phone=customer_phone,
            subtotal=product.selling_price * 2,
            discount_amount=0.0,
            tax_amount=0.0,
            round_off=0.0,
            grand_total=product.selling_price * 2,
            paid_amount=100.0,  # Partial payment
            change_amount=0.0,
            due_amount=(product.selling_price * 2) - 100.0,  # Remaining on credit / Khata
            payment_mode=PaymentMode.CREDIT,
            payment_status=PaymentStatus.PARTIAL,
            items=[
                InvoiceItemCreate(
                    product_id=product.id,
                    item_name=product.name,
                    barcode=product.barcode,
                    quantity=2,
                    unit_price=product.selling_price,
                    cost_price=product.purchase_price,
                    total_price=product.selling_price * 2
                )
            ]
        )
        inv2 = process_checkout(cart2, current_user=owner, db=db)
        assert inv2.bill_number is not None
        assert inv2.due_amount > 0

        # Verify Customer and Ledger entry in DB
        cust = db.query(Customer).filter(Customer.phone == customer_phone).first()
        assert cust is not None
        assert cust.credit_balance >= inv2.due_amount

        ledger_entry = db.query(CustomerLedger).filter(
            CustomerLedger.customer_id == cust.id,
            CustomerLedger.reference_no == inv2.bill_number
        ).first()
        assert ledger_entry is not None
        assert ledger_entry.entry_type == CustomerLedgerType.BILL_CREDIT
        assert ledger_entry.credit_amount == inv2.due_amount

        print(f"  [PASS] Credit Sale Invoice: {inv2.bill_number}")
        print(f"  [PASS] Customer Khata Updated: {cust.name} (Credit Due: Rs.{cust.credit_balance})")
        print(f"  [PASS] Customer Ledger Entry: Ref={ledger_entry.reference_no}, Type={ledger_entry.entry_type.value}, Due Added=Rs.{ledger_entry.credit_amount}")

        print("\n==========================================================")
        print("     ALL CHECKOUT SCENARIOS PASSED WITH ZERO ERRORS!      ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_billing_checkout_scenarios()
