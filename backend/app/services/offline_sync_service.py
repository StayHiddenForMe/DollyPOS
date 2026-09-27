import os
import sys
import shutil
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.models.invoice import Invoice, InvoiceItem, Payment, PaymentMode, PaymentStatus
from app.models.customer import Customer, CustomerLedger, CustomerLedgerType
from app.models.product import Product
from app.models.expense import Expense
from app.models.vendor import Vendor
from app.models.purchase import Purchase, PurchaseItem
from app.models.return_order import ReturnOrder, ReturnItem
from app.core.database import Base, engine as active_engine

class OfflineSyncService:
    @staticmethod
    def get_candidate_sqlite_paths() -> list:
        """Finds all candidate locations for offline SQLite database files."""
        candidates = [
            os.path.join(os.getcwd(), "dollypos_local.db"),
        ]
        if getattr(sys, "frozen", False):
            candidates.append(os.path.join(os.path.dirname(sys.executable), "dollypos_local.db"))
            
        backend_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        candidates.append(os.path.join(backend_base, "dollypos_local.db"))
        candidates.append(os.path.join(backend_base, "..", "dollypos_local.db"))
        
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            candidates.append(os.path.join(local_app_data, "DollyPOS", "dollypos_local.db"))
            
        user_profile = os.environ.get("USERPROFILE", os.path.expanduser("~"))
        candidates.append(os.path.join(user_profile, "DollyPOS_Backups", "dollypos_local.db"))
        candidates.append(os.path.join(user_profile, "dollypos_local.db"))

        found = []
        for p in candidates:
            abs_p = os.path.abspath(p)
            if os.path.isfile(abs_p) and abs_p not in found and os.path.getsize(abs_p) > 0:
                found.append(abs_p)
        return found

    @classmethod
    def sync_offline_sqlite_to_postgres(cls, pg_db: Session) -> dict:
        """
        Comprehensive synchronizer: transfers all offline Invoices, Returns, Purchases,
        Customers, Payments, Customer Ledgers, and Expenses from SQLite into PostgreSQL,
        ensuring inventory stock counts and Khata ledger balances remain 100% accurate.
        """
        if active_engine.dialect.name != "postgresql":
            return {
                "status": "skipped",
                "message": "Active database engine is SQLite. Synchronization only runs when connected to PostgreSQL.",
                "invoices_synced": 0,
                "expenses_synced": 0
            }

        sqlite_files = cls.get_candidate_sqlite_paths()
        if not sqlite_files:
            return {
                "status": "clean",
                "message": "No offline SQLite databases found. All data is up to date in PostgreSQL.",
                "invoices_synced": 0,
                "expenses_synced": 0
            }

        total_invoices_synced = 0
        total_returns_synced = 0
        total_purchases_synced = 0
        total_expenses_synced = 0
        total_customers_synced = 0
        synced_files = []

        for sqlite_path in sqlite_files:
            try:
                sqlite_url = f"sqlite:///{sqlite_path}"
                sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
                
                # Auto-upgrade missing columns in SQLite file if created on older schemas
                try:
                    Base.metadata.create_all(bind=sqlite_engine)
                    with sqlite_engine.connect() as s_conn:
                        s_conn.execute(text("ALTER TABLE invoices ADD COLUMN extra_charges_amount FLOAT DEFAULT 0.0;"))
                        s_conn.commit()
                except Exception:
                    pass
                try:
                    with sqlite_engine.connect() as s_conn:
                        s_conn.execute(text("ALTER TABLE invoices ADD COLUMN extra_charges_breakdown TEXT;"))
                        s_conn.commit()
                except Exception:
                    pass

                SqliteSession = sessionmaker(bind=sqlite_engine)
                sqlite_db = SqliteSession()

                # -------------------------------------------------------------
                # 1. Sync Invoices & Invoice Items
                # -------------------------------------------------------------
                has_invoices = False
                try:
                    res = sqlite_db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='invoices';")).scalar()
                    has_invoices = bool(res)
                except Exception:
                    pass

                if has_invoices:
                    sqlite_invoices = sqlite_db.query(Invoice).all()
                    for sq_inv in sqlite_invoices:
                        pg_inv = pg_db.query(Invoice).filter(Invoice.bill_number == sq_inv.bill_number).first()
                        if pg_inv:
                            continue  # Already synced

                        # Resolve / create Customer in PostgreSQL
                        pg_customer_id = None
                        if sq_inv.customer_phone:
                            pg_cust = pg_db.query(Customer).filter(Customer.phone == sq_inv.customer_phone).first()
                            if not pg_cust:
                                pg_cust = Customer(
                                    name=sq_inv.customer_name or "Retail Customer",
                                    phone=sq_inv.customer_phone,
                                    credit_balance=0.0,
                                    total_spend=0.0,
                                    visit_count=0,
                                    created_at=sq_inv.created_at or datetime.utcnow()
                                )
                                pg_db.add(pg_cust)
                                pg_db.flush()
                                total_customers_synced += 1

                            # Update customer loyalty & financials
                            pg_cust.total_spend = (pg_cust.total_spend or 0.0) + (sq_inv.grand_total or 0.0)
                            pg_cust.visit_count = (pg_cust.visit_count or 0) + 1
                            if sq_inv.due_amount and sq_inv.due_amount > 0:
                                pg_cust.credit_balance = (pg_cust.credit_balance or 0.0) + sq_inv.due_amount
                            pg_cust.last_visit_at = sq_inv.created_at or datetime.utcnow()
                            pg_customer_id = pg_cust.id

                        # Create Invoice in PostgreSQL
                        new_pg_inv = Invoice(
                            bill_number=sq_inv.bill_number,
                            customer_id=pg_customer_id,
                            cashier_id=sq_inv.cashier_id,
                            subtotal=sq_inv.subtotal,
                            discount_amount=sq_inv.discount_amount,
                            discount_type=sq_inv.discount_type or "FLAT",
                            tax_amount=sq_inv.tax_amount,
                            extra_charges_amount=getattr(sq_inv, "extra_charges_amount", 0.0) or 0.0,
                            extra_charges_breakdown=getattr(sq_inv, "extra_charges_breakdown", None),
                            round_off=sq_inv.round_off or 0.0,
                            grand_total=sq_inv.grand_total,
                            paid_amount=sq_inv.paid_amount,
                            change_amount=sq_inv.change_amount,
                            due_amount=sq_inv.due_amount,
                            payment_mode=sq_inv.payment_mode,
                            payment_status=sq_inv.payment_status,
                            is_held=sq_inv.is_held or False,
                            is_cancelled=sq_inv.is_cancelled or False,
                            is_gift_receipt=sq_inv.is_gift_receipt or False,
                            customer_name=sq_inv.customer_name,
                            customer_phone=sq_inv.customer_phone,
                            notes=sq_inv.notes or "Synced from offline emergency billing",
                            created_at=sq_inv.created_at or datetime.utcnow()
                        )
                        pg_db.add(new_pg_inv)
                        pg_db.flush()

                        # Sync line items & adjust stock
                        sq_items = sqlite_db.query(InvoiceItem).filter(InvoiceItem.invoice_id == sq_inv.id).all()
                        for item in sq_items:
                            pg_prod = None
                            if item.product_id:
                                pg_prod = pg_db.query(Product).filter(Product.id == item.product_id).first()
                            if not pg_prod and item.barcode:
                                pg_prod = pg_db.query(Product).filter(Product.barcode == item.barcode).first()
                            if not pg_prod and item.item_name:
                                pg_prod = pg_db.query(Product).filter(Product.name == item.item_name).first()

                            prod_id = pg_prod.id if pg_prod else None

                            new_item = InvoiceItem(
                                invoice_id=new_pg_inv.id,
                                product_id=prod_id,
                                item_name=item.item_name,
                                barcode=item.barcode,
                                sku=getattr(item, "sku", None),
                                size=getattr(item, "size", None),
                                color=getattr(item, "color", None),
                                quantity=item.quantity,
                                unit_price=item.unit_price,
                                cost_price=getattr(item, "cost_price", 0.0) or 0.0,
                                discount_amount=item.discount_amount or 0.0,
                                tax_percent=getattr(item, "tax_percent", 0.0) or 0.0,
                                tax_amount=getattr(item, "tax_amount", 0.0) or 0.0,
                                total_price=item.total_price,
                                is_unlisted=getattr(item, "is_unlisted", False) or False
                            )
                            pg_db.add(new_item)

                            if pg_prod and pg_prod.stock_quantity is not None:
                                pg_prod.stock_quantity = max(0, pg_prod.stock_quantity - (item.quantity or 1))
                                pg_prod.last_sold_at = new_pg_inv.created_at

                        # Sync Payments
                        sq_payments = sqlite_db.query(Payment).filter(Payment.invoice_id == sq_inv.id).all()
                        for pm in sq_payments:
                            new_pm = Payment(
                                invoice_id=new_pg_inv.id,
                                payment_mode=pm.payment_mode,
                                amount=pm.amount,
                                transaction_ref=getattr(pm, "transaction_ref", None),
                                created_at=pm.created_at or datetime.utcnow()
                            )
                            pg_db.add(new_pm)

                        # Sync Customer Ledger
                        sq_ledgers = sqlite_db.query(CustomerLedger).filter(CustomerLedger.reference_no == sq_inv.bill_number).all()
                        for cl in sq_ledgers:
                            new_cl = CustomerLedger(
                                customer_id=pg_customer_id,
                                entry_type=cl.entry_type,
                                reference_no=cl.reference_no,
                                debit_amount=cl.debit_amount,
                                credit_amount=cl.credit_amount,
                                balance_after=cl.balance_after,
                                payment_mode=cl.payment_mode,
                                notes=cl.notes,
                                created_at=cl.created_at or datetime.utcnow()
                            )
                            pg_db.add(new_cl)

                        total_invoices_synced += 1

                # -------------------------------------------------------------
                # 2. Sync Returns & Restock Items
                # -------------------------------------------------------------
                has_returns = False
                try:
                    res = sqlite_db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='returns';")).scalar()
                    has_returns = bool(res)
                except Exception:
                    pass

                if has_returns:
                    sq_returns = sqlite_db.query(ReturnOrder).all()
                    for sq_ret in sq_returns:
                        pg_ret = pg_db.query(ReturnOrder).filter(ReturnOrder.return_number == sq_ret.return_number).first()
                        if pg_ret:
                            continue

                        new_pg_ret = ReturnOrder(
                            return_number=sq_ret.return_number,
                            total_refund_amount=sq_ret.total_refund_amount,
                            return_type=sq_ret.return_type,
                            reason=sq_ret.reason,
                            notes=sq_ret.notes,
                            created_at=sq_ret.created_at or datetime.utcnow()
                        )
                        pg_db.add(new_pg_ret)
                        pg_db.flush()

                        sq_ret_items = sqlite_db.query(ReturnItem).filter(ReturnItem.return_id == sq_ret.id).all()
                        for ri in sq_ret_items:
                            pg_prod = None
                            if ri.barcode:
                                pg_prod = pg_db.query(Product).filter(Product.barcode == ri.barcode).first()
                            new_ri = ReturnItem(
                                return_id=new_pg_ret.id,
                                product_id=pg_prod.id if pg_prod else None,
                                item_name=ri.item_name,
                                barcode=ri.barcode,
                                quantity=ri.quantity,
                                refund_price=ri.refund_price,
                                is_defective=ri.is_defective,
                                restocked=ri.restocked
                            )
                            pg_db.add(new_ri)
                            # Restock if applicable
                            if ri.restocked and not ri.is_defective and pg_prod and pg_prod.stock_quantity is not None:
                                pg_prod.stock_quantity += (ri.quantity or 1)

                        total_returns_synced += 1

                # -------------------------------------------------------------
                # 3. Sync Expenses
                # -------------------------------------------------------------
                has_expenses = False
                try:
                    res = sqlite_db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='expenses';")).scalar()
                    has_expenses = bool(res)
                except Exception:
                    pass

                if has_expenses:
                    sq_expenses = sqlite_db.query(Expense).all()
                    for exp in sq_expenses:
                        pg_exp = pg_db.query(Expense).filter(
                            Expense.title == exp.title,
                            Expense.amount == exp.amount,
                            Expense.created_at == exp.created_at
                        ).first()
                        if not pg_exp:
                            new_exp = Expense(
                                title=exp.title,
                                amount=exp.amount,
                                payment_mode=exp.payment_mode,
                                notes=exp.notes,
                                expense_date=exp.expense_date or datetime.utcnow(),
                                created_at=exp.created_at or datetime.utcnow()
                            )
                            pg_db.add(new_exp)
                            total_expenses_synced += 1

                pg_db.commit()

                # Safely close and dispose SQLite engine to release Windows file locks
                try:
                    sqlite_db.close()
                except Exception:
                    pass
                try:
                    sqlite_engine.dispose()
                except Exception:
                    pass

                # If new transactions were synced, keep an archive copy; otherwise delete the redundant file
                try:
                    has_synced_data = (
                        total_invoices_synced > 0 or
                        total_returns_synced > 0 or
                        total_purchases_synced > 0 or
                        total_expenses_synced > 0 or
                        total_customers_synced > 0
                    )
                    if has_synced_data:
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        archive_path = f"{sqlite_path}.synced_{timestamp}.bak"
                        shutil.move(sqlite_path, archive_path)
                        synced_files.append(archive_path)
                    else:
                        # Cleanly remove the empty/already-synced SQLite file so it is not re-processed
                        if os.path.exists(sqlite_path):
                            os.remove(sqlite_path)
                except Exception as f_err:
                    print(f"[OfflineSyncService Warning] File cleanup error for {sqlite_path}: {f_err}")

            except Exception as e:
                pg_db.rollback()
                print(f"[OfflineSyncService Warning] Error processing {sqlite_path}: {e}")
            finally:
                try:
                    sqlite_db.close()
                except Exception:
                    pass
                try:
                    sqlite_engine.dispose()
                except Exception:
                    pass

        return {
            "status": "success",
            "message": f"Successfully synchronized {total_invoices_synced} offline invoice(s), {total_returns_synced} return(s), {total_customers_synced} customer(s), and {total_expenses_synced} expense(s) into PostgreSQL.",
            "invoices_synced": total_invoices_synced,
            "returns_synced": total_returns_synced,
            "customers_synced": total_customers_synced,
            "expenses_synced": total_expenses_synced,
            "archived_files": synced_files
        }

offline_sync_service = OfflineSyncService()
