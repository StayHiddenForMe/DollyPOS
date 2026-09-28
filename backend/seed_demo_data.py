import os
import sys
import random
from datetime import datetime, date, timedelta

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from app.core.database import SessionLocal
from app.models.category import Category, Subcategory
from app.models.product import Product
from app.models.customer import Customer, CustomerLedger, CustomerLedgerType
from app.models.vendor import Vendor, VendorLedger, VendorLedgerType
from app.models.invoice import Invoice, InvoiceItem, Payment, PaymentMode, PaymentStatus
from app.models.expense import Expense, ExpenseCategory
from app.models.lost_demand import LostDemand, ProcurementNote, LostDemandStatus, LostDemandUrgency
from app.models.purchase import Purchase, PurchaseItem, PurchaseStatus
from app.models.user import User

IST_OFFSET = timedelta(hours=5, minutes=30)

def seed_demo_data():
    db = SessionLocal()
    print("=" * 60)
    print("  Populating Dolly POS with Realistic Demo Test Data...")
    print("=" * 60)

    try:
        # 1. Fetch or create Categories
        cat_map = {}
        for c in db.query(Category).all():
            cat_map[c.name] = c

        # 2. Seed Vendors
        vendors_data = [
            ("Marvel Toy Distributors", "MUM01", "Mumbai", "9820112233", "marveltoys.mum@gmail.com", "27AABCM1234F1Z5"),
            ("Surat Kids Garments Hub", "SUR01", "Surat", "9898223344", "suratkidsfashion@gmail.com", "24AABCS5678G1Z2"),
            ("Delhi Soft Toys Wholesalers", "DEL01", "Delhi", "9811334455", "delhisofttoys@gmail.com", "07AABCD9012H1Z9")
        ]
        vendor_objs = []
        for name, vcode, city, phone, email, gstin in vendors_data:
            v = db.query(Vendor).filter(Vendor.name == name).first()
            if not v:
                v = Vendor(
                    vendor_code=vcode,
                    name=name,
                    company_name=name,
                    phone=phone,
                    email=email,
                    city=city,
                    gstin=gstin,
                    outstanding_due=0.0
                )
                db.add(v)
                db.flush()
            vendor_objs.append(v)

        # 3. Seed Products
        products_data = [
            # Toys
            ("Toys & Games", "Remote Control Off-Road Monster Truck", "890100100001", "TOY-RC-01", 650.0, 1199.0, 1299.0, 18, 3, 1, "#3B82F6", 1),
            ("Toys & Games", "Hot Wheels 5-Car Gift Pack", "890100100002", "TOY-HW-05", 380.0, 599.0, 649.0, 24, 4, 2, "#EF4444", 0),
            ("Toys & Games", "Barbie Fashionista Doll with Extra Dress", "890100100003", "TOY-BB-01", 420.0, 749.0, 799.0, 14, 3, 3, "#EC4899", 0),
            ("Toys & Games", "Lego Classic Creative Bricks Box (300 Pcs)", "890100100004", "TOY-LG-01", 850.0, 1499.0, 1599.0, 8, 3, 4, "#F59E0B", 0),
            ("Toys & Games", "Dancing Cactus Talking & Singing Plush Toy", "890100100005", "TOY-DC-01", 220.0, 449.0, 499.0, 20, 4, 5, "#10B981", 1),
            ("Toys & Games", "Magnetic Educational Tiles 48 Pcs Set", "890100100006", "TOY-MG-01", 550.0, 999.0, 1099.0, 12, 3, 6, "#6366F1", 0),
            ("Toys & Games", "Light & Sound Automatic Bubble Machine Gun", "890100100007", "TOY-BG-01", 180.0, 349.0, 399.0, 2, 5, 7, "#8B5CF6", 2), # low stock + 2 damaged
            ("Toys & Games", "Die-Cast Metal Thar Open Roof Jeep Pullback", "890100100008", "TOY-DC-THAR", 260.0, 499.0, 549.0, 22, 4, 8, "#14B8A6", 0),

            # Boys Wear
            ("Boys Wear", "Boys Marvel Avengers Graphic Cotton T-Shirt", "890100100009", "BOY-TSH-01", 190.0, 399.0, 449.0, 28, 5, None, None, 0),
            ("Boys Wear", "Boys Slim Fit Stretch Denim Jeans (Blue)", "890100100010", "BOY-JNS-01", 380.0, 699.0, 799.0, 19, 4, None, None, 0),
            ("Boys Wear", "Boys 3-Piece Festive Party Wear Suit & Tie", "890100100011", "BOY-SUT-01", 750.0, 1399.0, 1599.0, 10, 3, None, None, 0),
            ("Boys Wear", "Boys 100% Cotton Casual Shorts (Pack of 2)", "890100100012", "BOY-SHT-02", 210.0, 449.0, 499.0, 16, 4, None, None, 0),

            # Girls Wear
            ("Girls Wear", "Girls Floral Net Princess Flared Party Frock", "890100100013", "GIRL-FRK-01", 450.0, 899.0, 999.0, 15, 3, None, None, 0),
            ("Girls Wear", "Girls Unicorn Embroidered Rainbow Summer Dress", "890100100014", "GIRL-DRS-01", 320.0, 599.0, 649.0, 18, 4, None, None, 0),
            ("Girls Wear", "Girls Traditional Georgette Lehenga Choli Set", "890100100015", "GIRL-LHG-01", 850.0, 1699.0, 1899.0, 7, 2, None, None, 0),
            ("Girls Wear", "Girls Bio-Washed Stretchable Leggings Combo", "890100100016", "GIRL-LEG-02", 160.0, 349.0, 399.0, 30, 5, None, None, 0),

            # Infants & Babies
            ("Infants & Babies", "Newborn 100% Soft Cotton Romper Suit (3-6M)", "890100100017", "INF-RMP-01", 170.0, 349.0, 399.0, 25, 4, None, None, 0),
            ("Infants & Babies", "Baby Teether & Sound Rattles Gift Box (7 Pcs)", "890100100018", "INF-RAT-01", 240.0, 499.0, 549.0, 16, 3, None, None, 0),
            ("Infants & Babies", "Super Soft Flannel Hooded Baby Swaddle Blanket", "890100100019", "INF-SWD-01", 220.0, 450.0, 499.0, 14, 3, None, None, 0),

            # Kids Footwear
            ("Kids Footwear", "Kids Breathable Mesh LED Light Sneakers", "890100100020", "FTW-LED-01", 390.0, 749.0, 799.0, 12, 3, None, None, 0),
            ("Kids Footwear", "Kids Waterproof Cartoon Printed Clogs (Crocs)", "890100100021", "FTW-CLG-01", 160.0, 349.0, 399.0, 25, 4, None, None, 0),
            ("Kids Footwear", "Boys & Girls Anti-Skid Velcro Daily Sandals", "890100100022", "FTW-SND-01", 250.0, 499.0, 549.0, 15, 3, None, None, 0),

            # Accessories
            ("Accessories", "Kids 3D Waterproof Cartoon Character School Bag", "890100100023", "ACC-BAG-01", 420.0, 799.0, 899.0, 10, 3, None, None, 0),
            ("Accessories", "Stainless Steel Double-Wall Kids Sipper Bottle", "890100100024", "ACC-BTL-01", 260.0, 499.0, 549.0, 20, 4, None, None, 0),
            ("Accessories", "Kids UV400 Polarized Flexible Frame Sunglasses", "890100100025", "ACC-GLS-01", 110.0, 249.0, 299.0, 30, 5, None, None, 0)
        ]

        product_objs = []
        for cat_name, name, bcode, sku, p_price, s_price, mrp, stock, min_alert, spd_code, spd_col, dmg_qty in products_data:
            prod = db.query(Product).filter(Product.barcode == bcode).first()
            cat = cat_map.get(cat_name) or db.query(Category).first()
            margin = round(((s_price - p_price) / s_price * 100), 1) if s_price > 0 else 0.0

            if not prod:
                prod = Product(
                    barcode=bcode,
                    sku=sku,
                    name=name,
                    category_id=cat.id if cat else None,
                    brand="Dolly Signature" if "Boys" in name or "Girls" in name else "FunTime Toys",
                    purchase_price=p_price,
                    selling_price=s_price,
                    mrp=mrp,
                    gst_percent=0.0,
                    margin_percent=margin,
                    stock_quantity=stock,
                    damaged_quantity=dmg_qty,
                    min_stock_alert=min_alert,
                    is_speed_dial=spd_code is not None,
                    speed_dial_code=str(spd_code) if spd_code else None,
                    speed_dial_color=spd_col,
                    is_active=True
                )
                db.add(prod)
                db.flush()
            else:
                prod.name = name
                prod.purchase_price = p_price
                prod.selling_price = s_price
                prod.mrp = mrp
                prod.stock_quantity = stock
                prod.damaged_quantity = dmg_qty
                prod.is_active = True
                if spd_code:
                    prod.is_speed_dial = True
                    prod.speed_dial_code = str(spd_code)
                    prod.speed_dial_color = spd_col

            product_objs.append(prod)

        db.commit()
        print(f"[OK] Seeded {len(product_objs)} catalog products.")

        # 4. Seed Customers & Khata Balances
        customers_data = [
            ("Rajesh Sharma", "9823145678", 1450.0, 8500.0, 7),
            ("Pooja Patel", "9890123456", 2800.0, 14200.0, 12),
            ("Amit Deshmukh", "9422789012", 850.0, 4600.0, 4),
            ("Sneha Joshi", "9765432109", 0.0, 6800.0, 5),
            ("Vikram Verma", "9822011223", 3200.0, 19500.0, 15),
            ("Meena Agrawal", "9921567890", 650.0, 3100.0, 3),
            ("Sachin Patil", "9403124567", 0.0, 5400.0, 4),
            ("Anita Kulkarni", "9890987654", 1200.0, 9200.0, 8)
        ]

        customer_objs = []
        for name, phone, bal, spend, visits in customers_data:
            c = db.query(Customer).filter(Customer.phone == phone).first()
            if not c:
                c = Customer(
                    name=name,
                    phone=phone,
                    city="Dhule",
                    credit_balance=bal,
                    total_spend=spend,
                    visit_count=visits,
                    is_active=True
                )
                db.add(c)
                db.flush()

                # Add ledger entry for customers with credit balance
                if bal > 0:
                    l_entry = CustomerLedger(
                        customer_id=c.id,
                        entry_type=CustomerLedgerType.BILL_CREDIT,
                        reference_no="INIT-KHATA",
                        debit_amount=0.0,
                        credit_amount=bal,
                        balance_after=bal,
                        payment_mode="CREDIT_KHATA",
                        notes="Opening Khata pending balance",
                        created_at=datetime.utcnow() - timedelta(days=2)
                    )
                    db.add(l_entry)
            else:
                c.credit_balance = bal
                c.total_spend = spend
                c.visit_count = visits
            customer_objs.append(c)

        db.commit()
        print(f"[OK] Seeded {len(customer_objs)} customers with Khata dues.")

        # 5. Seed Invoices (Sales History across Today, Yesterday, This Week, Past Month)
        admin_user = db.query(User).filter(User.username == "admin").first()
        admin_id = admin_user.id if admin_user else 1

        now_utc = datetime.utcnow()
        now_ist = now_utc + IST_OFFSET

        # Bill template list
        bills_to_create = []

        # (A) 12 Bills TODAY (spread between 10:00 AM and 5:30 PM IST)
        today_hours = [10, 11, 11, 12, 12, 13, 14, 15, 15, 16, 17, 17]
        for idx, h in enumerate(today_hours):
            dt_ist = now_ist.replace(hour=h, minute=random.randint(5, 55), second=random.randint(10, 50))
            bills_to_create.append((dt_ist - IST_OFFSET, f"BILL-TD-{100 + idx}"))

        # (B) 8 Bills YESTERDAY
        yest_ist = now_ist - timedelta(days=1)
        for idx, h in enumerate([11, 12, 13, 14, 16, 17, 18, 19]):
            dt_ist = yest_ist.replace(hour=h, minute=random.randint(5, 55))
            bills_to_create.append((dt_ist - IST_OFFSET, f"BILL-YT-{200 + idx}"))

        # (C) 12 Bills THIS WEEK
        for i in range(2, 6):
            day_ist = now_ist - timedelta(days=i)
            for j, h in enumerate([11, 14, 17]):
                dt_ist = day_ist.replace(hour=h, minute=random.randint(10, 50))
                bills_to_create.append((dt_ist - IST_OFFSET, f"BILL-W{i}-{300 + j}"))

        # (D) 8 Bills EARLIER THIS MONTH & LAST MONTH
        for i in [10, 15, 20, 25]:
            day_ist = now_ist - timedelta(days=i)
            for j, h in enumerate([12, 16]):
                dt_ist = day_ist.replace(hour=h, minute=random.randint(10, 50))
                bills_to_create.append((dt_ist - IST_OFFSET, f"BILL-M{i}-{400 + j}"))

        pay_modes = [PaymentMode.CASH, PaymentMode.UPI, PaymentMode.UPI, PaymentMode.CASH, PaymentMode.CARD, PaymentMode.CREDIT_KHATA]

        invoice_created_count = 0
        for bill_time_utc, b_num in bills_to_create:
            existing = db.query(Invoice).filter(Invoice.bill_number == b_num).first()
            if existing:
                continue

            cust = random.choice(customer_objs) if random.random() > 0.3 else None
            pmode = random.choice(pay_modes)

            # Pick 1 to 3 items
            selected_prods = random.sample(product_objs, k=random.randint(1, 3))
            subtot = 0.0
            total_cost = 0.0
            item_objs = []

            for sp in selected_prods:
                qty = random.randint(1, 2)
                item_tot = sp.selling_price * qty
                subtot += item_tot
                total_cost += sp.purchase_price * qty

                item_objs.append(InvoiceItem(
                    product_id=sp.id,
                    item_name=sp.name,
                    barcode=sp.barcode,
                    sku=sp.sku,
                    quantity=qty,
                    unit_price=sp.selling_price,
                    cost_price=sp.purchase_price,
                    discount_amount=0.0,
                    tax_percent=0.0,
                    tax_amount=0.0,
                    total_price=item_tot,
                    is_unlisted=False
                ))

            disc = 50.0 if subtot > 1500 and random.random() > 0.5 else 0.0
            g_total = subtot - disc

            inv = Invoice(
                bill_number=b_num,
                customer_id=cust.id if cust else None,
                cashier_id=admin_id,
                subtotal=subtot,
                discount_amount=disc,
                discount_type="FLAT",
                tax_amount=0.0,
                extra_charges_amount=0.0,
                round_off=0.0,
                grand_total=g_total,
                paid_amount=g_total if pmode != PaymentMode.CREDIT_KHATA else 0.0,
                change_amount=0.0,
                due_amount=0.0 if pmode != PaymentMode.CREDIT_KHATA else g_total,
                payment_mode=pmode,
                payment_status=PaymentStatus.PAID if pmode != PaymentMode.CREDIT_KHATA else PaymentStatus.CREDIT,
                customer_name=cust.name if cust else "Walk-in Customer",
                customer_phone=cust.phone if cust else None,
                created_at=bill_time_utc
            )
            db.add(inv)
            db.flush()

            for itm in item_objs:
                itm.invoice_id = inv.id
                db.add(itm)

            # Add payment record
            if pmode != PaymentMode.CREDIT_KHATA:
                pmt = Payment(
                    invoice_id=inv.id,
                    payment_mode=pmode,
                    amount=g_total,
                    transaction_ref=f"TXN-{random.randint(100000, 999999)}" if pmode in [PaymentMode.UPI, PaymentMode.CARD] else None,
                    created_at=bill_time_utc
                )
                db.add(pmt)

            invoice_created_count += 1

        db.commit()
        print(f"[OK] Created {invoice_created_count} new bills across various dates and hours.")

        # 6. Seed Expenses
        expenses_data = [
            (ExpenseCategory.FOOD, "Morning Tea & Breakfast for Staff", 120.0, "CASH", "Chai Corner", 0),
            (ExpenseCategory.MISCELLANEOUS, "Packing Tape & Dolly Carry Bags Roll", 650.0, "UPI", "City Packaging Hub", 0),
            (ExpenseCategory.MISCELLANEOUS, "Shop Cleaning, Sanitizer & Mop", 350.0, "CASH", "Pooja Cleaning Store", 1),
            (ExpenseCategory.ELECTRICITY, "MSEDCL Electricity Bill - Dhule Store", 4200.0, "UPI", "MSEDCL Online", 3),
            (ExpenseCategory.FOOD, "Staff Lunch & Tiffin (Weekly)", 1500.0, "CASH", "Annapurna Caterers", 4),
            (ExpenseCategory.REPAIRS, "Air Conditioner Service & Gas Refill", 1800.0, "CASH", "Cool Care AC Services", 12),
            (ExpenseCategory.MARKETING, "Instagram Ads & Local Festival Banners", 2500.0, "UPI", "Digital Reach Agency", 18)
        ]

        exp_count = 0
        for cat, title, amt, pmode, paid_to, days_ago in expenses_data:
            e_date = now_utc - timedelta(days=days_ago)
            exp = db.query(Expense).filter(Expense.title == title).first()
            if not exp:
                exp = Expense(
                    category=cat,
                    title=title,
                    amount=amt,
                    payment_mode=pmode,
                    paid_to=paid_to,
                    notes=f"Authorized shop expense ({title})",
                    expense_date=e_date,
                    logged_by=admin_id,
                    created_at=e_date
                )
                db.add(exp)
                exp_count += 1

        db.commit()
        print(f"[OK] Added {exp_count} realistic shop expenses.")

        # 7. Seed Lost Demands & Procurement Notes
        demands_data = [
            ("Hot Wheels Monster Trucks 1:24 Scale Mega Wrex", "Toys & Games", "Standard", "Green", "Ramesh Joshi", "9822123456", 3, LostDemandUrgency.URGENT),
            ("Frozen Elsa Princess Musical Gown with Light", "Girls Wear", "Size 30", "Sky Blue", "Sunita Shinde", "9890456789", 2, LostDemandUrgency.HIGH),
            ("Beyblade Burst Turbo Battle Arena Set", "Toys & Games", "Standard", "Red", "Vijay Sonawane", "9422345678", 2, LostDemandUrgency.NORMAL),
            ("Kids Rechargeable 12V Battery Jeep", "Toys & Games", "Large", "Red", "Dr. Manoj Patil", "9823987654", 1, LostDemandUrgency.HIGH)
        ]

        dem_count = 0
        for item, c_name, sz, col, c_name_str, c_ph, req_c, urg in demands_data:
            existing = db.query(LostDemand).filter(LostDemand.item_description == item).first()
            if not existing:
                ld = LostDemand(
                    item_description=item,
                    category_name=c_name,
                    preferred_size=sz,
                    preferred_color=col,
                    customer_name=c_name_str,
                    customer_phone=c_ph,
                    request_count=req_c,
                    urgency=urg,
                    status=LostDemandStatus.PENDING_PROCUREMENT,
                    notes="Customer specifically requested this item on walk-in",
                    created_at=now_utc - timedelta(hours=random.randint(2, 48))
                )
                db.add(ld)
                dem_count += 1

        notes_data = [
            ("Marvel & DC Action Figures Collection", 24, "Reorder 6-inch superhero figures from Mumbai vendor", "Marvel Toy Distributors", 280.0, "HIGH", "PENDING"),
            ("Waterproof School Backpacks with Cartoon prints", 50, "Stock up for back-to-school demand", "Delhi Soft Toys Wholesalers", 320.0, "NORMAL", "PENDING"),
            ("Winter Kids Thermal Inners (Boys & Girls)", 40, "Upcoming winter wear collection sizes 22-32", "Surat Kids Garments Hub", 180.0, "HIGH", "ORDERED")
        ]

        note_count = 0
        for item, qty, desc, v_name, est_pr, prio, stat in notes_data:
            existing = db.query(ProcurementNote).filter(ProcurementNote.item_name == item).first()
            if not existing:
                pn = ProcurementNote(
                    item_name=item,
                    quantity=qty,
                    description=desc,
                    vendor_name=v_name,
                    estimated_price=est_pr,
                    priority=prio,
                    status=stat,
                    created_at=now_utc - timedelta(hours=random.randint(5, 72))
                )
                db.add(pn)
                note_count += 1

        db.commit()
        print(f"[OK] Added {dem_count} Lost Demands and {note_count} Procurement Notes.")

        print("=" * 60)
        print("  DEMO DATA GENERATION COMPLETE!")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_demo_data()
