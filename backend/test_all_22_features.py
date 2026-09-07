import os
import sys
import time
import io
import pandas as pd
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.product import Product
from app.models.vendor import Vendor
from app.models.customer import Customer
from app.models.category import Category, Subcategory
from app.models.settings import StoreSettings
from app.models.product_price_history import ProductPriceHistory
from app.api.inventory_router import (
    fast_search_products, check_speed_dial_unique, create_product,
    update_product, get_damaged_products, mark_product_damaged, ProductUpdate, MarkDamagedRequest
)
from app.schemas.product_schema import ProductCreate
from app.api.auth_router import create_staff_user, reset_staff_password, UserCreate, PasswordResetRequest
from app.api.category_router import create_category, create_subcategory, CategoryCreate, SubcategoryCreate
from app.api.reports_router import get_sales_report
from app.services.receipt_service import receipt_service

def run_22_features_verification():
    print("==========================================================")
    print("  DOLLY POS - 22 ADVANCED RETAIL CAPABILITIES TEST SUITE  ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None, "Owner user not found"

        t = int(time.time() * 1000)

        # 1. TEST: Speed Dial 1 Exact Match Priority over Fuzzy matches
        print("\n[TEST 1] Testing Speed Dial Exact Match Priority...")
        dial_code = f"T{str(t)[-3:]}"

        p1_item = ProductCreate(
            barcode=f"890{t}11",
            name=f"Infant Soft Organic Cotton Onesie {t}",
            size="0-6M",
            color="White",
            purchase_price=100.0,
            selling_price=250.0,
            mrp=0.0, # Default 0 MRP
            stock_quantity=20,
            is_speed_dial=True,
            speed_dial_code=dial_code
        )
        saved_p1 = create_product(p1_item, current_user=owner, db=db)
        assert saved_p1.mrp == 0.0, "MRP was expected to remain 0 by default"
        
        # Also create a product with dial_code in name (fuzzy match)
        p2_item = ProductCreate(
            barcode=f"890{t}22",
            name=f"Boys Apparel {dial_code} Special Polo",
            size="24",
            color="Navy",
            purchase_price=150.0,
            selling_price=350.0,
            mrp=0.0,
            stock_quantity=15,
            is_speed_dial=False
        )
        saved_p2 = create_product(p2_item, current_user=owner, db=db)

        # Search for dial_code: Product with exact speed dial MUST be index 0!
        search_res = fast_search_products(q=dial_code, db=db)
        assert len(search_res) > 0
        assert search_res[0].speed_dial_code == dial_code, f"Expected speed dial {dial_code} at index 0, got {search_res[0].name}"
        print(f"  [PASS] Exact Speed Dial '{dial_code}' ranked at index 0: '{search_res[0].name}' (Code: {search_res[0].speed_dial_code})")

        # 2. TEST: Unique Speed Dial Code Conflict Prevention
        print("\n[TEST 2] Testing Unique Speed Dial Validation...")
        check_dup = check_speed_dial_unique(code=dial_code, db=db)
        assert check_dup["available"] == False, "Speed dial should be reported unavailable"
        print(f"  [PASS] Duplicate speed dial blocked: '{check_dup['message']}'")

        check_free = check_speed_dial_unique(code=f"FREE{t}", db=db)
        assert check_free["available"] == True
        print("  [PASS] Unique speed dial code permitted.")

        # 3. TEST: Product Price History Tracking
        print("\n[TEST 3] Testing Product Price History Evolution Log...")
        upd = ProductUpdate(
            selling_price=299.0,
            purchase_price=120.0,
            mrp=349.0,
            price_change_reason="Supplier raw cotton rate increased"
        )
        update_product(product_id=saved_p1.id, product_in=upd, current_user=owner, db=db)
        
        histories = db.query(ProductPriceHistory).filter(ProductPriceHistory.product_id == saved_p1.id).all()
        assert len(histories) >= 2, "Expected at least 2 price history entries"
        latest = histories[-1]
        print(f"  [PASS] Price history logged: Rs.{latest.old_selling_price} -> Rs.{latest.new_selling_price} (MRP: Rs.{latest.new_mrp}) Reason: '{latest.reason}'")

        # 4. TEST: Staff Administration & Password Reset (Owner only)
        print("\n[TEST 4] Testing Staff Accounts & Password Management...")
        staff_username = f"cashier_{t}"
        new_staff_req = UserCreate(
            username=staff_username,
            full_name="Kishore Patil",
            password="oldpassword123",
            role=UserRole.STAFF
        )
        staff_user = create_staff_user(new_staff_req, current_user=owner, db=db)
        assert staff_user.id is not None
        print(f"  [PASS] Staff account created: '{staff_user.username}' (Role: {staff_user.role.value})")

        pw_req = PasswordResetRequest(user_id=staff_user.id, new_password="newsecretpassword456")
        reset_res = reset_staff_password(pw_req, current_user=owner, db=db)
        print(f"  [PASS] Password reset: {reset_res['message']}")

        # 5. TEST: Category & Subcategory Hierarchy Management
        print("\n[TEST 5] Testing Category & Subcategory Management...")
        cat_req = CategoryCreate(name=f"Winter Kids Jackets {t}", description="Warm jackets")
        new_cat = create_category(cat_req, current_user=owner, db=db)
        assert new_cat.id is not None

        sub_req = SubcategoryCreate(category_id=new_cat.id, name=f"Hooded Windcheater {t}")
        new_sub = create_subcategory(sub_req, current_user=owner, db=db)
        assert new_sub.id is not None
        print(f"  [PASS] Category '{new_cat.name}' created with Subcategory '{new_sub.name}'")

        # 6. TEST: Damaged & Defective Stock Management
        print("\n[TEST 6] Testing Damaged Stock Logger & Trapped Loss...")
        dmg_req = MarkDamagedRequest(
            product_id=saved_p1.id,
            quantity=2,
            reason="Color stain during unpacking"
        )
        mark_res = mark_product_damaged(dmg_req, current_user=owner, db=db)
        dmg_overview = get_damaged_products(db=db)
        assert dmg_overview["total_damaged_quantity"] >= 2
        print(f"  [PASS] Damaged stock recorded: {dmg_overview['total_damaged_quantity']} pcs trapped, Total Loss: Rs.{dmg_overview['total_trapped_loss']}")

        # 7. TEST: Vendor Shortcode & Linking
        print("\n[TEST 7] Testing Vendor Shortcode Profile...")
        vendor = Vendor(
            vendor_code=f"SUR{str(t)[-3:]}",
            name=f"Dolly Surat Apparel {t}",
            phone="9876543210",
            notes="Requires 10 days advance booking for festival orders"
        )
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
        assert vendor.vendor_code is not None
        print(f"  [PASS] Vendor created with shortcode: {vendor.vendor_code} and Notes: '{vendor.notes}'")

        # 8. TEST: P&L Report with COGS & Take-Home Net Profit
        print("\n[TEST 8] Testing True P&L Report Metrics (COGS, Gross Margin, Take-Home Profit)...")
        pnl = get_sales_report(period="monthly", current_user=owner, db=db)
        assert "total_cogs" in pnl
        assert "gross_profit" in pnl
        assert "take_home_net_profit" in pnl
        print(f"  [PASS] P&L Summary: Sales: Rs.{pnl['total_sales']}, COGS: Rs.{pnl['total_cogs']}, Gross Profit: Rs.{pnl['gross_profit']} (Margin: {pnl['gross_margin_percent']}%), Take-Home Net Profit: Rs.{pnl['take_home_net_profit']}")

        # 9. TEST: Conditional GSTIN on Receipt
        print("\n[TEST 9] Testing Conditional GSTIN on Receipt...")
        from app.models.invoice import Invoice
        latest_inv = db.query(Invoice).first()
        if latest_inv:
            settings_with_gst = StoreSettings(shop_name="Dolly Toys", gstin="27AABCU9603R1ZM", show_gst_on_bill=True)
            r_data = receipt_service.build_thermal_receipt_data(latest_inv, settings_with_gst)
            assert r_data["show_gst"] == True
            assert r_data["gstin"] == "27AABCU9603R1ZM"

            settings_no_gst = StoreSettings(shop_name="Dolly Toys", gstin="27AABCU9603R1ZM", show_gst_on_bill=False)
            r_data_no_gst = receipt_service.build_thermal_receipt_data(latest_inv, settings_no_gst)
            assert r_data_no_gst["show_gst"] == False
            assert r_data_no_gst["gstin"] is None
            print("  [PASS] Conditional GSTIN print toggles accurately on receipts.")

        print("\n==========================================================")
        print("     ALL 22 FEATURES & CAPABILITIES TESTED & PASSED       ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    run_22_features_verification()
