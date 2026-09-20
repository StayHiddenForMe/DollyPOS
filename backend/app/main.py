from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from sqlalchemy import text
from app.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api import api_router
from app.models.user import User, UserRole
from app.models.settings import StoreSettings
from app.models.category import Category, Subcategory
from app.core.security import get_password_hash

def seed_initial_data():
    """Ensures database has default Owner account, store settings, starter categories, and all required columns."""
    db = SessionLocal()
    try:
        # 1. Create tables if they don't exist
        Base.metadata.create_all(bind=engine)

        # 2. Run auto-migrations for newly added columns across tables
        migration_statements = [
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS footer_font_size VARCHAR(20) DEFAULT '10px'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS is_footer_bold BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS power_footer_font_size VARCHAR(20) DEFAULT '9px'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS is_power_footer_bold BOOLEAN DEFAULT FALSE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT DEFAULT '1. Goods once sold can be exchanged within 7 days with original tag and bill intact.\n2. No cash refund.'",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS show_terms_on_bill BOOLEAN DEFAULT TRUE",
            "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_bill_template TEXT",
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
            "ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_product_id_fkey, ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;",
            "ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_vendor_id_fkey, ADD CONSTRAINT purchases_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;",
        ]
        for stmt in migration_statements:
            try:
                db.execute(text(stmt))
                db.commit()
            except Exception:
                db.rollback()

        # 3. Check and seed Store Settings
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

        # 3. Check and seed Owner User
        owner_user = db.query(User).filter(User.username == "admin").first()
        if not owner_user:
            owner_user = User(
                username="admin",
                password_hash=get_password_hash("somesh123"),
                full_name="Somesh Bang (Owner)",
                role=UserRole.OWNER,
                is_active=True
            )
            db.add(owner_user)

        # 4. Check and seed Staff User
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

        # 5. Starter categories if empty
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
    except Exception as e:
        print(f"Database bootstrap warning: {e}")
        db.rollback()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup bootstrap
    seed_initial_data()
    yield

from starlette.middleware.gzip import GZipMiddleware

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Enable high-speed gzip compression for JSON payloads > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    db_type = "PostgreSQL Live" if "postgresql" in str(engine.url) else "Local SQLite Engine Live"
    return {
        "status": "online",
        "service": "Dolly POS Core API",
        "shop": "Dolly Toys and Kids Wear",
        "location": "Dhule",
        "database": db_type
    }

@app.get(f"{settings.API_V1_STR}/health")
def api_v1_health():
    return health_check()

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
