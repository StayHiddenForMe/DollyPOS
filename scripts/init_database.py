"""
Dolly POS - Database & Schema Initialization Engine
Dolly Toys & Kids Wear, Dhule

This script interactively or programmatically creates a PostgreSQL database,
generates all 23 schemas, tables, constraints, indexes, runs all migrations,
seeds initial store settings, admin/staff users, starter categories, and updates .env files.
"""

import os
import sys
import argparse
import urllib.parse

# Ensure backend folder is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

def prompt_with_default(prompt_text: str, default_val: str) -> str:
    try:
        user_val = input(f"{prompt_text} [Default: {default_val}]: ").strip()
        return user_val if user_val else default_val
    except (EOFError, KeyboardInterrupt):
        print("\nOperation cancelled by user.")
        sys.exit(1)


def update_env_files(user: str, password: str, host: str, port: str, dbname: str):
    """Writes updated database configuration to all known .env locations."""
    env_content = f"""# Dolly POS - PostgreSQL Database Configuration
DB_USER={user}
DB_PASSWORD={password}
DB_HOST={host}
DB_PORT={port}
DB_NAME={dbname}
"""
    targets = [
        os.path.join(PROJECT_ROOT, ".env"),
        os.path.join(BACKEND_DIR, ".env"),
    ]
    
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        targets.append(os.path.join(local_app_data, "DollyPOS", ".env"))
        
    user_profile = os.environ.get("USERPROFILE", os.path.expanduser("~"))
    if user_profile:
        targets.append(os.path.join(user_profile, "DollyPOS_Backups", ".env"))

    for target in targets:
        try:
            folder = os.path.dirname(target)
            if folder and not os.path.exists(folder):
                os.makedirs(folder, exist_ok=True)
            with open(target, "w", encoding="utf-8") as f:
                f.write(env_content)
            print(f"  [OK] Saved config -> {target}")
        except Exception as e:
            print(f"  [WARN] Could not write to {target}: {e}")


def init_database(dbname: str, user: str, password: str, host: str, port: str, skip_prompts: bool = False):
    print("=" * 72)
    print("   DOLLY POS - DATABASE & SCHEMA INITIALIZATION ENGINE")
    print("   Dolly Toys & Kids Wear, Dhule")
    print("=" * 72)

    enc_user = urllib.parse.quote_plus(user)
    enc_pass = urllib.parse.quote_plus(password)

    # 1. Connect to PostgreSQL server (maintenance database: postgres)
    admin_url = f"postgresql://{enc_user}:{enc_pass}@{host}:{port}/postgres"
    print(f"\n[1/5] Connecting to PostgreSQL server at {host}:{port} as '{user}'...")
    try:
        admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT", connect_args={"connect_timeout": 5})
        with admin_engine.connect() as conn:
            # Check if target database exists
            res = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :dbname"), {"dbname": dbname})
            exists = res.scalar() is not None
            if exists:
                print(f"      Database '{dbname}' already exists on the PostgreSQL server.")
            else:
                print(f"      Database '{dbname}' does not exist. Creating database with UTF-8 encoding...")
                # Escape double quotes in dbname
                safe_dbname = dbname.replace('"', '""')
                conn.execute(text(f'CREATE DATABASE "{safe_dbname}" WITH OWNER "{user}" ENCODING \'UTF8\';'))
                print(f"      [OK] Database '{dbname}' created successfully.")
        admin_engine.dispose()
    except Exception as e:
        print(f"\n[ERROR] Failed to connect to PostgreSQL server: {e}")
        print("\nPlease check that:")
        print("  1. PostgreSQL service is running.")
        print("  2. Superuser username and password are correct.")
        print(f"  3. Host ({host}) and Port ({port}) are reachable.")
        sys.exit(1)

    # 2. Configure target database connection
    print(f"\n[2/5] Connecting to target database '{dbname}'...")
    target_url = f"postgresql://{enc_user}:{enc_pass}@{host}:{port}/{dbname}"
    target_engine = create_engine(target_url, pool_pre_ping=True)

    # Set environment variables for app modules
    os.environ["DB_USER"] = user
    os.environ["DB_PASSWORD"] = password
    os.environ["DB_HOST"] = host
    os.environ["DB_PORT"] = str(port)
    os.environ["DB_NAME"] = dbname

    # 3. Create all tables & schemas using SQLAlchemy metadata
    print(f"[3/5] Generating all tables, schemas, indexes & foreign keys...")
    try:
        from app.core.database import Base
        import app.models  # Registers all 23 models with Base.metadata
        Base.metadata.create_all(bind=target_engine)
        print("      [OK] Base metadata schema tables created successfully.")
    except Exception as e:
        print(f"\n[ERROR] Failed to create tables: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # 4. Run migrations and seed default data
    print(f"\n[4/5] Executing column migrations and seeding initial data...")
    Session = sessionmaker(bind=target_engine)
    db = Session()
    try:
        from app.main import seed_initial_data
        from app.models.user import User, UserRole
        from app.models.settings import StoreSettings
        from app.models.category import Category, Subcategory
        from app.core.security import get_password_hash
        import uuid
        import secrets

        # Migration statements
        migration_statements = [
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS footer_font_size VARCHAR(20) DEFAULT '10px'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS is_footer_bold BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS power_footer_text VARCHAR(255) DEFAULT 'Software powered by Dolly POS© | Since 2002'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS power_footer_font_size VARCHAR(20) DEFAULT '9px'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS is_power_footer_bold BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_upi_qr_on_bill BOOLEAN DEFAULT TRUE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT DEFAULT '1. Goods once sold can be exchanged within 7 days with original tag and bill intact.\n2. No cash refund.'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_terms_on_bill BOOLEAN DEFAULT TRUE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_bill_template TEXT",
            "UPDATE users SET full_name = 'Somesh Bang' WHERE username = 'admin'",
            "CREATE TABLE IF NOT EXISTS procurement_notes (id INTEGER PRIMARY KEY, item_name VARCHAR(255) NOT NULL, quantity INTEGER DEFAULT 1, description TEXT, vendor_name VARCHAR(255), estimated_price FLOAT DEFAULT 0.0, priority VARCHAR(50) DEFAULT 'NORMAL', status VARCHAR(50) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100) DEFAULT '@dollytoys_dhule'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_instagram_on_bill BOOLEAN DEFAULT TRUE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS facebook_handle VARCHAR(150)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_facebook_on_bill BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS threads_handle VARCHAR(100)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_threads_on_bill BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS website_url VARCHAR(150)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_website_on_bill BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_social_label VARCHAR(50)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_social_handle VARCHAR(150)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_custom_social_on_bill BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_social_label2 VARCHAR(50)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_social_handle2 VARCHAR(150)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_custom_social_on_bill2 BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_social_label3 VARCHAR(50)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_social_handle3 VARCHAR(150)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_custom_social_on_bill3 BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_social_label4 VARCHAR(50)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_social_handle4 VARCHAR(150)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_custom_social_on_bill4 BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_social_label5 VARCHAR(50)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_social_handle5 VARCHAR(150)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_custom_social_on_bill5 BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS auto_backup BOOLEAN DEFAULT TRUE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS backup_frequency VARCHAR(50) DEFAULT 'MONTHLY'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS backup_path VARCHAR(255) DEFAULT 'C:\\DollyPos_Backups'",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS season VARCHAR(50)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS damaged_quantity INTEGER DEFAULT 0",
            "CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);",
            "CREATE INDEX IF NOT EXISTS idx_products_speed_dial ON products (speed_dial_code);",
            "CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);",
            "CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);",
            "CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active);",
            "CREATE INDEX IF NOT EXISTS idx_products_last_sold ON products (last_sold_at);",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS opening_date VARCHAR(50) DEFAULT '2002-01-01';",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS bill_prefix VARCHAR(20) DEFAULT 'DLY';",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_enabled_1 BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_name_1 VARCHAR(100) DEFAULT 'Online / MDR Surcharge'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_condition_1 VARCHAR(50) DEFAULT 'GREATER_THAN'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_threshold_1 FLOAT DEFAULT 2000.0",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_type_1 VARCHAR(20) DEFAULT 'PERCENT'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_value_1 FLOAT DEFAULT 0.04",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_payment_mode_1 VARCHAR(50) DEFAULT 'ONLINE'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_enabled_2 BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_name_2 VARCHAR(100) DEFAULT 'Fixed Convenience Fee'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_condition_2 VARCHAR(50) DEFAULT 'ALWAYS'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_threshold_2 FLOAT DEFAULT 0.0",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_type_2 VARCHAR(20) DEFAULT 'FLAT'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_value_2 FLOAT DEFAULT 10.0",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_payment_mode_2 VARCHAR(50) DEFAULT 'ALL'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_enabled_3 BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_name_3 VARCHAR(100) DEFAULT 'Packaging / Handling Charge'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_condition_3 VARCHAR(50) DEFAULT 'ALWAYS'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_threshold_3 FLOAT DEFAULT 0.0",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_type_3 VARCHAR(20) DEFAULT 'FLAT'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_value_3 FLOAT DEFAULT 5.0",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_payment_mode_3 VARCHAR(50) DEFAULT 'ALL'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_enabled_4 BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_name_4 VARCHAR(100) DEFAULT 'Special Processing Fee'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_condition_4 VARCHAR(50) DEFAULT 'GREATER_EQUAL'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_threshold_4 FLOAT DEFAULT 1000.0",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_type_4 VARCHAR(20) DEFAULT 'PERCENT'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_value_4 FLOAT DEFAULT 1.0",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_payment_mode_4 VARCHAR(50) DEFAULT 'ALL'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_enabled_5 BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_name_5 VARCHAR(100) DEFAULT 'Custom Service Surcharge'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_condition_5 VARCHAR(50) DEFAULT 'ALWAYS'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_threshold_5 FLOAT DEFAULT 0.0",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_type_5 VARCHAR(20) DEFAULT 'FLAT'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_value_5 FLOAT DEFAULT 0.0",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS extra_charge_payment_mode_5 VARCHAR(50) DEFAULT 'ALL'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_festival_items TEXT",
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS extra_charges_amount FLOAT DEFAULT 0.0",
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS extra_charges_breakdown TEXT",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_drive_connected BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_drive_email VARCHAR(150)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_drive_folder_id VARCHAR(100)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_drive_refresh_token TEXT",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_drive_access_token TEXT",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_drive_token_expires_at TIMESTAMP",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_client_id VARCHAR(255)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_client_secret VARCHAR(255)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS backup_destination VARCHAR(50) DEFAULT 'BOTH'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS backup_on_app_close BOOLEAN DEFAULT TRUE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS backup_retention_days INTEGER DEFAULT 30",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS last_cloud_backup_at TIMESTAMP",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS backup_filename_prefix VARCHAR(100) DEFAULT 'DollyToys'",
            "ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_product_id_fkey, ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;",
            "ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_vendor_id_fkey, ADD CONSTRAINT purchases_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_id VARCHAR(50)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_token VARCHAR(30)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_secret VARCHAR(100)",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS cloud_sync_enabled BOOLEAN DEFAULT TRUE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS cloud_hub_url VARCHAR(255) DEFAULT 'https://dollypos-hub.onrender.com'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS last_cloud_sync_at TIMESTAMP",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS cloud_sync_status VARCHAR(50) DEFAULT 'IDLE'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS cloud_sync_error TEXT",
            "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_upi_id VARCHAR(100)",
            "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS outstanding_due FLOAT DEFAULT 0.0",
            "CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments (invoice_id)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS cgst_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS sgst_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_amount FLOAT DEFAULT 0.0",
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_amount FLOAT DEFAULT 0.0",
            "ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS cgst_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS cgst_amount FLOAT DEFAULT 0.0",
            "ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS sgst_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS sgst_amount FLOAT DEFAULT 0.0",
            "ALTER TABLE return_items ADD COLUMN IF NOT EXISTS tax_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE return_items ADD COLUMN IF NOT EXISTS tax_amount FLOAT DEFAULT 0.0",
            "ALTER TABLE return_items ADD COLUMN IF NOT EXISTS cgst_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE return_items ADD COLUMN IF NOT EXISTS cgst_amount FLOAT DEFAULT 0.0",
            "ALTER TABLE return_items ADD COLUMN IF NOT EXISTS sgst_percent FLOAT DEFAULT 0.0",
            "ALTER TABLE return_items ADD COLUMN IF NOT EXISTS sgst_amount FLOAT DEFAULT 0.0",
            "UPDATE products SET cgst_percent = ROUND((gst_percent / 2.0)::numeric, 2), sgst_percent = ROUND((gst_percent / 2.0)::numeric, 2) WHERE gst_percent > 0 AND (cgst_percent IS NULL OR cgst_percent = 0);",
        ]

        for stmt in migration_statements:
            try:
                db.execute(text(stmt))
                db.commit()
            except Exception:
                db.rollback()

        # Seed Store Settings
        store_settings = db.query(StoreSettings).first()
        if not store_settings:
            store_settings = StoreSettings(
                shop_name="Dolly Toys and Kids Wear",
                tag_line="Exclusive Kids Wear & Quality Toys",
                address="Agra Road, Near Mahatma Gandhi Statue, Dhule",
                mobile="7972558842",
                upi_id="7972558842@upi",
                bill_header="Tax Invoice / Retail Bill",
                bill_footer="Thank you for shopping at Dolly Toys! No exchange on Sundays.",
                thermal_width="80mm",
                barcode_label_size="50x25mm",
                theme_mode="light"
            )
            db.add(store_settings)
            db.commit()
            db.refresh(store_settings)
            print("      [OK] Seeded default Store Settings.")

        # Ensure unique store identifiers
        changed = False
        if not getattr(store_settings, 'store_id', None):
            store_settings.store_id = str(uuid.uuid4())
            changed = True
        if not getattr(store_settings, 'store_token', None):
            random_part = secrets.token_hex(3).upper()
            store_settings.store_token = f"DLY-STR1-{random_part}"
            changed = True
        if not getattr(store_settings, 'store_secret', None):
            store_settings.store_secret = secrets.token_urlsafe(32)
            changed = True
        if changed:
            db.commit()

        # Seed Owner User
        owner_user = db.query(User).filter(User.username == "admin").first()
        if not owner_user:
            owner_user = User(
                username="admin",
                password_hash=get_password_hash("somesh123"),
                full_name="Somesh Bang",
                role=UserRole.OWNER,
                is_active=True
            )
            db.add(owner_user)
            db.commit()
            print("      [OK] Seeded Owner User ('admin' / 'somesh123').")

        # Seed Staff User
        staff_user = db.query(User).filter(User.username == "staff").first()
        if not staff_user:
            staff_user = User(
                username="staff",
                password_hash=get_password_hash("staff123"),
                full_name="Counter Staff",
                role=UserRole.STAFF,
                is_active=True
            )
            db.add(staff_user)
            db.commit()
            print("      [OK] Seeded Staff User ('staff' / 'staff123').")

        # Starter categories
        cat_count = db.query(Category).count()
        if cat_count == 0:
            starter_categories = [
                ("Toys & Games", ["Board Games", "Battery Toys", "Soft Toys", "Educational Toys", "Die-Cast Cars"]),
                ("Boys Wear", ["T-Shirts", "Shirts", "Jeans", "Shorts", "Ethnic Wear", "Party Wear Suit"]),
                ("Girls Wear", ["Frocks & Dresses", "Tops & Tees", "Skirts", "Leggings", "Lehenga Choli", "Gowns"]),
                ("Infants & Babies", ["Rompers", "Baby Suits", "Bibs & Mittens", "Swaddles", "Rattles"]),
                ("Kids Footwear", ["Casual Shoes", "Sandals", "Crocs / Clogs", "LED Light Shoes", "Booties"]),
                ("Accessories", ["School Bags", "Water Bottles", "Hair Accessories", "Socks & Caps", "Sunglasses"])
            ]
            for cat_name, subcats in starter_categories:
                cat = Category(name=cat_name)
                db.add(cat)
                db.flush()
                for sub_name in subcats:
                    sub = Subcategory(category_id=cat.id, name=sub_name)
                    db.add(sub)
            db.commit()
            print("      [OK] Seeded Starter Categories and Subcategories.")
    finally:
        db.close()

    # 5. Persist .env configuration
    print(f"\n[5/5] Updating application environment files (.env)...")
    update_env_files(user, password, host, str(port), dbname)

    # 6. Verify and display table summary
    insp = inspect(target_engine)
    all_tables = sorted(insp.get_table_names())
    target_engine.dispose()

    print("\n" + "=" * 72)
    print(f"   DATABASE INITIALIZATION COMPLETE: '{dbname}' IS 100% READY!")
    print("=" * 72)
    print(f"Total Tables Created / Verified: {len(all_tables)}")
    print("-" * 72)
    for i, t in enumerate(all_tables, 1):
        cols = len(insp.get_columns(t))
        print(f"  [{i:02d}] {t:30} ({cols} columns)")
    print("-" * 72)
    print("Default Credentials Initialized:")
    print("  * Owner Admin Account : Username: admin | Password: somesh123")
    print("  * Counter Staff Account: Username: staff | Password: staff123")
    print("=" * 72)
    print("Dolly POS can now connect to this database seamlessly!\n")


def main():
    parser = argparse.ArgumentParser(description="Dolly POS Database & Schema Initialization")
    parser.add_argument("--dbname", "-d", help="Database name", default=None)
    parser.add_argument("--user", "-u", help="PostgreSQL superuser", default=None)
    parser.add_argument("--password", "-p", help="PostgreSQL superuser password", default=None)
    parser.add_argument("--host", "-H", help="PostgreSQL host", default=None)
    parser.add_argument("--port", "-P", help="PostgreSQL port", default=None)
    parser.add_argument("--non-interactive", "-y", action="store_true", help="Run without prompts using defaults")

    args = parser.parse_args()

    # Defaults
    default_dbname = "dollytoyskidswear"
    default_user = "postgres"
    default_pass = "somesh123"
    default_host = "127.0.0.1"
    default_port = "5432"

    if args.non_interactive:
        dbname = args.dbname or default_dbname
        user = args.user or default_user
        password = args.password or default_pass
        host = args.host or default_host
        port = args.port or default_port
    elif all([args.dbname, args.user, args.password]):
        dbname = args.dbname
        user = args.user
        password = args.password
        host = args.host or default_host
        port = args.port or default_port
    else:
        print("=" * 72)
        print("   DOLLY POS - INTERACTIVE DATABASE SETUP")
        print("   Press [ENTER] on any prompt to accept the default recommended values.")
        print("=" * 72)
        dbname = prompt_with_default(" 1. Database Name", default_dbname)
        user = prompt_with_default(" 2. PostgreSQL Superuser", default_user)
        password = prompt_with_default(" 3. Superuser Password", default_pass)
        port = prompt_with_default(" 4. PostgreSQL Port", default_port)
        host = prompt_with_default(" 5. PostgreSQL Host", default_host)

    init_database(dbname=dbname, user=user, password=password, host=host, port=port)


if __name__ == "__main__":
    main()
