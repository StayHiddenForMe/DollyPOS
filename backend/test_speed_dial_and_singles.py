import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.api.inventory_router import fast_search_products, get_product_by_barcode_or_code, create_product
from app.schemas.product_schema import ProductCreate

def test_speed_dials_and_lookups():
    print("Testing Speed Dial Lookups and Single Product Save...")
    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        # 1. Create a product with shortcode 'M10'
        t = int(time.time() * 1000)
        m_item = ProductCreate(
            barcode=f"890{t}",
            name="Soft Baby Cotton Mittens (Pair)",
            size="0-3M",
            color="Pink",
            purchase_price=25.0,
            selling_price=60.0,
            mrp=80.0,
            stock_quantity=50,
            is_speed_dial=True,
            speed_dial_code="M10"
        )
        saved = create_product(m_item, current_user=owner, db=db)
        assert saved.speed_dial_code == "M10"
        print(f"[PASS] Saved product with shortcode M10: ID {saved.id}")

        # 2. Test fast search with lowercase 'm10'
        results = fast_search_products(q="m10", db=db)
        assert len(results) > 0
        assert any(r.speed_dial_code == "M10" for r in results)
        print(f"[PASS] fast_search_products('m10') found: '{results[0].name}' (Code: {results[0].speed_dial_code})")

        # 3. Test exact resolution with lowercase 'm10'
        resolved = get_product_by_barcode_or_code(barcode_val="m10", db=db)
        assert resolved.id == saved.id
        print(f"[PASS] get_product_by_barcode_or_code('m10') directly resolved: '{resolved.name}'")

    finally:
        db.close()

if __name__ == "__main__":
    test_speed_dials_and_lookups()
