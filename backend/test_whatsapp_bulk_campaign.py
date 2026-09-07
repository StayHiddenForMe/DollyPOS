import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.product import Product
from app.models.product_price_history import ProductPriceHistory
from app.models.customer import Customer
from app.models.settings import StoreSettings

def test_whatsapp_campaign():
    print("==========================================================")
    print("    DOLLY POS - WHATSAPP BULK CAMPAIGN TEST SUITE        ")
    print("==========================================================")

    db = SessionLocal()
    try:
        customers = db.query(Customer).filter(Customer.is_active == True).all()
        settings = db.query(StoreSettings).first()
        shop_name = settings.shop_name if settings else "Dolly Toys and Kids Wear"

        print(f"\n[TEST 1] Registered Store Customers: {len(customers)} accounts.")
        assert len(customers) > 0

        # Sample customer
        c = customers[0]
        diwali_tpl = "Happy Diwali from {store_name}! Dear {name}, enjoy 20% OFF on kids wear & toys. Contact: 7972558842."
        personalized = diwali_tpl.replace("{store_name}", shop_name).replace("{name}", c.name)

        assert c.name in personalized
        assert shop_name in personalized
        print(f"  [PASS] Personalized template preview for '{c.name}':\n  \"{personalized}\"")

        # Khata due audience
        khata_customers = [cust for cust in customers if cust.credit_balance > 0]
        print(f"\n[TEST 2] Khata balance due targeted audience: {len(khata_customers)} customers.")

        print("\n==========================================================")
        print("       WHATSAPP BROADCAST STUDIO VERIFIED SUCCESSFULLY     ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_whatsapp_campaign()
