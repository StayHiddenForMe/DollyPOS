import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.schemas.product_schema import ProductCreate
from app.api.inventory_router import create_product

def test_single_save():
    print("Testing single-size product creation via create_product endpoint...")
    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        timestamp = int(time.time() * 1000)
        prod_payload = ProductCreate(
            barcode=f"890{timestamp}",
            sku=f"DLY-SNGL-{timestamp}",
            name="Single Size Infant Romper",
            size="0-6M",
            color="Sky Blue",
            purchase_price=180.0,
            selling_price=399.0,
            mrp=499.0,
            gst_percent=0.0,
            stock_quantity=10,
            min_stock_alert=3,
            is_speed_dial=True,
            speed_dial_code="RMP1"
        )

        created = create_product(prod_payload, current_user=owner, db=db)
        assert created.id is not None
        assert created.name == "Single Size Infant Romper"
        assert created.margin_percent > 0
        print(f"[PASS] Single product created successfully! ID: {created.id}, Margin: {created.margin_percent}%, Barcode: {created.barcode}")

    finally:
        db.close()

if __name__ == "__main__":
    test_single_save()
