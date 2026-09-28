import os
import sys
import time
import random
from datetime import datetime, date, timedelta
import psycopg2
from psycopg2.extras import execute_values

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from app.core.database import engine

def get_raw_connection():
    return engine.raw_connection()

def generate_bulk_data():
    start_total_time = time.time()
    print("=" * 65)
    print("  DOLLY POS: ENTERPRISE SCALE DATA GENERATOR")
    print("  Target: 20,000+ Products | 500+ Customers | 100,000+ Bills (10 Years)")
    print("=" * 65)

    conn = get_raw_connection()
    cur = conn.cursor()

    try:
        # Check Admin User ID
        cur.execute("SELECT id FROM users WHERE username = 'admin' LIMIT 1;")
        admin_row = cur.fetchone()
        admin_id = admin_row[0] if admin_row else 1

        # Check Categories
        cur.execute("SELECT id, name FROM categories ORDER BY id;")
        cat_rows = cur.fetchall()
        if not cat_rows:
            print("No categories found. Please start app once to bootstrap categories.")
            return

        cat_ids = [r[0] for r in cat_rows]
        print(f"[*] Found {len(cat_ids)} product categories.")

        # =========================================================
        # 1. BULK INSERT 520 CUSTOMERS
        # =========================================================
        print("\n[*] 1/3: Generating 520 Customers...")
        first_names = [
            "Ramesh", "Suresh", "Rajesh", "Amit", "Pooja", "Sneha", "Neha", "Priya",
            "Sunita", "Rahul", "Rohit", "Sachin", "Vikram", "Deepa", "Meena", "Kavita",
            "Anil", "Sanjay", "Mahesh", "Ganesh", "Vijay", "Anita", "Sunil", "Rakesh",
            "Manoj", "Kiran", "Ashok", "Prakash", "Santosh", "Dinesh", "Nilesh", "Alok",
            "Preeti", "Swati", "Sheetal", "Shilpa", "Rekha", "Sangeeta", "Jyoti", "Aarti"
        ]
        last_names = [
            "Sharma", "Patel", "Deshmukh", "Patil", "Joshi", "Verma", "Agrawal", "Kulkarni",
            "Gupta", "Singh", "Mehta", "Shah", "Chavan", "Jadhav", "More", "Pawar",
            "Shinde", "Bhosale", "Kadam", "Gaikwad", "Sonawane", "Mahajan", "Wagh", "Borse"
        ]

        customer_tuples = []
        cust_phone_base = 9820000000
        for i in range(1, 521):
            fn = random.choice(first_names)
            ln = random.choice(last_names)
            c_name = f"{fn} {ln}"
            c_phone = str(cust_phone_base + i)
            # ~30% have credit balance
            has_credit = random.random() < 0.3
            c_bal = round(random.uniform(200.0, 4800.0), 2) if has_credit else 0.0
            c_spend = round(random.uniform(1500.0, 65000.0), 2)
            c_visits = random.randint(2, 35)

            customer_tuples.append((
                c_name, c_phone, "Dhule", c_bal, c_spend, c_visits, True, datetime.utcnow()
            ))

        cust_insert_sql = """
            INSERT INTO customers (name, phone, city, credit_balance, total_spend, visit_count, is_active, created_at)
            VALUES %s
            ON CONFLICT (phone) DO UPDATE 
            SET credit_balance = EXCLUDED.credit_balance,
                total_spend = EXCLUDED.total_spend,
                visit_count = EXCLUDED.visit_count
            RETURNING id;
        """
        execute_values(cur, cust_insert_sql, customer_tuples)
        conn.commit()

        cur.execute("SELECT id FROM customers ORDER BY id;")
        all_cust_ids = [r[0] for r in cur.fetchall()]
        print(f"[OK] 520 Customers ready in database (Total IDs: {len(all_cust_ids)}).")

        # =========================================================
        # 2. BULK INSERT 20,500 PRODUCTS
        # =========================================================
        print("\n[*] 2/3: Generating 20,500 Products across Toy & Apparel Catalog...")
        cur.execute("SELECT count(*) FROM products;")
        existing_prod_count = cur.fetchone()[0]

        prod_brands = [
            "FunTime", "Marvel Kids", "Disney Magic", "Barbie Signature", "Dolly Signature",
            "TinyToes", "LittleStar", "TurboWheels", "WonderKids", "Speedster", "RoyalKids",
            "Sparkle Baby", "PlayMaster", "SmartKids", "ActionHero", "CuteCuddles"
        ]
        prod_types = [
            "T-Shirt", "Denim Jeans", "Princess Frock", "LED Running Shoes", "Board Game",
            "3D Puzzle Set", "Fashion Doll", "RC Off-Road Car", "Creative Bricks Box",
            "Cotton Romper", "Insulated Sipper Bottle", "Waterproof School Bag", "Summer Shorts",
            "Party Lehenga Choli", "Flared Gown", "Cartoon Clogs", "Daily Sandals",
            "Winter Hooded Jacket", "Track Pants", "Night Suit", "Dungaree Set",
            "Action Figure", "Battery Operated Train", "Light & Sound Gun", "Die-Cast Jeep"
        ]
        prod_colors = ["Red", "Navy Blue", "Sky Blue", "Pink", "Yellow", "Emerald Green", "Black", "White", "Multi Color", "Grey"]
        prod_sizes = ["20", "22", "24", "26", "28", "30", "32", "0-6M", "6-12M", "1-2Y", "2-4Y", "4-6Y", "Standard"]

        products_to_add = 20500 - existing_prod_count
        if products_to_add > 0:
            print(f"    Inserting {products_to_add} products in batches of 5,000...")
            barcode_base = 890200000000 + existing_prod_count

            batch_size = 5000
            for b_idx in range(0, products_to_add, batch_size):
                chunk_len = min(batch_size, products_to_add - b_idx)
                product_tuples = []

                for j in range(chunk_len):
                    curr_idx = b_idx + j + 1
                    bcode = str(barcode_base + curr_idx)
                    sku = f"SKU-{bcode[-8:]}"
                    brand = random.choice(prod_brands)
                    ptype = random.choice(prod_types)
                    col = random.choice(prod_colors)
                    sz = random.choice(prod_sizes)
                    p_name = f"{brand} {ptype} ({col}, {sz})"

                    c_id = random.choice(cat_ids)
                    p_price = round(random.uniform(80.0, 750.0), 2)
                    margin_pct = round(random.uniform(35.0, 55.0), 1)
                    s_price = round(p_price * (1.0 + margin_pct / 100.0), 2)
                    mrp = round(s_price * round(random.uniform(1.10, 1.30), 2), 2)

                    stock = random.randint(4, 65)
                    # 1% have low stock (0 to 2)
                    if random.random() < 0.015:
                        stock = random.randint(0, 2)

                    # 0.5% have damaged stock
                    dmg = random.randint(1, 4) if random.random() < 0.005 else 0

                    product_tuples.append((
                        bcode, sku, p_name, c_id, brand, sz, col,
                        p_price, s_price, mrp, 0.0, margin_pct, stock, 3, dmg,
                        False, None, None, True, datetime.utcnow(), datetime.utcnow()
                    ))

                prod_insert_sql = """
                    INSERT INTO products (
                        barcode, sku, name, category_id, brand, size, color,
                        purchase_price, selling_price, mrp, gst_percent, margin_percent,
                        stock_quantity, min_stock_alert, damaged_quantity,
                        is_speed_dial, speed_dial_code, speed_dial_color, is_active,
                        created_at, updated_at
                    ) VALUES %s
                    ON CONFLICT (barcode) DO NOTHING;
                """
                execute_values(cur, prod_insert_sql, product_tuples)
                conn.commit()
                print(f"    -> Product Batch {b_idx // batch_size + 1}: {chunk_len} products inserted.")

        cur.execute("SELECT count(*) FROM products;")
        total_prods_now = cur.fetchone()[0]
        print(f"[OK] Catalog ready: {total_prods_now} total active products in database!")

        # Fetch sample product pool (IDs, selling_price, purchase_price, name, barcode, sku)
        cur.execute("SELECT id, name, barcode, sku, selling_price, purchase_price FROM products LIMIT 5000;")
        product_pool = cur.fetchall()
        print(f"[*] Cached {len(product_pool)} products for lightning-fast invoice generation.")

        # =========================================================
        # 3. BULK INSERT 100,000 INVOICES ACROSS 10 YEARS (2016-2026)
        # =========================================================
        cur.execute("SELECT count(*) FROM invoices;")
        existing_inv_count = cur.fetchone()[0]
        target_invoices = 100000
        invoices_to_create = max(0, target_invoices - existing_inv_count)

        print(f"\n[*] 3/3: Generating {invoices_to_create} Bills across 10 Years (2016 to 2026)...")

        if invoices_to_create > 0:
            start_date = datetime(2016, 1, 1, 10, 0, 0)
            end_date = datetime.utcnow()
            total_seconds = int((end_date - start_date).total_seconds())

            batch_size = 10000
            total_batches = (invoices_to_create + batch_size - 1) // batch_size

            pay_modes = ["CASH", "CASH", "CASH", "UPI", "UPI", "UPI", "CARD", "CREDIT_KHATA"]

            for b_num in range(total_batches):
                chunk_len = min(batch_size, invoices_to_create - (b_num * batch_size))
                inv_tuples = []
                inv_metadata = []

                for k in range(chunk_len):
                    global_idx = existing_inv_count + (b_num * batch_size) + k + 1
                    # Distribute across 10 years with weight towards recent 3 years
                    # quadratic weight favoring recent dates
                    r_weight = (random.random() ** 0.55)
                    random_secs = int(total_seconds * r_weight)
                    inv_dt = start_date + timedelta(seconds=random_secs)

                    # Normalize hour between 10 AM and 9 PM IST
                    inv_dt = inv_dt.replace(hour=random.randint(10, 21), minute=random.randint(0, 59), second=random.randint(0, 59))

                    b_number = f"BILL-{inv_dt.year}-{global_idx:07d}"
                    c_id = random.choice(all_cust_ids) if random.random() < 0.65 else None
                    pmode = random.choice(pay_modes)

                    # Precompute 1-2 items per bill
                    item_count = 1 if random.random() < 0.6 else 2
                    chosen_prods = [random.choice(product_pool) for _ in range(item_count)]

                    subtotal = 0.0
                    cost_total = 0.0
                    items_spec = []
                    for pr in chosen_prods:
                        # pr: (id, name, barcode, sku, selling_price, purchase_price)
                        qty = 1 if random.random() < 0.85 else 2
                        it_tot = float(pr[4]) * qty
                        subtotal += it_tot
                        cost_total += float(pr[5]) * qty
                        items_spec.append((pr[0], pr[1], pr[2], pr[3], qty, float(pr[4]), float(pr[5]), it_tot))

                    disc = 0.0
                    if subtotal > 1200.0 and random.random() < 0.35:
                        disc = round(random.choice([50.0, 100.0, 150.0, 200.0]), 2)
                    g_total = round(max(50.0, subtotal - disc), 2)

                    paid = g_total if pmode != "CREDIT_KHATA" else 0.0
                    due = 0.0 if pmode != "CREDIT_KHATA" else g_total
                    pstatus = "PAID" if pmode != "CREDIT_KHATA" else "CREDIT"

                    inv_tuples.append((
                        b_number, c_id, admin_id, subtotal, disc, "FLAT", 0.0, 0.0, 0.0, g_total,
                        paid, 0.0, due, pmode, pstatus, False, False, False,
                        "Customer" if c_id else "Walk-in Customer", None, None, inv_dt
                    ))
                    inv_metadata.append((pmode, g_total, inv_dt, items_spec))

                # Insert Invoice batch and retrieve generated IDs
                insert_inv_sql = """
                    INSERT INTO invoices (
                        bill_number, customer_id, cashier_id, subtotal, discount_amount,
                        discount_type, tax_amount, extra_charges_amount, round_off, grand_total,
                        paid_amount, change_amount, due_amount, payment_mode, payment_status,
                        is_held, is_cancelled, is_gift_receipt, customer_name, customer_phone,
                        notes, created_at
                    ) VALUES %s
                    RETURNING id;
                """
                inserted_ids = execute_values(cur, insert_inv_sql, inv_tuples, fetch=True)

                # Prepare matching invoice_items and payments
                item_tuples = []
                payment_tuples = []

                for (new_id,), (pmode, g_total, inv_dt, items_spec) in zip(inserted_ids, inv_metadata):
                    for it in items_spec:
                        # (pr_id, name, barcode, sku, qty, unit_price, cost_price, it_tot)
                        item_tuples.append((
                            new_id, it[0], it[1], it[2], it[3], None, None,
                            it[4], it[5], it[6], 0.0, 0.0, 0.0, it[7], False
                        ))

                    if pmode != "CREDIT_KHATA":
                        txn_ref = f"TXN-{random.randint(10000000, 99999999)}" if pmode in ["UPI", "CARD"] else None
                        payment_tuples.append((
                            new_id, pmode, g_total, txn_ref, inv_dt
                        ))

                # Batch insert items
                insert_items_sql = """
                    INSERT INTO invoice_items (
                        invoice_id, product_id, item_name, barcode, sku, size, color,
                        quantity, unit_price, cost_price, discount_amount, tax_percent,
                        tax_amount, total_price, is_unlisted
                    ) VALUES %s;
                """
                execute_values(cur, insert_items_sql, item_tuples)

                # Batch insert payments
                if payment_tuples:
                    insert_payments_sql = """
                        INSERT INTO payments (
                            invoice_id, payment_mode, amount, transaction_ref, created_at
                        ) VALUES %s;
                    """
                    execute_values(cur, insert_payments_sql, payment_tuples)

                conn.commit()
                elapsed = time.time() - start_total_time
                done_so_far = (b_num + 1) * batch_size
                print(f"    -> [Batch {b_num + 1}/{total_batches}] {chunk_len} bills committed! ({min(done_so_far, invoices_to_create):,}/{invoices_to_create:,} in {elapsed:.1f}s)")

        # Create Index on created_at and bill_number if not exists
        print("\n[*] Optimizing PostgreSQL Indexes for sub-millisecond query execution...")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_invoices_created_at_desc ON invoices (created_at DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_invoices_payment_mode ON invoices (payment_mode);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at DESC);")
        conn.commit()

        # Final Verification Counts
        cur.execute("SELECT count(*) FROM products;")
        final_prods = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM customers;")
        final_custs = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM invoices;")
        final_bills = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM invoice_items;")
        final_items = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM payments;")
        final_pmts = cur.fetchone()[0]
        cur.execute("SELECT min(created_at), max(created_at) FROM invoices;")
        min_date, max_date = cur.fetchone()

        total_duration = time.time() - start_total_time
        print("\n" + "=" * 65)
        print("  SCALE BENCHMARK & SEEDING COMPLETED SUCCESSFULLY!")
        print("=" * 65)
        print(f"  Total Products In Database      : {final_prods:,}")
        print(f"  Total Customers In Database     : {final_custs:,}")
        print(f"  Total Invoices In Database      : {final_bills:,}")
        print(f"  Total Invoice Items In Database : {final_items:,}")
        print(f"  Total Payments In Database      : {final_pmts:,}")
        print(f"  Date Range Spanned              : {min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}")
        print(f"  Total Execution Time            : {total_duration:.1f} seconds")
        print("=" * 65)

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Bulk seeding failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    generate_bulk_data()
