import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.category import Category, Subcategory
from app.models.product import Product
from app.models.vendor import Vendor, VendorLedger, VendorLedgerType
from app.models.customer import Customer

def seed_demo():
    db = SessionLocal()
    try:
        # 1. Vendors
        v1 = db.query(Vendor).filter(Vendor.name == "Surat Kids Fashion Hub").first()
        if not v1:
            v1 = Vendor(
                name="Surat Kids Fashion Hub",
                company_name="Surat Garments Pvt Ltd",
                phone="9825012345",
                gstin="24AAACS1234F1Z5",
                city="Surat",
                state="Gujarat",
                outstanding_due=0.0
            )
            db.add(v1)

        v2 = db.query(Vendor).filter(Vendor.name == "Delhi Toys Wholesale Syndicate").first()
        if not v2:
            v2 = Vendor(
                name="Delhi Toys Wholesale Syndicate",
                company_name="Syndicate Toys India",
                phone="9811098765",
                gstin="07BBBCD5678K1Z2",
                city="Delhi",
                state="Delhi",
                outstanding_due=0.0
            )
            db.add(v2)
        db.flush()

        # 2. Categories mapping
        toys_cat = db.query(Category).filter(Category.name.ilike("%Toys%")).first()
        boys_cat = db.query(Category).filter(Category.name.ilike("%Boys%")).first()
        girls_cat = db.query(Category).filter(Category.name.ilike("%Girls%")).first()
        infant_cat = db.query(Category).filter(Category.name.ilike("%Infant%")).first()
        acc_cat = db.query(Category).filter(Category.name.ilike("%Accessories%")).first()

        # 3. Sample Products
        sample_products = [
            # Toys
            {
                "barcode": "890123400001",
                "sku": "TOY-CAR-RC01",
                "name": "Remote Control Monster Racing Car (Rechargeable)",
                "category_id": toys_cat.id if toys_cat else None,
                "brand": "SpeedX",
                "gender": "Unisex",
                "age_group": "3-8Y",
                "purchase_price": 450.0,
                "selling_price": 799.0,
                "mrp": 999.0,
                "margin_percent": 77.56,
                "stock_quantity": 25,
                "min_stock_alert": 5,
                "vendor_code": "DELHI-RC-01",
                "is_speed_dial": True,
                "speed_dial_color": "#EF4444"
            },
            {
                "barcode": "890123400002",
                "sku": "TOY-BLK-SET",
                "name": "Smart Educational Building Blocks Set (120 Pcs)",
                "category_id": toys_cat.id if toys_cat else None,
                "brand": "PlaySmart",
                "gender": "Unisex",
                "age_group": "2-6Y",
                "purchase_price": 220.0,
                "selling_price": 449.0,
                "mrp": 599.0,
                "margin_percent": 104.09,
                "stock_quantity": 40,
                "min_stock_alert": 8,
                "vendor_code": "DELHI-BLK-120",
                "is_speed_dial": True,
                "speed_dial_color": "#F59E0B"
            },
            # Boys Wear
            {
                "barcode": "890123400003",
                "sku": "BOY-TSH-24",
                "name": "Boys 100% Cotton Printed Summer T-Shirt",
                "category_id": boys_cat.id if boys_cat else None,
                "brand": "Dolly Kids",
                "gender": "Boy",
                "age_group": "4-6Y",
                "size": "24",
                "color": "Sky Blue",
                "fabric": "Pure Cotton",
                "season": "Summer",
                "purchase_price": 160.0,
                "selling_price": 320.0,
                "mrp": 399.0,
                "margin_percent": 100.0,
                "stock_quantity": 30,
                "min_stock_alert": 6,
                "vendor_code": "SURAT-TSH-24",
                "is_speed_dial": False
            },
            {
                "barcode": "890123400004",
                "sku": "BOY-JNS-26",
                "name": "Boys Stretchable Denim Jeans Pant",
                "category_id": boys_cat.id if boys_cat else None,
                "brand": "DenimJunior",
                "gender": "Boy",
                "age_group": "6-8Y",
                "size": "26",
                "color": "Dark Blue",
                "fabric": "Denim",
                "purchase_price": 310.0,
                "selling_price": 599.0,
                "mrp": 799.0,
                "margin_percent": 93.23,
                "stock_quantity": 20,
                "min_stock_alert": 4,
                "vendor_code": "SURAT-JNS-26",
                "is_speed_dial": False
            },
            # Girls Wear
            {
                "barcode": "890123400005",
                "sku": "GRL-FRK-22",
                "name": "Girls Floral Party Wear Frock with Net Flare",
                "category_id": girls_cat.id if girls_cat else None,
                "brand": "Angel Princess",
                "gender": "Girl",
                "age_group": "3-5Y",
                "size": "22",
                "color": "Pink / Peach",
                "fabric": "Silk Net",
                "season": "Festival / Party",
                "purchase_price": 380.0,
                "selling_price": 750.0,
                "mrp": 999.0,
                "margin_percent": 97.37,
                "stock_quantity": 18,
                "min_stock_alert": 3,
                "vendor_code": "SURAT-FRK-22",
                "is_speed_dial": True,
                "speed_dial_color": "#EC4899"
            },
            # Infants
            {
                "barcode": "890123400006",
                "sku": "INF-RMP-0",
                "name": "Infant Soft Organic Cotton Romper Suit (Pack of 2)",
                "category_id": infant_cat.id if infant_cat else None,
                "brand": "BabyNest",
                "gender": "Infant",
                "age_group": "0-6M",
                "size": "0",
                "color": "Yellow / White",
                "fabric": "Organic Cotton",
                "purchase_price": 180.0,
                "selling_price": 350.0,
                "mrp": 450.0,
                "margin_percent": 94.44,
                "stock_quantity": 35,
                "min_stock_alert": 5,
                "vendor_code": "SURAT-RMP-0",
                "is_speed_dial": False
            },
            # Frequent Quick Accessories (Speed Dials)
            {
                "barcode": "890123400007",
                "sku": "ACC-HAIR-01",
                "name": "Kids Cute Cartoon Hair Clip Set (Pack of 4)",
                "category_id": acc_cat.id if acc_cat else None,
                "brand": "Dolly Magic",
                "gender": "Girl",
                "purchase_price": 25.0,
                "selling_price": 60.0,
                "mrp": 80.0,
                "margin_percent": 140.0,
                "stock_quantity": 100,
                "min_stock_alert": 20,
                "is_speed_dial": True,
                "speed_dial_color": "#8B5CF6"
            },
            {
                "barcode": "890123400008",
                "sku": "ACC-SOCK-01",
                "name": "Kids Anti-Slip Ankle Socks (Pair)",
                "category_id": acc_cat.id if acc_cat else None,
                "brand": "SoftFeet",
                "gender": "Unisex",
                "size": "L",
                "purchase_price": 20.0,
                "selling_price": 50.0,
                "mrp": 70.0,
                "margin_percent": 150.0,
                "stock_quantity": 150,
                "min_stock_alert": 30,
                "is_speed_dial": True,
                "speed_dial_color": "#10B981"
            }
        ]

        for p_data in sample_products:
            exists = db.query(Product).filter(Product.barcode == p_data["barcode"]).first()
            if not exists:
                prod = Product(**p_data)
                db.add(prod)

        # 4. Sample Walk-in Customer
        c1 = db.query(Customer).filter(Customer.phone == "9876543210").first()
        if not c1:
            c1 = Customer(
                name="Rahul Patil",
                phone="9876543210",
                city="Dhule",
                date_of_birth="15-08",
                credit_balance=0.0
            )
            db.add(c1)

        db.commit()
        print("Demo products, vendors, and speed dials seeded successfully!")
    except Exception as e:
        print(f"Error seeding demo: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_demo()
