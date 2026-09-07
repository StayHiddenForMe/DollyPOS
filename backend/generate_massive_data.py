import os
import sys
import random
import time
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.models.category import Category, Subcategory
from app.models.vendor import Vendor, VendorLedger, VendorLedgerType
from app.models.customer import Customer, CustomerLedger, CustomerLedgerType
from app.models.product import Product
from app.models.product_price_history import ProductPriceHistory
from app.models.invoice import Invoice, InvoiceItem, Payment, PaymentMode, PaymentStatus
from app.models.expense import Expense, ExpenseCategory
from app.models.return_order import ReturnOrder, ReturnItem, ReturnType
from app.models.settings import StoreSettings
from app.core.security import get_password_hash
from sqlalchemy import text

# -------------------------------------------------------------
# MASTER SEED DICTIONARIES
# -------------------------------------------------------------

CATEGORIES_MAP = {
    "Boys Wear": {
        "subcategories": ["T-Shirts", "Casual Shirts", "Denim Jeans", "Cotton Shorts", "Ethnic Kurta Pajama", "Party Wear Suits", "Winter Hoodies", "Nightwear Pajamas", "Cotton Vests & Briefs", "Sweatshirts"],
        "fabrics": ["100% Combed Cotton", "Denim", "Linen Blend", "Cotton Hosiery", "Fleece", "Terry Cotton", "Silk Blend", "Chambray"],
        "brands": ["Dolly Kids", "Mini Star", "Gini & Jony", "ToffyHouse", "Little Kangaroos", "Peppermint", "Marvel Kids", "USPA Kids"]
    },
    "Girls Wear": {
        "subcategories": ["Frocks & Party Dresses", "Gowns & Tutu Dresses", "Crop Tops & Tees", "Denim Skirts", "Lehenga Choli", "Dungaree Sets", "Stretch Leggings", "Floral Jumpsuits", "Traditional Anarkali", "Velvet Winter Coats"],
        "fabrics": ["Soft Cotton", "Net & Satin", "Silk Brocade", "Chiffon", "Georgette", "Cotton Lycra", "Velvet", "Organza"],
        "brands": ["Dolly Princess", "Barbie Fashion", "Mini Star Girls", "ToffyHouse Girls", "Angel Wear", "Little Diva", "Gini Girls", "Disney Princess"]
    },
    "Infants & Babies": {
        "subcategories": ["Rompers & Bodysuits", "Baby Jumpsuits", "Bibs & Mittens", "Cotton Swaddles", "Rattles & Teethers", "Hooded Towels", "Baby Booties", "Newborn Gift Sets", "Baby Sleeping Bags", "Cap & Sock Sets"],
        "fabrics": ["100% Organic Bamboo Cotton", "Pure Cotton Muslin", "Soft Fleece", "Hypoallergenic Cotton"],
        "brands": ["Popees", "Mee Mee", "Chicco Baby", "Himalaya Baby", "Mothercare", "LuvLap", "Dolly Baby", "FirstStep"]
    },
    "Toys & Games": {
        "subcategories": ["Die-Cast Metal Cars", "Remote Control Monster Trucks", "Barbie & Fashion Dolls", "Educational Wooden Puzzles", "Board Games & Chess", "Soft Plush Teddy Bears", "Battery Operated Animals", "Building Blocks & Lego", "Musical Keyboards & Drums", "Art & Magic Slime", "Action Superhero Figures", "Dart Guns & Blasters"],
        "fabrics": ["Non-Toxic Plastic", "Die-Cast Alloy", "Soft Plush Fabric", "Wood", "Silicon", "Rubber"],
        "brands": ["Hot Wheels", "Funskool", "Barbie", "Lego", "Fisher-Price", "Nerf Pro", "Chhota Bheem", "Dolly Toys", "Maisto", "Hasbro"]
    },
    "Kids Footwear": {
        "subcategories": ["Casual Sneakers", "LED Light Shoes", "Sandals & Floaters", "Clogs & Crocs", "School Black Shoes", "Infant Soft Booties", "Party Bellies", "Rain Gumboots"],
        "fabrics": ["Breathable Mesh", "EVA Foam", "Faux Leather", "Canvas", "Soft Rubber"],
        "brands": ["Action Kids", "Liberty Force", "Crocs Kids", "Bata Toughees", "Mini Star Shoes", "Dolly Walkers", "Puma Kids", "Skechers Junior"]
    },
    "Accessories": {
        "subcategories": ["School Bags & Backpacks", "Insulated Water Bottles", "Pencil Box & Geometry Sets", "Hair Bands & Clips", "Cotton Socks & Caps", "UV Kids Sunglasses", "Cartoon Lunch Boxes", "Kids Umbrellas"],
        "fabrics": ["Durable Polyester", "Stainless Steel", "BPA-Free Plastic", "Cotton Spandex", "Acrylic"],
        "brands": ["Wildcraft Kids", "Milton Junior", "Cello Kids", "Disney Stationery", "Dolly Gear", "Doraemon World", "Barbie Gear", "Skybags Junior"]
    }
}

SIZES_CLOTHING = ["0-3M", "3-6M", "6-12M", "1-2Y", "2-3Y", "3-4Y", "4-5Y", "5-6Y", "7-8Y", "9-10Y", "11-12Y", "13-14Y", "14", "16", "18", "20", "22", "24", "26", "28", "30", "S", "M", "L", "XL"]
SIZES_FOOTWEAR = ["3C", "4C", "5C", "6C", "7C", "8C", "9C", "10C", "11C", "12C", "13C", "1Y", "2Y", "3Y", "4Y", "5Y"]
SIZES_TOYS = ["Standard", "Large", "Mini", "Pack of 2", "Pack of 4", "Set of 6", "Deluxe Edition"]

COLORS = [
    "Royal Blue", "Sky Blue", "Baby Pink", "Hot Pink", "Crimson Red", 
    "Emerald Green", "Mint Green", "Bright Yellow", "Coral Peach", 
    "Lavender Purple", "Navy Blue", "Charcoal Black", "Pure White", 
    "Maroon", "Orange", "Multicolor Print", "Gold", "Silver Grey"
]

SEASONS = ["All-Season", "Summer Collection", "Winter Special", "Monsoon", "Diwali Festive", "Party Special"]

FIRST_NAMES_M = ["Aarav", "Vihaan", "Aditya", "Sai", "Reyansh", "Kishore", "Siddharth", "Rohan", "Atharva", "Om", "Ganesh", "Sachin", "Nitin", "Prashant", "Rahul", "Somesh", "Vikas", "Suresh", "Mahesh", "Dipak", "Kiran", "Yogesh", "Anil", "Sunil", "Manish"]
FIRST_NAMES_F = ["Ananya", "Aadhya", "Sai", "Pooja", "Priya", "Sneha", "Riya", "Tanvi", "Swati", "Neha", "Kavita", "Anita", "Roshni", "Dipali", "Shital", "Komal", "Sonali", "Jyoti", "Manisha", "Madhuri", "Sunita", "Asha", "Meena", "Sangita", "Pallavi"]
LAST_NAMES = ["Patil", "Sharma", "Deshmukh", "Shinde", "Bang", "Kulkarni", "Joshi", "Pawar", "Chaudhari", "Sonawane", "Mali", "Ahirrao", "Borse", "Mahajan", "Wagh", "Bhamare", "More", "Borse", "Badgujar", "Kapadia", "Shah", "Jain", "Agarwal", "Bhandari", "Gupta"]

LOCALITIES_DHULE = [
    "Agra Road, Dhule", "Deopur, Dhule", "Phule Market, Dhule", "Parola Road, Dhule",
    "Navi Vasti, Dhule", "Chitod Road, Dhule", "Mahindale, Dhule", "Walwadi, Dhule",
    "Sakri Road, Dhule", "Near Mahatma Gandhi Statue, Dhule", "Songir, Dhule", "Shirpur"
]

def generate_massive_dataset():
    print("===================================================================")
    print("  DOLLY POS: GENERATING 20,000+ PRODUCTS & 5 YEARS OF RETAIL DATA  ")
    print("===================================================================")
    
    db = SessionLocal()
    try:
        t_start = time.time()
        
        # 1. Verify / Bootstrap Admin
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                password_hash=get_password_hash("somesh123"),
                full_name="Somesh Bang (Owner)",
                role=UserRole.OWNER,
                is_active=True
            )
            db.add(admin)
            db.flush()

        # 2. Seed Vendors
        print("\n[Step 1/6] Seeding Wholesale Suppliers...")
        vendors_data = [
            ("SUR01", "Surat Kids Wholesale Hub", "Surat Apparel Textiles Pvt Ltd", "9825100001", "Surat, Gujarat", "Leading kids frocks & cotton garments manufacturer"),
            ("MUM02", "Mumbai Toy Emporium", "Nariman Toy Traders & Importers", "9820200002", "Crawford Market, Mumbai", "Die-cast cars, remote toys & board games distributor"),
            ("DEL03", "Delhi Garment Junction", "Gandhi Nagar Kids Garment Syndicate", "9811300003", "Gandhi Nagar, Delhi", "Winter jackets, party suits & hoodies supplier"),
            ("AHM04", "Ahmedabad Cotton Mills", "Sabarmati Hosiery & Textile Ltd", "9824400004", "Ahmedabad, Gujarat", "Infants rompers, vests & daily wear cottons"),
            ("KOL05", "Kolkata Hosiery Works", "Burrabazar Hosiery & Mittens Center", "9830500005", "Burrabazar, Kolkata", "Baby gift sets, socks, caps & accessories"),
            ("BLR06", "Bangalore Games & Gadgets", "Silicon Toy Innovations", "9845600006", "Bangalore, Karnataka", "STEM educational toys, puzzles & electronic games")
        ]
        
        vendor_objs = []
        vendor_code_map = {}
        for vcode, vname, vcomp, vphone, vcity, vnotes in vendors_data:
            vend = db.query(Vendor).filter(Vendor.vendor_code == vcode).first()
            if not vend:
                vend = Vendor(
                    vendor_code=vcode,
                    name=vname,
                    company_name=vcomp,
                    phone=vphone,
                    city=vcity,
                    notes=vnotes,
                    outstanding_due=random.choice([0.0, 15000.0, 32000.0, 48000.0]),
                    bank_name="State Bank of India",
                    bank_account_no=f"SBIN00{random.randint(10000000, 99999999)}",
                    bank_ifsc="SBIN0001234"
                )
                db.add(vend)
                db.flush()
            vendor_objs.append(vend)
            vendor_code_map[vcode] = vend
        db.commit()
        print(f"  -> {len(vendor_objs)} Suppliers active with vendor shortcodes.")

        # 3. Seed Categories & Subcategories
        print("\n[Step 2/6] Seeding Categories & Subcategories...")
        cat_map = {}
        for cat_name, details in CATEGORIES_MAP.items():
            cat = db.query(Category).filter(Category.name == cat_name).first()
            if not cat:
                cat = Category(name=cat_name, description=f"Premium {cat_name} for boys, girls and toddlers")
                db.add(cat)
                db.flush()
            cat_map[cat_name] = {"cat_obj": cat, "subcats": []}

            for sub_name in details["subcategories"]:
                sub = db.query(Subcategory).filter(Subcategory.category_id == cat.id, Subcategory.name == sub_name).first()
                if not sub:
                    sub = Subcategory(category_id=cat.id, name=sub_name)
                    db.add(sub)
                    db.flush()
                cat_map[cat_name]["subcats"].append(sub)
        db.commit()
        print(f"  -> {len(cat_map)} Categories with all Subcategories mapped.")

        # 4. Generate 20,000+ Unique Products
        print("\n[Step 3/6] Generating 20,000+ Unique Products Catalog...")
        current_prod_count = db.query(Product).count()
        target_count = 20500
        needed = max(0, target_count - current_prod_count)

        if needed > 0:
            print(f"  -> Adding {needed} realistic retail products in optimized chunks...")
            products_to_insert = []
            
            speed_dials_pool = [
                ("1", "Infant Soft Organic Onesie (Pack of 2)"),
                ("2", "Boys 100% Cotton Polo Shirt"),
                ("3", "Baby Bibs & Mittens 4-Piece Set"),
                ("M10", "Dolly Cotton Mittens Pair"),
                ("B01", "Boys Denim Daily Wear Jeans"),
                ("B02", "Boys Printed Cotton T-Shirt"),
                ("B03", "Boys Ethnic Kurta Pajama Set"),
                ("G01", "Girls Butterfly Fairy Frock"),
                ("G02", "Girls Stretchable Cotton Leggings"),
                ("G03", "Girls Floral Summer Jumpsuit"),
                ("T01", "Hot Wheels Die-Cast Supercar"),
                ("T02", "Remote Control 4WD Monster Truck"),
                ("T03", "Barbie Fashion Princess Doll"),
                ("T04", "Building Blocks 100 Pcs Bucket"),
                ("S01", "Kids LED Light Casual Sneakers"),
                ("S02", "Kids Cartoon Water Sandals"),
                ("A01", "Cartoon Insulated School Bottle"),
                ("A02", "Spiderman Embossed School Bag"),
                ("CAP", "Kids Sun Protection Cotton Cap"),
                ("SOCK", "Cotton Ankle Socks (Pack of 3)"),
                ("RATTLE", "Non-Toxic Silicon Baby Rattle"),
                ("TEDDY", "Soft Plush Teddy Bear (30 cm)")
            ]
            existing_speed_codes = set(p[0].upper() for p in db.query(Product.speed_dial_code).filter(Product.speed_dial_code.isnot(None)).all())
            speed_dial_used = set(existing_speed_codes)

            start_barcode_idx = 890422900000 + current_prod_count

            for i in range(needed):
                barcode_num = start_barcode_idx + i + 1
                barcode_str = str(barcode_num)

                cat_name = random.choice(list(CATEGORIES_MAP.keys()))
                cat_info = cat_map[cat_name]
                cat_obj = cat_info["cat_obj"]
                subcat_obj = random.choice(cat_info["subcats"]) if cat_info["subcats"] else None
                
                fabric = random.choice(CATEGORIES_MAP[cat_name]["fabrics"])
                brand = random.choice(CATEGORIES_MAP[cat_name]["brands"])
                color = random.choice(COLORS)
                season = random.choice(SEASONS)
                
                if cat_name in ["Boys Wear", "Girls Wear", "Infants & Babies"]:
                    size = random.choice(SIZES_CLOTHING)
                    gender = "Boys" if cat_name == "Boys Wear" else ("Girls" if cat_name == "Girls Wear" else "Unisex")
                    cost_price = round(random.uniform(70.0, 650.0), 2)
                    markup = random.uniform(1.4, 2.3)
                    selling_price = round(cost_price * markup / 10) * 10 - 1.0
                    mrp = round(selling_price * random.uniform(1.15, 1.45) / 10) * 10 - 1.0
                elif cat_name == "Kids Footwear":
                    size = random.choice(SIZES_FOOTWEAR)
                    gender = random.choice(["Boys", "Girls", "Unisex"])
                    cost_price = round(random.uniform(120.0, 850.0), 2)
                    markup = random.uniform(1.4, 2.0)
                    selling_price = round(cost_price * markup / 10) * 10 - 1.0
                    mrp = round(selling_price * random.uniform(1.15, 1.4) / 10) * 10 - 1.0
                else:
                    size = random.choice(SIZES_TOYS)
                    gender = "Unisex"
                    cost_price = round(random.uniform(40.0, 1200.0), 2)
                    markup = random.uniform(1.5, 2.5)
                    selling_price = round(cost_price * markup / 10) * 10 - 1.0
                    mrp = round(selling_price * random.uniform(1.2, 1.5) / 10) * 10 - 1.0

                vendor = random.choice(vendor_objs)

                adj = random.choice(["Premium", "Super Soft", "Classic", "Stylish", "Comfort", "Deluxe", "Trendy", "Durable", "Exclusive", "Party Wear"])
                prod_name = f"{brand} {adj} {subcat_obj.name if subcat_obj else cat_name}"

                margin_percent = round(((selling_price - cost_price) / cost_price) * 100, 2)
                stock_qty = random.randint(3, 48)

                is_speed = False
                dial_code = None
                for candidate_code, candidate_name in speed_dials_pool:
                    if candidate_code not in speed_dial_used:
                        dial_code = candidate_code
                        is_speed = True
                        prod_name = f"{candidate_name}"
                        speed_dial_used.add(candidate_code)
                        break

                age = "0-2 Years" if size in ["0-3M", "3-6M", "6-12M", "1-2Y"] else ("3-6 Years" if size in ["2-3Y", "3-4Y", "4-5Y", "5-6Y"] else "7-14 Years")

                days_ago = random.randint(1, 1800)
                p_created_at = datetime.utcnow() - timedelta(days=days_ago)

                prod = Product(
                    barcode=barcode_str,
                    sku=f"DLY-{cat_name[:3].upper()}-{barcode_str[-5:]}",
                    name=prod_name,
                    category_id=cat_obj.id,
                    subcategory_id=subcat_obj.id if subcat_obj else None,
                    vendor_code=vendor.vendor_code,
                    brand=brand,
                    gender=gender,
                    age_group=age,
                    size=size,
                    color=color,
                    fabric=fabric,
                    season=season,
                    purchase_price=cost_price,
                    selling_price=selling_price,
                    mrp=mrp,
                    gst_percent=random.choice([0.0, 5.0, 12.0]),
                    margin_percent=margin_percent,
                    stock_quantity=stock_qty,
                    damaged_quantity=random.choice([0, 0, 0, 0, 0, 0, 1, 2, 3]) if random.random() < 0.04 else 0,
                    min_stock_alert=3,
                    is_speed_dial=is_speed,
                    speed_dial_code=dial_code,
                    speed_dial_color="#DB2777" if is_speed else "#3B82F6",
                    is_active=True,
                    created_at=p_created_at,
                    updated_at=p_created_at
                )
                products_to_insert.append(prod)

                if len(products_to_insert) >= 2500:
                    db.bulk_save_objects(products_to_insert)
                    db.commit()
                    products_to_insert = []
                    print(f"    -> Inserted {i + 1}/{needed} products...")

            if products_to_insert:
                db.bulk_save_objects(products_to_insert)
                db.commit()
            print(f"  -> [SUCCESS] Total Products in Database: {db.query(Product).count()}")
        else:
            print(f"  -> Catalog already has {current_prod_count} products.")

        # 5. Generate 500+ Local Customers
        print("\n[Step 4/6] Seeding 500+ Dhule & Regional Customers...")
        cust_count = db.query(Customer).count()
        if cust_count < 400:
            customers_to_insert = []
            phone_set = set(c[0] for c in db.query(Customer.phone).all())
            
            for _ in range(500):
                fn = random.choice(FIRST_NAMES_M + FIRST_NAMES_F)
                ln = random.choice(LAST_NAMES)
                name = f"{fn} {ln}"
                
                while True:
                    pfx = random.choice(["98", "97", "96", "95", "94", "93", "91", "88", "87", "86", "79", "78", "77"])
                    phone = f"{pfx}{random.randint(10000000, 99999999)}"
                    if phone not in phone_set:
                        phone_set.add(phone)
                        break

                address = random.choice(LOCALITIES_DHULE)
                has_khata = random.random() < 0.12
                credit_bal = round(random.uniform(500.0, 8500.0), 2) if has_khata else 0.0

                days_ago = random.randint(1, 1750)
                cust_created = datetime.utcnow() - timedelta(days=days_ago)

                cust = Customer(
                    name=name,
                    phone=phone,
                    alt_phone=f"98{random.randint(10000000, 99999999)}" if random.random() < 0.3 else None,
                    city="Dhule",
                    address=address,
                    credit_balance=credit_bal,
                    total_spend=round(random.uniform(1200.0, 45000.0), 2),
                    visit_count=random.randint(1, 28),
                    notes="Regular customer • Prefers organic cotton" if random.random() < 0.2 else None,
                    created_at=cust_created,
                    last_visit_at=datetime.utcnow() - timedelta(days=random.randint(1, 45))
                )
                customers_to_insert.append(cust)

            db.bulk_save_objects(customers_to_insert)
            db.commit()
            print(f"  -> [SUCCESS] 500+ Customers seeded with Khata books.")
        else:
            print(f"  -> Customers already present ({cust_count}).")

        # 6. Generate 5 Full Years of Sales Invoices (2021 to 2026)
        print("\n[Step 5/6] Generating 5 Years of Realistic Historical Retail Bills (2021 - 2026)...")
        existing_inv_count = db.query(Invoice).count()
        
        if existing_inv_count < 3000:
            print("  -> Simulating 5 years of daily transactions, seasonal spikes (Diwali, Christmas, Back-to-school), and payment channels...")
            all_prods = db.query(Product).all()
            all_custs = db.query(Customer).all()
            
            existing_bills_set = set(b[0] for b in db.query(Invoice.bill_number).all())
            
            current_date = datetime.utcnow() - timedelta(days=5 * 365)
            end_date = datetime.utcnow()
            
            days_total = (end_date - current_date).days
            day_cursor = current_date

            for day_idx in range(days_total):
                m = day_cursor.month
                weekday = day_cursor.weekday()
                
                volume_mult = 1.0
                if m in [10, 11]: # Diwali season
                    volume_mult = 3.5
                elif m == 12: # Christmas / New year
                    volume_mult = 2.4
                elif m in [5, 6]: # Back to school & Summer
                    volume_mult = 2.2
                elif m == 4:
                    volume_mult = 1.8

                if weekday in [5, 6]:
                    volume_mult *= 1.5

                base_daily_bills = random.randint(2, 6)
                daily_bills = max(1, int(base_daily_bills * volume_mult))

                today_str = day_cursor.strftime("%Y%m%d")

                for b_idx in range(daily_bills):
                    # Guarantee unique bill number
                    seq = b_idx + 1
                    while True:
                        bill_no = f"DLY-{today_str}-{seq:04d}"
                        if bill_no not in existing_bills_set:
                            existing_bills_set.add(bill_no)
                            break
                        seq += 1
                    
                    num_items = random.choices([1, 2, 3, 4, 5], weights=[40, 30, 18, 8, 4])[0]
                    chosen_prods = random.sample(all_prods, min(num_items, len(all_prods)))
                    
                    subtotal = 0.0
                    total_tax = 0.0
                    inv_items_temp = []
                    
                    for p in chosen_prods:
                        qty = random.choices([1, 2, 3], weights=[85, 12, 3])[0]
                        price = p.selling_price
                        cost = p.purchase_price
                        item_total = price * qty
                        subtotal += item_total
                        tax_amt = round(item_total * (p.gst_percent / 100), 2)
                        total_tax += tax_amt

                        inv_items_temp.append({
                            "product_id": p.id,
                            "item_name": p.name,
                            "barcode": p.barcode,
                            "sku": p.sku,
                            "size": p.size,
                            "color": p.color,
                            "quantity": qty,
                            "unit_price": price,
                            "cost_price": cost,
                            "discount_amount": 0.0,
                            "tax_percent": p.gst_percent,
                            "tax_amount": tax_amt,
                            "total_price": item_total,
                            "is_unlisted": False
                        })

                    discount = 0.0
                    if subtotal > 1500 and random.random() < 0.25:
                        discount = round(subtotal * random.choice([0.05, 0.10]), 2)

                    grand_total = round(subtotal - discount + total_tax, 2)
                    
                    pm_choice = random.choices(
                        [PaymentMode.UPI, PaymentMode.CASH, PaymentMode.CREDIT_KHATA],
                        weights=[58, 37, 5]
                    )[0]

                    cust = None
                    cust_name = None
                    cust_phone = None
                    if random.random() < 0.65 or pm_choice == PaymentMode.CREDIT_KHATA:
                        cust = random.choice(all_custs)
                        cust_name = cust.name
                        cust_phone = cust.phone

                    paid_amt = 0.0 if pm_choice == PaymentMode.CREDIT_KHATA else grand_total
                    due_amt = grand_total if pm_choice == PaymentMode.CREDIT_KHATA else 0.0

                    sale_hour = random.randint(10, 21)
                    sale_min = random.randint(0, 59)
                    sale_dt = day_cursor.replace(hour=sale_hour, minute=sale_min, second=random.randint(0, 59))

                    inv_obj = Invoice(
                        bill_number=bill_no,
                        customer_id=cust.id if cust else None,
                        cashier_id=admin.id,
                        customer_name=cust_name or "Walk-in Customer",
                        customer_phone=cust_phone,
                        subtotal=round(subtotal, 2),
                        discount_amount=discount,
                        discount_type="FESTIVE_OFFER" if discount > 0 else "NONE",
                        tax_amount=total_tax,
                        round_off=0.0,
                        grand_total=grand_total,
                        paid_amount=paid_amt,
                        change_amount=0.0,
                        due_amount=due_amt,
                        payment_mode=pm_choice,
                        payment_status=PaymentStatus.CREDIT if due_amt > 0 else PaymentStatus.PAID,
                        is_held=False,
                        is_cancelled=False,
                        created_at=sale_dt
                    )
                    db.add(inv_obj)
                    db.flush()

                    for itm in inv_items_temp:
                        itm_obj = InvoiceItem(
                            invoice_id=inv_obj.id,
                            **itm
                        )
                        db.add(itm_obj)

                    if paid_amt > 0:
                        pay_obj = Payment(
                            invoice_id=inv_obj.id,
                            payment_mode=pm_choice,
                            amount=paid_amt,
                            created_at=sale_dt
                        )
                        db.add(pay_obj)

                db.commit()
                day_cursor += timedelta(days=1)
                
                if day_idx % 180 == 0:
                    print(f"    -> Simulated {day_idx}/{days_total} days of 5-year timeline (Current: {day_cursor.strftime('%b %Y')})...")

            print(f"  -> [SUCCESS] 5 Years of Historical Bills generated! Total Invoices: {db.query(Invoice).count()}")
        else:
            print(f"  -> Sales data already generated ({existing_inv_count} bills).")

        # 7. Generate 5 Years of Operating Expenses
        print("\n[Step 6/6] Generating 5 Years of Operating Expenses...")
        exp_count = db.query(Expense).count()
        if exp_count < 200:
            expenses_to_insert = []
            exp_date = datetime.utcnow() - timedelta(days=5 * 365)
            end_date = datetime.utcnow()

            while exp_date <= end_date:
                if exp_date.day == 1:
                    expenses_to_insert.append(Expense(
                        title="Agra Road Showroom Monthly Rent",
                        category=ExpenseCategory.SHOP_RENT,
                        amount=25000.0,
                        payment_mode="BANK_TRANSFER",
                        paid_to="Showroom Landlord",
                        expense_date=exp_date,
                        notes="Monthly lease rent"
                    ))
                    expenses_to_insert.append(Expense(
                        title="Counter & Sales Staff Monthly Salaries",
                        category=ExpenseCategory.STAFF_SALARY,
                        amount=random.choice([32000.0, 35000.0, 38000.0]),
                        payment_mode="BANK_TRANSFER",
                        paid_to="Staff Team",
                        expense_date=exp_date
                    ))
                elif exp_date.day == 10:
                    expenses_to_insert.append(Expense(
                        title="MSEDCL Commercial Electricity Bill",
                        category=ExpenseCategory.ELECTRICITY,
                        amount=round(random.uniform(4200.0, 6800.0), 2),
                        payment_mode="UPI",
                        paid_to="MSEDCL Dhule",
                        expense_date=exp_date
                    ))
                
                if random.random() < 0.4:
                    expenses_to_insert.append(Expense(
                        title="Daily Tea & Refreshments for Staff & Customers",
                        category=ExpenseCategory.FOOD,
                        amount=random.choice([120.0, 150.0, 180.0, 220.0]),
                        payment_mode="CASH",
                        paid_to="Near Tea Stall",
                        expense_date=exp_date
                    ))

                if exp_date.day in [5, 20]:
                    expenses_to_insert.append(Expense(
                        title="Transport & Parcel Freight Charges",
                        category=ExpenseCategory.TRANSPORT,
                        amount=round(random.uniform(1800.0, 4200.0), 2),
                        payment_mode="UPI",
                        paid_to="Navata / VRL Logistics",
                        expense_date=exp_date
                    ))

                exp_date += timedelta(days=1)

            db.bulk_save_objects(expenses_to_insert)
            db.commit()
            print(f"  -> [SUCCESS] 5 Years of Operating Expenses seeded ({len(expenses_to_insert)} records).")
        else:
            print(f"  -> Expenses already seeded ({exp_count}).")

        print("\nOptimizing PostgreSQL B-Tree search indexes on massive dataset...")
        db.execute(text("ANALYZE;"))
        db.commit()

        t_end = time.time()
        print("\n===================================================================")
        print(f"  SYNTHETIC DATA COMPLETE IN {round(t_end - t_start, 2)} SECONDS!  ")
        print(f"  Total Products:  {db.query(Product).count()}")
        print(f"  Total Invoices:  {db.query(Invoice).count()}")
        print(f"  Total Customers: {db.query(Customer).count()}")
        print(f"  Total Expenses:  {db.query(Expense).count()}")
        print("===================================================================")

    finally:
        db.close()

if __name__ == "__main__":
    generate_massive_dataset()
