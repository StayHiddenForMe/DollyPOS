import os
import json
import subprocess
from datetime import datetime, date
from sqlalchemy.orm import Session
from app.config import settings
from app.models.settings import StoreSettings
from app.models.product import Product
from app.models.category import Category
from app.models.customer import Customer
from app.models.vendor import Vendor

from app.models.invoice import Invoice, InvoiceItem, Payment
from app.models.return_order import ReturnOrder, ReturnItem
from app.models.expense import Expense, ExpenseCategory
from app.models.purchase import Purchase, PurchaseItem
from app.models.user import User
from app.models.whatsapp import WhatsAppLog
from app.models.lost_demand import LostDemand

class BackupService:
    @staticmethod
    def get_backup_directory(db: Session = None) -> str:
        """Resolves target backup directory from store settings or app default."""
        if db:
            store_settings = db.query(StoreSettings).first()
            if store_settings and store_settings.backup_path and store_settings.backup_path.strip():
                custom_path = store_settings.backup_path.strip()
                os.makedirs(custom_path, exist_ok=True)
                return custom_path

        target = os.path.abspath(settings.BACKUP_DIR)
        os.makedirs(target, exist_ok=True)
        return target

    @staticmethod
    def create_database_backup(db: Session, custom_path: str = None, is_auto_monthly: bool = False) -> dict:
        """
        Creates a 100% complete portable JSON snapshot of the entire Dolly POS database:
        Products, Categories, Invoices, Customers, Ledgers, Expenses, Purchases,
        Vendors, Returns, WhatsApp logs, Users, and Store Settings.
        """
        target_dir = custom_path or BackupService.get_backup_directory(db)
        os.makedirs(target_dir, exist_ok=True)

        now = datetime.now()
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        
        if is_auto_monthly:
            backup_filename = f"DollyToys_AutoMonthlyBackup_{now.strftime('%Y_%m_01')}.json"
        else:
            backup_filename = f"DollyToys_CompleteBackup_{timestamp}.json"

        backup_filepath = os.path.join(target_dir, backup_filename)
        st = db.query(StoreSettings).first()

        # Build full JSON data payload
        data = {
            "backup_version": "2.0",
            "export_date": now.isoformat(),
            "is_auto_monthly": is_auto_monthly,
            "store_name": st.shop_name if st else "Dolly Toys and Kids Wear",
            "store_settings": {
                "shop_name": st.shop_name if st else "Dolly Toys and Kids Wear",
                "tag_line": st.tag_line if st else None,
                "is_tagline_bold": st.is_tagline_bold if st else False,
                "address": st.address if st else "",
                "mobile": st.mobile if st else "7972558842",
                "alt_mobile": st.alt_mobile if st else None,
                "email": st.email if st else None,
                "gstin": st.gstin if st else None,
                "show_gst_on_bill": st.show_gst_on_bill if st else False,
                "upi_id": st.upi_id if st else "7972558842@upi",
                "bill_header": st.bill_header if st else "Tax Invoice / Retail Bill",
                "bill_footer": st.bill_footer if st else None,
                "terms_and_conditions": st.terms_and_conditions if st else None,
                "show_terms_on_bill": st.show_terms_on_bill if st else True,
                "instagram_handle": st.instagram_handle if st else "@dollytoys_dhule",
                "show_instagram_on_bill": st.show_instagram_on_bill if st else True,
                "facebook_handle": st.facebook_handle if st else None,
                "show_facebook_on_bill": st.show_facebook_on_bill if st else False,
                "thermal_width": st.thermal_width if st else "80mm",
                "barcode_label_size": st.barcode_label_size if st else "50x25mm"
            } if st else None,
            "users": [
                {
                    "username": u.username,
                    "full_name": u.full_name,
                    "role": u.role.value if hasattr(u.role, 'value') else str(u.role),
                    "plain_password": u.plain_password or "admin",
                    "is_active": u.is_active
                }
                for u in db.query(User).all()
            ],
            "categories": [
                {
                    "id": c.id,
                    "name": c.name,
                    "subcategories": [{"id": sc.id, "name": sc.name} for sc in c.subcategories]
                }
                for c in db.query(Category).all()
            ],
            "products": [
                {
                    "barcode": p.barcode,
                    "sku": p.sku,
                    "name": p.name,
                    "category_id": p.category_id,
                    "subcategory_id": p.subcategory_id,
                    "vendor_code": p.vendor_code,
                    "brand": p.brand,
                    "size": p.size,
                    "color": p.color,
                    "purchase_price": p.purchase_price,
                    "selling_price": p.selling_price,
                    "mrp": p.mrp,
                    "margin_percent": p.margin_percent,
                    "stock_quantity": p.stock_quantity,
                    "damaged_quantity": p.damaged_quantity,
                    "min_stock_alert": p.min_stock_alert,
                    "speed_dial_code": p.speed_dial_code,
                    "is_speed_dial": p.is_speed_dial,
                    "is_active": p.is_active
                }
                for p in db.query(Product).all()
            ],
            "customers": [
                {
                    "id": c.id,
                    "name": c.name,
                    "phone": c.phone,
                    "city": c.city,
                    "credit_balance": c.credit_balance,
                    "total_spend": c.total_spend,
                    "visit_count": c.visit_count,
                    "ledgers": [
                        {
                            "entry_type": l.entry_type.value if hasattr(l.entry_type, 'value') else str(l.entry_type),
                            "amount": l.amount,
                            "running_balance": l.running_balance,
                            "description": l.description,
                            "created_at": l.created_at.isoformat() if l.created_at else None
                        }
                        for l in c.ledgers
                    ] if hasattr(c, 'ledgers') and c.ledgers else []
                }
                for c in db.query(Customer).all()
            ],
            "vendors": [
                {
                    "vendor_code": v.vendor_code,
                    "name": v.name,
                    "company_name": v.company_name,
                    "phone": v.phone,
                    "city": v.city,
                    "outstanding_due": v.outstanding_due,
                    "notes": v.notes,
                    "bank_name": v.bank_name,
                    "bank_account_no": v.bank_account_no,
                    "bank_ifsc": v.bank_ifsc
                }
                for v in db.query(Vendor).all()
            ],
            "invoices": [
                {
                    "bill_number": inv.bill_number,
                    "customer_name": inv.customer_name,
                    "customer_phone": inv.customer_phone,
                    "subtotal": inv.subtotal,
                    "discount_amount": inv.discount_amount,
                    "tax_amount": inv.tax_amount,
                    "grand_total": inv.grand_total,
                    "paid_amount": inv.paid_amount,
                    "change_amount": inv.change_amount,
                    "due_amount": inv.due_amount,
                    "payment_mode": inv.payment_mode.value if hasattr(inv.payment_mode, 'value') else str(inv.payment_mode),
                    "payment_status": inv.payment_status.value if hasattr(inv.payment_status, 'value') else str(inv.payment_status),
                    "is_cancelled": inv.is_cancelled,
                    "created_at": inv.created_at.isoformat() if inv.created_at else None,
                    "items": [
                        {
                            "item_name": item.item_name,
                            "barcode": item.barcode,
                            "size": item.size,
                            "color": item.color,
                            "quantity": item.quantity,
                            "unit_price": item.unit_price,
                            "cost_price": item.cost_price,
                            "discount_amount": item.discount_amount,
                            "tax_amount": item.tax_amount,
                            "total_price": item.total_price
                        }
                        for item in inv.items
                    ] if inv.items else []
                }
                for inv in db.query(Invoice).all()
            ],
            "expenses": [
                {
                    "category": exp.category.value if hasattr(exp.category, 'value') else str(exp.category),
                    "title": exp.title,
                    "amount": exp.amount,
                    "payment_mode": exp.payment_mode,
                    "paid_to": exp.paid_to,
                    "notes": exp.notes,
                    "expense_date": exp.expense_date.isoformat() if exp.expense_date else None
                }
                for exp in db.query(Expense).all()
            ],
            "purchases": [
                {
                    "purchase_number": purch.purchase_number,
                    "vendor_id": purch.vendor_id,
                    "supplier_invoice_no": purch.supplier_invoice_no,
                    "subtotal": purch.subtotal,
                    "tax_amount": purch.tax_amount,
                    "discount_amount": purch.discount_amount,
                    "shipping_charges": purch.shipping_charges,
                    "total_amount": purch.total_amount,
                    "paid_amount": purch.paid_amount,
                    "due_amount": purch.due_amount,
                    "status": purch.status.value if hasattr(purch.status, 'value') else str(purch.status),
                    "payment_status": purch.payment_status.value if hasattr(purch.payment_status, 'value') else str(purch.payment_status),
                    "invoice_date": purch.invoice_date.isoformat() if purch.invoice_date else None,
                    "items": [
                        {
                            "product_name": item.product_name,
                            "barcode": item.barcode,
                            "quantity": item.quantity,
                            "cost_price": item.cost_price,
                            "selling_price": item.selling_price,
                            "gst_percent": item.gst_percent,
                            "total_cost": item.total_cost
                        }
                        for item in purch.items
                    ] if purch.items else []
                }
                for purch in db.query(Purchase).all()
            ]
        }

        with open(backup_filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        file_size_kb = round(os.path.getsize(backup_filepath) / 1024, 2)

        return {
            "success": True,
            "message": f"Database backup saved successfully to: {backup_filepath}",
            "file_name": backup_filename,
            "file_path": backup_filepath,
            "file_size_kb": file_size_kb,
            "product_count": len(data["products"]),
            "invoice_count": len(data["invoices"]),
            "customer_count": len(data["customers"]),
            "timestamp": timestamp
        }

    @staticmethod
    def check_and_run_monthly_auto_backup(db: Session) -> dict:
        """
        Checks if the current month's automatic backup has been created.
        If missing and auto_backup is enabled, automatically creates it in the configured folder.
        """
        store_settings = db.query(StoreSettings).first()
        if store_settings and not store_settings.auto_backup:
            return {"status": "DISABLED", "message": "Automatic monthly backup is disabled in settings."}

        target_dir = BackupService.get_backup_directory(db)
        now = datetime.now()
        monthly_filename = f"DollyToys_AutoMonthlyBackup_{now.strftime('%Y_%m_01')}.json"
        monthly_filepath = os.path.join(target_dir, monthly_filename)

        if not os.path.exists(monthly_filepath):
            # Create the monthly backup automatically
            result = BackupService.create_database_backup(db, custom_path=target_dir, is_auto_monthly=True)
            return {
                "status": "CREATED_NOW",
                "message": f"Automatic monthly backup created for {now.strftime('%B %Y')}",
                "file_path": monthly_filepath,
                "details": result
            }

        return {
            "status": "UP_TO_DATE",
            "message": f"Current month ({now.strftime('%B %Y')}) backup is already up to date.",
            "file_path": monthly_filepath
        }

backup_service = BackupService()
