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
from app.models.lost_demand import LostDemand, ProcurementNote

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
                "opening_date": st.opening_date if st else "2002-01-01",
                "bill_header": st.bill_header if st else "Tax Invoice / Retail Bill",
                "bill_footer": st.bill_footer if st else None,
                "footer_font_size": st.footer_font_size if st else "10px",
                "is_footer_bold": st.is_footer_bold if st else False,
                "power_footer_font_size": st.power_footer_font_size if st else "9px",
                "is_power_footer_bold": st.is_power_footer_bold if st else False,
                "terms_and_conditions": st.terms_and_conditions if st else None,
                "show_terms_on_bill": st.show_terms_on_bill if st else True,
                "whatsapp_bill_template": getattr(st, 'whatsapp_bill_template', None) if st else None,
                "custom_festival_items": getattr(st, 'custom_festival_items', None) if st else None,
                "instagram_handle": st.instagram_handle if st else "@dollytoys_dhule",
                "show_instagram_on_bill": st.show_instagram_on_bill if st else True,
                "facebook_handle": st.facebook_handle if st else None,
                "show_facebook_on_bill": st.show_facebook_on_bill if st else False,
                "threads_handle": st.threads_handle if st else None,
                "show_threads_on_bill": st.show_threads_on_bill if st else False,
                "website_url": st.website_url if st else None,
                "show_website_on_bill": st.show_website_on_bill if st else False,
                "custom_social_label": st.custom_social_label if st else None,
                "custom_social_handle": st.custom_social_handle if st else None,
                "show_custom_social_on_bill": st.show_custom_social_on_bill if st else False,
                "custom_social_label2": st.custom_social_label2 if st else None,
                "custom_social_handle2": st.custom_social_handle2 if st else None,
                "show_custom_social_on_bill2": st.show_custom_social_on_bill2 if st else False,
                "custom_social_label3": st.custom_social_label3 if st else None,
                "custom_social_handle3": st.custom_social_handle3 if st else None,
                "show_custom_social_on_bill3": st.show_custom_social_on_bill3 if st else False,
                "custom_social_label4": st.custom_social_label4 if st else None,
                "custom_social_handle4": st.custom_social_handle4 if st else None,
                "show_custom_social_on_bill4": st.show_custom_social_on_bill4 if st else False,
                "custom_social_label5": st.custom_social_label5 if st else None,
                "custom_social_handle5": st.custom_social_handle5 if st else None,
                "show_custom_social_on_bill5": st.show_custom_social_on_bill5 if st else False,
                "thermal_printer_name": st.thermal_printer_name if st else None,
                "thermal_width": st.thermal_width if st else "80mm",
                "barcode_printer_name": st.barcode_printer_name if st else None,
                "barcode_label_size": st.barcode_label_size if st else "50x25mm",
                "extra_charge_enabled_1": getattr(st, 'extra_charge_enabled_1', False) if st else False,
                "extra_charge_name_1": getattr(st, 'extra_charge_name_1', 'Online / MDR Surcharge') if st else 'Online / MDR Surcharge',
                "extra_charge_condition_1": getattr(st, 'extra_charge_condition_1', 'GREATER_THAN') if st else 'GREATER_THAN',
                "extra_charge_threshold_1": getattr(st, 'extra_charge_threshold_1', 2000.0) if st else 2000.0,
                "extra_charge_type_1": getattr(st, 'extra_charge_type_1', 'PERCENT') if st else 'PERCENT',
                "extra_charge_value_1": getattr(st, 'extra_charge_value_1', 0.04) if st else 0.04,
                "extra_charge_payment_mode_1": getattr(st, 'extra_charge_payment_mode_1', 'ONLINE') if st else 'ONLINE',
                "extra_charge_enabled_2": getattr(st, 'extra_charge_enabled_2', False) if st else False,
                "extra_charge_name_2": getattr(st, 'extra_charge_name_2', 'Fixed Convenience Fee') if st else 'Fixed Convenience Fee',
                "extra_charge_condition_2": getattr(st, 'extra_charge_condition_2', 'ALWAYS') if st else 'ALWAYS',
                "extra_charge_threshold_2": getattr(st, 'extra_charge_threshold_2', 0.0) if st else 0.0,
                "extra_charge_type_2": getattr(st, 'extra_charge_type_2', 'FLAT') if st else 'FLAT',
                "extra_charge_value_2": getattr(st, 'extra_charge_value_2', 10.0) if st else 10.0,
                "extra_charge_payment_mode_2": getattr(st, 'extra_charge_payment_mode_2', 'ALL') if st else 'ALL',
                "extra_charge_enabled_3": getattr(st, 'extra_charge_enabled_3', False) if st else False,
                "extra_charge_name_3": getattr(st, 'extra_charge_name_3', 'Packaging / Handling Charge') if st else 'Packaging / Handling Charge',
                "extra_charge_condition_3": getattr(st, 'extra_charge_condition_3', 'ALWAYS') if st else 'ALWAYS',
                "extra_charge_threshold_3": getattr(st, 'extra_charge_threshold_3', 0.0) if st else 0.0,
                "extra_charge_type_3": getattr(st, 'extra_charge_type_3', 'FLAT') if st else 'FLAT',
                "extra_charge_value_3": getattr(st, 'extra_charge_value_3', 5.0) if st else 5.0,
                "extra_charge_payment_mode_3": getattr(st, 'extra_charge_payment_mode_3', 'ALL') if st else 'ALL',
                "extra_charge_enabled_4": getattr(st, 'extra_charge_enabled_4', False) if st else False,
                "extra_charge_name_4": getattr(st, 'extra_charge_name_4', 'Special Processing Fee') if st else 'Special Processing Fee',
                "extra_charge_condition_4": getattr(st, 'extra_charge_condition_4', 'GREATER_EQUAL') if st else 'GREATER_EQUAL',
                "extra_charge_threshold_4": getattr(st, 'extra_charge_threshold_4', 1000.0) if st else 1000.0,
                "extra_charge_type_4": getattr(st, 'extra_charge_type_4', 'PERCENT') if st else 'PERCENT',
                "extra_charge_value_4": getattr(st, 'extra_charge_value_4', 1.0) if st else 1.0,
                "extra_charge_payment_mode_4": getattr(st, 'extra_charge_payment_mode_4', 'ALL') if st else 'ALL',
                "extra_charge_enabled_5": getattr(st, 'extra_charge_enabled_5', False) if st else False,
                "extra_charge_name_5": getattr(st, 'extra_charge_name_5', 'Custom Service Surcharge') if st else 'Custom Service Surcharge',
                "extra_charge_condition_5": getattr(st, 'extra_charge_condition_5', 'ALWAYS') if st else 'ALWAYS',
                "extra_charge_threshold_5": getattr(st, 'extra_charge_threshold_5', 0.0) if st else 0.0,
                "extra_charge_type_5": getattr(st, 'extra_charge_type_5', 'FLAT') if st else 'FLAT',
                "extra_charge_value_5": getattr(st, 'extra_charge_value_5', 0.0) if st else 0.0,
                "extra_charge_payment_mode_5": getattr(st, 'extra_charge_payment_mode_5', 'ALL') if st else 'ALL'
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
                    "description": c.description,
                    "icon": c.icon,
                    "subcategories": [
                        {"id": sc.id, "name": sc.name, "description": sc.description}
                        for sc in c.subcategories
                    ]
                }
                for c in db.query(Category).all()
            ],
            "products": [
                {
                    "barcode": p.barcode,
                    "sku": p.sku,
                    "name": p.name,
                    "category_name": p.category.name if p.category else None,
                    "subcategory_name": p.subcategory.name if p.subcategory else None,
                    "category_id": p.category_id,
                    "subcategory_id": p.subcategory_id,
                    "vendor_code": p.vendor_code,
                    "brand": p.brand,
                    "size": p.size,
                    "color": p.color,
                    "fabric": p.fabric,
                    "season": p.season,
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
                    "alt_phone": c.alt_phone,
                    "email": c.email,
                    "address": c.address,
                    "city": c.city,
                    "credit_balance": c.credit_balance,
                    "total_spend": c.total_spend,
                    "visit_count": c.visit_count,
                    "ledgers": [
                        {
                            "entry_type": l.entry_type.value if hasattr(l.entry_type, 'value') else str(l.entry_type),
                            "debit_amount": l.debit_amount,
                            "credit_amount": l.credit_amount,
                            "balance_after": l.balance_after,
                            "reference_no": l.reference_no,
                            "payment_mode": l.payment_mode,
                            "notes": l.notes,
                            "created_at": l.created_at.isoformat() if l.created_at else None
                        }
                        for l in c.ledger_entries
                    ] if hasattr(c, 'ledger_entries') and c.ledger_entries else []
                }
                for c in db.query(Customer).all()
            ],
            "vendors": [
                {
                    "vendor_code": v.vendor_code,
                    "name": v.name,
                    "company_name": v.company_name,
                    "phone": v.phone,
                    "alt_phone": v.alt_phone,
                    "email": v.email,
                    "gstin": v.gstin,
                    "address": v.address,
                    "city": v.city,
                    "state": v.state,
                    "outstanding_due": v.outstanding_due,
                    "notes": v.notes,
                    "bank_name": v.bank_name,
                    "bank_account_no": v.bank_account_no,
                    "bank_ifsc": v.bank_ifsc,
                    "ledgers": [
                        {
                            "entry_type": vl.entry_type.value if hasattr(vl.entry_type, 'value') else str(vl.entry_type),
                            "debit_amount": vl.debit_amount,
                            "credit_amount": vl.credit_amount,
                            "balance_after": vl.balance_after,
                            "reference_no": vl.reference_no,
                            "payment_mode": vl.payment_mode,
                            "notes": vl.notes,
                            "created_at": vl.created_at.isoformat() if vl.created_at else None
                        }
                        for vl in v.ledger_entries
                    ] if hasattr(v, 'ledger_entries') and v.ledger_entries else []
                }
                for v in db.query(Vendor).all()
            ],
            "purchases": [
                {
                    "purchase_number": purch.purchase_number,
                    "vendor_code": purch.vendor.vendor_code if purch.vendor else None,
                    "vendor_phone": purch.vendor.phone if purch.vendor else None,
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
            ],
            "invoices": [
                {
                    "bill_number": inv.bill_number,
                    "customer_name": inv.customer_name,
                    "customer_phone": inv.customer_phone,
                    "subtotal": inv.subtotal,
                    "discount_amount": inv.discount_amount,
                    "discount_type": inv.discount_type,
                    "tax_amount": inv.tax_amount,
                    "extra_charges_amount": getattr(inv, 'extra_charges_amount', 0.0),
                    "extra_charges_breakdown": getattr(inv, 'extra_charges_breakdown', None),
                    "round_off": inv.round_off,
                    "grand_total": inv.grand_total,
                    "paid_amount": inv.paid_amount,
                    "change_amount": inv.change_amount,
                    "due_amount": inv.due_amount,
                    "payment_mode": inv.payment_mode.value if hasattr(inv.payment_mode, 'value') else str(inv.payment_mode),
                    "payment_status": inv.payment_status.value if hasattr(inv.payment_status, 'value') else str(inv.payment_status),
                    "is_cancelled": inv.is_cancelled,
                    "is_held": inv.is_held,
                    "is_gift_receipt": inv.is_gift_receipt,
                    "notes": inv.notes,
                    "created_at": inv.created_at.isoformat() if inv.created_at else None,
                    "items": [
                        {
                            "item_name": item.item_name,
                            "barcode": item.barcode,
                            "sku": item.sku,
                            "size": item.size,
                            "color": item.color,
                            "quantity": item.quantity,
                            "unit_price": item.unit_price,
                            "cost_price": item.cost_price,
                            "discount_amount": item.discount_amount,
                            "tax_amount": item.tax_amount,
                            "total_price": item.total_price,
                            "is_unlisted": item.is_unlisted
                        }
                        for item in inv.items
                    ] if inv.items else [],
                    "payments": [
                        {
                            "payment_mode": p.payment_mode.value if hasattr(p.payment_mode, 'value') else str(p.payment_mode),
                            "amount": p.amount,
                            "transaction_ref": p.transaction_ref,
                            "created_at": p.created_at.isoformat() if p.created_at else None
                        }
                        for p in inv.payments
                    ] if inv.payments else []
                }
                for inv in db.query(Invoice).all()
            ],
            "returns": [
                {
                    "return_number": ret.return_number,
                    "bill_number": ret.invoice.bill_number if ret.invoice else None,
                    "customer_name": ret.customer.name if ret.customer else None,
                    "customer_phone": ret.customer.phone if ret.customer else None,
                    "return_type": ret.return_type.value if hasattr(ret.return_type, 'value') else str(ret.return_type),
                    "total_refund_amount": ret.total_refund_amount,
                    "reason": ret.reason,
                    "notes": ret.notes,
                    "created_at": ret.created_at.isoformat() if ret.created_at else None,
                    "items": [
                        {
                            "item_name": ritem.item_name,
                            "barcode": ritem.barcode,
                            "quantity": ritem.quantity,
                            "refund_price": ritem.refund_price,
                            "is_defective": ritem.is_defective,
                            "restocked": ritem.restocked
                        }
                        for ritem in ret.items
                    ] if ret.items else []
                }
                for ret in db.query(ReturnOrder).all()
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
            "procurement_notes": [
                {
                    "item_name": n.item_name,
                    "quantity": n.quantity,
                    "description": n.description,
                    "vendor_name": n.vendor_name,
                    "estimated_price": n.estimated_price,
                    "priority": n.priority.value if hasattr(n.priority, 'value') else str(n.priority),
                    "status": n.status.value if hasattr(n.status, 'value') else str(n.status),
                    "notes": n.notes,
                    "created_at": n.created_at.isoformat() if n.created_at else None
                }
                for n in db.query(ProcurementNote).all()
            ],
            "lost_demands": [
                {
                    "item_description": ld.item_description,
                    "category_name": ld.category_name,
                    "preferred_size": ld.preferred_size,
                    "preferred_color": ld.preferred_color,
                    "customer_name": ld.customer_name,
                    "customer_phone": ld.customer_phone,
                    "urgency": ld.urgency.value if hasattr(ld.urgency, 'value') else str(ld.urgency),
                    "request_count": ld.request_count,
                    "status": ld.status.value if hasattr(ld.status, 'value') else str(ld.status),
                    "notes": ld.notes,
                    "created_at": ld.created_at.isoformat() if ld.created_at else None
                }
                for ld in db.query(LostDemand).all()
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
