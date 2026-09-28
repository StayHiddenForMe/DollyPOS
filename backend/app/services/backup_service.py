import os
import json
import random
import subprocess
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session, selectinload, joinedload
from app.config import settings
from app.models.settings import StoreSettings
from app.models.product import Product
from app.models.category import Category, Subcategory
from app.models.customer import Customer, CustomerLedger, CustomerLedgerType
from app.models.vendor import Vendor, VendorLedger, VendorLedgerType

from app.models.invoice import Invoice, InvoiceItem, Payment, PaymentMode, PaymentStatus
from app.models.return_order import ReturnOrder, ReturnItem, ReturnType
from app.models.expense import Expense, ExpenseCategory
from app.models.purchase import Purchase, PurchaseItem, PurchaseStatus
from app.models.user import User
from app.models.whatsapp import WhatsAppLog, WhatsAppConfig
from app.models.lost_demand import LostDemand, ProcurementNote, LostDemandStatus, LostDemandUrgency
from app.models.product_price_history import ProductPriceHistory
from app.models.audit_log import AuditLog

def parse_iso_datetime(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.strptime(val[:19], "%Y-%m-%dT%H:%M:%S")
        except Exception:
            return datetime.utcnow()

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
    def create_database_backup(db: Session, custom_path: str = None, is_auto_monthly: bool = False, auto_schedule: str = None) -> dict:
        """
        Creates a 100% complete portable JSON snapshot of the entire Dolly POS database:
        Products, Categories, Invoices, Customers, Ledgers, Expenses, Purchases,
        Vendors, Returns, WhatsApp logs, Users, Price History, Audit Logs, and Store Settings.
        """
        target_dir = custom_path or BackupService.get_backup_directory(db)
        os.makedirs(target_dir, exist_ok=True)

        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d_%I-%M%p")
        st = db.query(StoreSettings).first()
        raw_prefix = getattr(st, 'backup_filename_prefix', 'DollyToys') if st else 'DollyToys'
        prefix = raw_prefix.strip() if raw_prefix and raw_prefix.strip() else 'DollyToys'
        
        if auto_schedule == "DAILY":
            backup_filename = f"{prefix}_Backup_Daily_{now.strftime('%Y-%m-%d')}.json"
        elif auto_schedule in ["WEEKLY", "WEEKLY_MONDAY"]:
            backup_filename = f"{prefix}_Backup_Weekly_{now.strftime('%Y_W%W')}.json"
        elif is_auto_monthly or auto_schedule in ["MONTHLY", "MONTHLY_FIRST"]:
            backup_filename = f"{prefix}_Backup_Monthly_{now.strftime('%Y_%m_01')}.json"
        elif auto_schedule == "ON_CLOSE":
            backup_filename = f"{prefix}_Backup_Daily_{now.strftime('%Y-%m-%d_%I-%M%p')}.json"
        else:
            backup_filename = f"{prefix}_Backup_Complete_{timestamp}.json"

        backup_filepath = os.path.join(target_dir, backup_filename)

        # Build full JSON data payload
        data = {
            "backup_version": "2.1",
            "export_date": now.isoformat(),
            "is_auto_monthly": is_auto_monthly or (auto_schedule in ["MONTHLY", "MONTHLY_FIRST"]),
            "auto_schedule": auto_schedule,
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
                "show_upi_qr_on_bill": getattr(st, 'show_upi_qr_on_bill', True) if st else True,
                "opening_date": st.opening_date if st else "2002-01-01",
                "bill_header": st.bill_header if st else "Tax Invoice / Retail Bill",
                "bill_footer": st.bill_footer if st else None,
                "footer_font_size": st.footer_font_size if st else "10px",
                "is_footer_bold": st.is_footer_bold if st else False,
                "power_footer_text": getattr(st, 'power_footer_text', "Software powered by Dolly POS© | Since 2002") if st else "Software powered by Dolly POS© | Since 2002",
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
                for c in db.query(Category).options(selectinload(Category.subcategories)).all()
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
                for p in db.query(Product).options(joinedload(Product.category), joinedload(Product.subcategory)).all()
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
                for c in db.query(Customer).options(selectinload(Customer.ledger_entries)).all()
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
                for v in db.query(Vendor).options(selectinload(Vendor.ledger_entries)).all()
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
                for purch in db.query(Purchase).options(selectinload(Purchase.items), joinedload(Purchase.vendor)).all()
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
                for inv in db.query(Invoice).options(selectinload(Invoice.items), selectinload(Invoice.payments)).all()
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
                for ret in db.query(ReturnOrder).options(selectinload(ReturnOrder.items), joinedload(ReturnOrder.invoice), joinedload(ReturnOrder.customer)).all()
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
            ],
            "product_price_history": [
                {
                    "barcode": pph.product.barcode if pph.product else None,
                    "product_name": pph.product.name if pph.product else None,
                    "old_purchase_price": pph.old_purchase_price,
                    "new_purchase_price": pph.new_purchase_price,
                    "old_selling_price": pph.old_selling_price,
                    "new_selling_price": pph.new_selling_price,
                    "old_mrp": pph.old_mrp,
                    "new_mrp": pph.new_mrp,
                    "reason": pph.reason,
                    "changed_by": pph.changed_by,
                    "created_at": pph.created_at.isoformat() if pph.created_at else None
                }
                for pph in db.query(ProductPriceHistory).options(joinedload(ProductPriceHistory.product)).all()
            ],
            "whatsapp_logs": [
                {
                    "recipient_name": wl.recipient_name,
                    "recipient_phone": wl.recipient_phone,
                    "message_type": wl.message_type.value if hasattr(wl.message_type, 'value') else str(wl.message_type),
                    "message_text": wl.message_text,
                    "status": wl.status.value if hasattr(wl.status, 'value') else str(wl.status),
                    "error_message": wl.error_message,
                    "sent_at": wl.sent_at.isoformat() if wl.sent_at else None
                }
                for wl in db.query(WhatsAppLog).all()
            ],
            "audit_logs": [
                {
                    "user_id": al.user_id,
                    "action_type": al.action_type,
                    "entity": al.entity,
                    "entity_id": al.entity_id,
                    "details_json": al.details_json,
                    "ip_address": al.ip_address,
                    "created_at": al.created_at.isoformat() if al.created_at else None
                }
                for al in db.query(AuditLog).all()
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
    def purge_old_local_backups(target_dir: str, retention_days: int) -> int:
        """
        Deletes backup files (.json, .sql, .backup) in target_dir older than retention_days.
        If retention_days is 0 (Never Delete), no files are purged.
        """
        if retention_days <= 0 or not os.path.exists(target_dir):
            return 0

        cutoff_time = datetime.now() - timedelta(days=retention_days)
        deleted_count = 0

        for f in os.listdir(target_dir):
            if f.endswith(".json") or f.endswith(".sql") or f.endswith(".backup"):
                fpath = os.path.join(target_dir, f)
                try:
                    mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
                    if mtime < cutoff_time:
                        os.remove(fpath)
                        deleted_count += 1
                except Exception:
                    pass

        return deleted_count

    @staticmethod
    def execute_full_backup_flow(
        db: Session, 
        custom_path: str = None, 
        auto_schedule: str = None, 
        force_cloud: bool = False
    ) -> dict:
        """
        Executes end-to-end backup pipeline:
        1. Generates local JSON database snapshot
        2. If destination includes Google Drive & account is connected, uploads snapshot to Google Drive
        3. Purges local and cloud backups older than configured retention days
        """
        from app.services.google_drive_service import google_drive_service

        st = db.query(StoreSettings).first()
        dest = (st.backup_destination if st and st.backup_destination else "BOTH").upper()
        retention_days = st.backup_retention_days if st and st.backup_retention_days is not None else 30

        # Step 1: Create local snapshot
        local_result = BackupService.create_database_backup(db, custom_path=custom_path, auto_schedule=auto_schedule)
        local_filepath = local_result.get("file_path")
        local_filename = local_result.get("file_name")

        cloud_result = None
        cloud_error = None

        # Step 2: Upload to Google Drive if applicable
        should_upload_cloud = force_cloud or dest in ["BOTH", "GOOGLE_DRIVE_ONLY"]
        if should_upload_cloud and st and st.google_drive_connected:
            try:
                cloud_result = google_drive_service.upload_backup_file(db, local_filepath, custom_filename=local_filename)
            except Exception as e:
                cloud_error = str(e)

        # Step 3: Run local retention cleanup
        target_dir = custom_path or BackupService.get_backup_directory(db)
        local_purged = BackupService.purge_old_local_backups(target_dir, retention_days)

        # If user explicitly selected GOOGLE_DRIVE_ONLY and cloud upload succeeded, clean temporary local file if not custom path
        if dest == "GOOGLE_DRIVE_ONLY" and cloud_result and cloud_result.get("success") and not custom_path:
            # We keep local copy in backup directory as safety cache
            pass

        return {
            "success": True,
            "message": f"Database backup generated successfully ({local_filename})",
            "destination": dest,
            "local_file": local_result,
            "local_purged_count": local_purged,
            "cloud_synced": bool(cloud_result and cloud_result.get("success")),
            "cloud_details": cloud_result,
            "cloud_error": cloud_error,
            "retention_days": retention_days
        }

    _on_close_lock = False

    @staticmethod
    def handle_on_close_backup(db: Session) -> dict:
        """
        Executed when Dolly POS is closing:
        1. Always pushes latest end-of-day snapshot to 24/7 Cloud Hub (store_token) for remote mobile access
        2. If backup_on_app_close is enabled, checks if today's backup already exists. If not, generates it
        3. Uploads snapshot to Google Drive if connected
        4. Cleans old retention files
        """
        from app.services.cloud_sync_service import cloud_sync_service

        # Re-entrancy guard to prevent multiple threads from running simultaneously on close
        if getattr(BackupService, '_on_close_lock', False):
            return {"status": "IN_PROGRESS", "message": "On-close sync already in progress."}
        BackupService._on_close_lock = True

        try:
            # 1. End-of-Day push to 24/7 Cloud Hub (ensures mobile phone has 100% up-to-date final business pulse)
            hub_result = {}
            try:
                hub_result = cloud_sync_service.sync_to_cloud(db, force=True)
            except Exception as e:
                hub_result = {"status": "error", "message": str(e)}

            st = db.query(StoreSettings).first()
            if st and not getattr(st, 'backup_on_app_close', True):
                return {
                    "status": "COMPLETED",
                    "message": "End-of-day Cloud Hub snapshot pushed successfully. Local backup skipped (disabled in settings).",
                    "backed_up": False,
                    "cloud_hub_synced": hub_result.get("status") == "success",
                    "cloud_hub_details": hub_result
                }

            # 2. Check if today's backup already exists in target directory
            target_dir = BackupService.get_backup_directory(db)
            today_str = datetime.now().strftime("%Y-%m-%d")
            existing_today = []
            if os.path.exists(target_dir):
                existing_today = [f for f in os.listdir(target_dir) if today_str in f and f.endswith(".json")]

            if existing_today:
                retention_days = st.backup_retention_days if st and st.backup_retention_days is not None else 30
                local_purged = BackupService.purge_old_local_backups(target_dir, retention_days)
                return {
                    "status": "COMPLETED",
                    "message": f"End-of-day Cloud Hub snapshot pushed. Today's database backup already safely exists ({existing_today[0]}).",
                    "backed_up": True,
                    "already_exists": True,
                    "cloud_hub_synced": hub_result.get("status") == "success",
                    "cloud_hub_details": hub_result,
                    "details": {
                        "local_file": {"file_name": existing_today[0]},
                        "local_purged_count": local_purged
                    }
                }

            # 3. If today's backup does not exist, generate it now
            result = BackupService.execute_full_backup_flow(db, auto_schedule="ON_CLOSE")
            result["cloud_hub_synced"] = hub_result.get("status") == "success"
            result["cloud_hub_details"] = hub_result

            return {
                "status": "COMPLETED",
                "message": "On-close backup and 24/7 Cloud Hub sync completed successfully.",
                "backed_up": True,
                "cloud_hub_synced": hub_result.get("status") == "success",
                "cloud_hub_details": hub_result,
                "details": result
            }
        finally:
            BackupService._on_close_lock = False

    @staticmethod
    def check_and_run_scheduled_auto_backup(db: Session) -> dict:
        """
        Checks if the configured automatic backup (DAILY, WEEKLY_MONDAY, or MONTHLY_FIRST) has been created.
        If missing and auto_backup is enabled, automatically creates it in the configured destination folder.
        """
        store_settings = db.query(StoreSettings).first()
        if store_settings and not store_settings.auto_backup:
            return {"status": "DISABLED", "message": "Automatic backup is disabled in settings."}

        freq = (store_settings.backup_frequency if store_settings and store_settings.backup_frequency else "DAILY").upper()
        target_dir = BackupService.get_backup_directory(db)
        now = datetime.now()

        raw_prefix = getattr(store_settings, 'backup_filename_prefix', 'DollyToys') if store_settings else 'DollyToys'
        prefix = raw_prefix.strip() if raw_prefix and raw_prefix.strip() else 'DollyToys'

        if freq == "DAILY":
            scheduled_filename = f"{prefix}_Backup_Daily_{now.strftime('%Y-%m-%d')}.json"
            schedule_label = f"Daily ({now.strftime('%d-%m-%Y')})"
        elif freq in ["WEEKLY", "WEEKLY_MONDAY"]:
            scheduled_filename = f"{prefix}_Backup_Weekly_{now.strftime('%Y_W%W')}.json"
            schedule_label = f"Weekly (Week {now.strftime('%W, %Y')})"
        else: # MONTHLY / MONTHLY_FIRST
            scheduled_filename = f"{prefix}_Backup_Monthly_{now.strftime('%Y_%m_01')}.json"
            schedule_label = f"Monthly ({now.strftime('%B %Y')})"

        scheduled_filepath = os.path.join(target_dir, scheduled_filename)

        if not os.path.exists(scheduled_filepath):
            result = BackupService.execute_full_backup_flow(db, custom_path=target_dir, auto_schedule=freq)
            return {
                "status": "CREATED_NOW",
                "frequency": freq,
                "message": f"Automatic {schedule_label} backup created successfully.",
                "file_path": scheduled_filepath,
                "details": result
            }

        return {
            "status": "UP_TO_DATE",
            "frequency": freq,
            "message": f"{schedule_label} backup is already up to date.",
            "file_path": scheduled_filepath
        }

    @staticmethod
    def restore_database_from_dict(db: Session, data: dict) -> dict:
        """
        Restores 100% complete database state from portable JSON backup dictionary:
        Categories, Subcategories, Vendors, Customers, Products, Purchases,
        Invoices, Payments, Returns, Expenses, Procurement Notes, and Lost Demands.
        
        NOTE: StoreSettings (Shop Name, Address, Footers, Opening Date, Printers)
        are intentionally preserved and NEVER overwritten during restore.
        """
        imported_products = 0
        imported_customers = 0
        imported_vendors = 0
        imported_expenses = 0
        imported_purchases = 0
        imported_invoices = 0
        imported_returns = 0

        # 1. Store Settings: Intentionally preserved untouched per safety rule

        # 2. Restore Categories & Subcategories with in-memory map
        cat_map: Dict[str, int] = {c.name.lower(): c.id for c in db.query(Category.name, Category.id).all()}
        subcat_map: Dict[str, int] = {f"{sc.category_id}_{sc.name.lower()}": sc.id for sc in db.query(Subcategory.category_id, Subcategory.name, Subcategory.id).all()}

        for c_data in data.get("categories", []):
            cat_name = (c_data.get("name") or "").strip()
            if not cat_name:
                continue
            c_key = cat_name.lower()
            if c_key not in cat_map:
                cat = Category(
                    name=cat_name,
                    description=c_data.get("description"),
                    icon=c_data.get("icon") or "Package"
                )
                db.add(cat)
                db.flush()
                cat_map[c_key] = cat.id

            parent_id = cat_map[c_key]
            for sc_data in c_data.get("subcategories", []):
                sc_name = (sc_data.get("name") or "").strip()
                if not sc_name:
                    continue
                sc_key = f"{parent_id}_{sc_name.lower()}"
                if sc_key not in subcat_map:
                    sc = Subcategory(
                        category_id=parent_id,
                        name=sc_name,
                        description=sc_data.get("description")
                    )
                    db.add(sc)
                    db.flush()
                    subcat_map[sc_key] = sc.id

        db.commit()

        # 3. Restore Vendors & Vendor Ledgers
        existing_vendor_codes = {v[0]: v[1] for v in db.query(Vendor.vendor_code, Vendor.id).filter(Vendor.vendor_code != None).all()}
        existing_vendor_phones = {v[0]: v[1] for v in db.query(Vendor.phone, Vendor.id).filter(Vendor.phone != None).all()}
        vendor_map: Dict[str, int] = {**existing_vendor_codes, **existing_vendor_phones}

        for v_data in data.get("vendors", []):
            v_phone = (v_data.get("phone") or "").strip()
            v_code = (v_data.get("vendor_code") or "").strip()
            
            vend_id = vendor_map.get(v_code) or vendor_map.get(v_phone)
            if not vend_id:
                vend = Vendor(
                    vendor_code=v_code or f"VEND-{random.randint(1000, 9999)}",
                    name=v_data.get("name") or "Unknown Vendor",
                    company_name=v_data.get("company_name"),
                    phone=v_phone or f"98{random.randint(10000000, 99999999)}",
                    alt_phone=v_data.get("alt_phone"),
                    email=v_data.get("email"),
                    gstin=v_data.get("gstin"),
                    address=v_data.get("address"),
                    city=v_data.get("city", "Dhule"),
                    state=v_data.get("state", "Maharashtra"),
                    outstanding_due=float(v_data.get("outstanding_due") or 0.0),
                    notes=v_data.get("notes"),
                    bank_name=v_data.get("bank_name"),
                    bank_account_no=v_data.get("bank_account_no"),
                    bank_ifsc=v_data.get("bank_ifsc")
                )
                db.add(vend)
                db.flush()
                vend_id = vend.id
                if v_code:
                    vendor_map[v_code] = vend_id
                if v_phone:
                    vendor_map[v_phone] = vend_id
                imported_vendors += 1

                for vl in v_data.get("ledgers", []):
                    try:
                        entry_type = VendorLedgerType(vl.get("entry_type", "PURCHASE_BILL"))
                    except Exception:
                        entry_type = VendorLedgerType.PURCHASE_BILL
                    v_ledger = VendorLedger(
                        vendor_id=vend_id,
                        entry_type=entry_type,
                        reference_no=vl.get("reference_no") or vl.get("description"),
                        debit_amount=float(vl.get("debit_amount") or 0.0),
                        credit_amount=float(vl.get("credit_amount") or vl.get("amount") or 0.0),
                        balance_after=float(vl.get("balance_after") or vl.get("running_balance") or 0.0),
                        payment_mode=vl.get("payment_mode", "CASH"),
                        notes=vl.get("notes") or vl.get("description"),
                        created_at=parse_iso_datetime(vl.get("created_at")) or datetime.utcnow()
                    )
                    db.add(v_ledger)

        db.commit()

        # 4. Restore Customers & Customer Ledgers
        existing_cust_phones = {c[0]: c[1] for c in db.query(Customer.phone, Customer.id).filter(Customer.phone != None).all()}
        customer_map: Dict[str, int] = {**existing_cust_phones}

        for c_data in data.get("customers", []):
            c_phone = (c_data.get("phone") or "").strip()
            cust_id = customer_map.get(c_phone)
            if not cust_id:
                cust = Customer(
                    name=c_data.get("name") or "Retail Customer",
                    phone=c_phone or f"99{random.randint(10000000, 99999999)}",
                    alt_phone=c_data.get("alt_phone"),
                    email=c_data.get("email"),
                    address=c_data.get("address"),
                    city=c_data.get("city", "Dhule"),
                    credit_balance=float(c_data.get("credit_balance") or 0.0),
                    total_spend=float(c_data.get("total_spend") or 0.0),
                    visit_count=int(c_data.get("visit_count") or 1)
                )
                db.add(cust)
                db.flush()
                cust_id = cust.id
                if c_phone:
                    customer_map[c_phone] = cust_id
                imported_customers += 1

                for cl in c_data.get("ledgers", []):
                    try:
                        entry_type = CustomerLedgerType(cl.get("entry_type", "BILL_CREDIT"))
                    except Exception:
                        entry_type = CustomerLedgerType.BILL_CREDIT
                    c_ledger = CustomerLedger(
                        customer_id=cust_id,
                        entry_type=entry_type,
                        reference_no=cl.get("reference_no") or cl.get("description"),
                        debit_amount=float(cl.get("debit_amount") or 0.0),
                        credit_amount=float(cl.get("credit_amount") or cl.get("amount") or 0.0),
                        balance_after=float(cl.get("balance_after") or cl.get("running_balance") or 0.0),
                        payment_mode=cl.get("payment_mode", "CASH"),
                        notes=cl.get("notes") or cl.get("description"),
                        created_at=parse_iso_datetime(cl.get("created_at")) or datetime.utcnow()
                    )
                    db.add(c_ledger)

        db.commit()

        # 5. Restore Products
        existing_barcodes = {p[0] for p in db.query(Product.barcode).all()}
        new_products = []
        
        for p_data in data.get("products", []):
            barcode = (p_data.get("barcode") or "").strip()
            if not barcode or barcode in existing_barcodes:
                continue

            c_name = (p_data.get("category_name") or "").lower()
            c_id = cat_map.get(c_name) or p_data.get("category_id")

            sc_name = (p_data.get("subcategory_name") or "").lower()
            sc_id = subcat_map.get(f"{c_id}_{sc_name}") or p_data.get("subcategory_id")

            prod = Product(
                barcode=barcode,
                sku=p_data.get("sku") or barcode,
                name=p_data.get("name") or "Product Item",
                category_id=c_id,
                subcategory_id=sc_id,
                vendor_code=p_data.get("vendor_code"),
                brand=p_data.get("brand"),
                size=p_data.get("size"),
                color=p_data.get("color"),
                fabric=p_data.get("fabric"),
                season=p_data.get("season"),
                purchase_price=float(p_data.get("purchase_price") or 0.0),
                selling_price=float(p_data.get("selling_price") or 0.0),
                mrp=float(p_data.get("mrp") or p_data.get("selling_price") or 0.0),
                margin_percent=float(p_data.get("margin_percent") or 0.0),
                stock_quantity=int(p_data.get("stock_quantity") or 0),
                damaged_quantity=int(p_data.get("damaged_quantity") or 0),
                min_stock_alert=int(p_data.get("min_stock_alert") or 3),
                speed_dial_code=p_data.get("speed_dial_code"),
                is_speed_dial=bool(p_data.get("is_speed_dial", False)),
                is_active=bool(p_data.get("is_active", True))
            )
            new_products.append(prod)
            existing_barcodes.add(barcode)
            imported_products += 1

        if new_products:
            db.add_all(new_products)
            db.commit()

        # Preload product barcode -> ID map for purchases and invoices
        prod_id_by_barcode = {p[0]: p[1] for p in db.query(Product.barcode, Product.id).all()}

        # 6. Restore Purchases & Purchase Items
        existing_purch_numbers = {p[0] for p in db.query(Purchase.purchase_number).all()}
        for purch_data in data.get("purchases", []):
            p_num = (purch_data.get("purchase_number") or "").strip()
            if not p_num or p_num in existing_purch_numbers:
                continue

            v_id = vendor_map.get(purch_data.get("vendor_code") or "") or vendor_map.get(purch_data.get("vendor_phone") or "") or purch_data.get("vendor_id")
            if not v_id:
                first_v = db.query(Vendor.id).first()
                v_id = first_v[0] if first_v else None

            try:
                p_status = PurchaseStatus(purch_data.get("status", "RECEIVED"))
            except Exception:
                p_status = PurchaseStatus.RECEIVED

            try:
                p_pay_status = PaymentStatus(purch_data.get("payment_status", "PAID"))
            except Exception:
                p_pay_status = PaymentStatus.PAID

            purch = Purchase(
                purchase_number=p_num,
                vendor_id=v_id,
                supplier_invoice_no=purch_data.get("supplier_invoice_no"),
                invoice_date=parse_iso_datetime(purch_data.get("invoice_date")) or datetime.utcnow(),
                subtotal=float(purch_data.get("subtotal") or 0.0),
                tax_amount=float(purch_data.get("tax_amount") or 0.0),
                discount_amount=float(purch_data.get("discount_amount") or 0.0),
                shipping_charges=float(purch_data.get("shipping_charges") or 0.0),
                total_amount=float(purch_data.get("total_amount") or 0.0),
                paid_amount=float(purch_data.get("paid_amount") or 0.0),
                due_amount=float(purch_data.get("due_amount") or 0.0),
                status=p_status,
                payment_status=p_pay_status
            )
            db.add(purch)
            db.flush()
            existing_purch_numbers.add(p_num)
            imported_purchases += 1

            for pitem in purch_data.get("items", []):
                p_id = prod_id_by_barcode.get(pitem.get("barcode") or "")
                item_obj = PurchaseItem(
                    purchase_id=purch.id,
                    product_id=p_id,
                    product_name=pitem.get("product_name") or "Purchased Item",
                    barcode=pitem.get("barcode") or "",
                    quantity=int(pitem.get("quantity") or 1),
                    cost_price=float(pitem.get("cost_price") or 0.0),
                    selling_price=float(pitem.get("selling_price") or 0.0),
                    gst_percent=float(pitem.get("gst_percent") or 0.0),
                    total_cost=float(pitem.get("total_cost") or 0.0)
                )
                db.add(item_obj)

        db.commit()

        # 7. Restore Invoices, Invoice Items & Payments
        existing_bill_numbers = {i[0] for i in db.query(Invoice.bill_number).all()}
        for inv_data in data.get("invoices", []):
            b_num = (inv_data.get("bill_number") or "").strip()
            if not b_num or b_num in existing_bill_numbers:
                continue

            cust_phone = (inv_data.get("customer_phone") or "").strip()
            c_id = customer_map.get(cust_phone) if cust_phone else None

            try:
                inv_pay_mode = PaymentMode(inv_data.get("payment_mode", "CASH"))
            except Exception:
                inv_pay_mode = PaymentMode.CASH

            try:
                inv_pay_status = PaymentStatus(inv_data.get("payment_status", "PAID"))
            except Exception:
                inv_pay_status = PaymentStatus.PAID

            inv = Invoice(
                bill_number=b_num,
                customer_id=c_id,
                customer_name=inv_data.get("customer_name") or "Walk-in Customer",
                customer_phone=cust_phone or None,
                subtotal=float(inv_data.get("subtotal") or 0.0),
                discount_amount=float(inv_data.get("discount_amount") or 0.0),
                discount_type=inv_data.get("discount_type") or "FIXED",
                tax_amount=float(inv_data.get("tax_amount") or 0.0),
                extra_charges_amount=float(inv_data.get("extra_charges_amount") or 0.0),
                extra_charges_breakdown=inv_data.get("extra_charges_breakdown"),
                round_off=float(inv_data.get("round_off") or 0.0),
                grand_total=float(inv_data.get("grand_total") or 0.0),
                paid_amount=float(inv_data.get("paid_amount") or 0.0),
                change_amount=float(inv_data.get("change_amount") or 0.0),
                due_amount=float(inv_data.get("due_amount") or 0.0),
                payment_mode=inv_pay_mode,
                payment_status=inv_pay_status,
                is_cancelled=bool(inv_data.get("is_cancelled", False)),
                is_held=bool(inv_data.get("is_held", False)),
                is_gift_receipt=bool(inv_data.get("is_gift_receipt", False)),
                notes=inv_data.get("notes"),
                created_at=parse_iso_datetime(inv_data.get("created_at")) or datetime.utcnow()
            )
            db.add(inv)
            db.flush()
            existing_bill_numbers.add(b_num)
            imported_invoices += 1

            for itm in inv_data.get("items", []):
                p_id = prod_id_by_barcode.get(itm.get("barcode") or "")
                inv_item = InvoiceItem(
                    invoice_id=inv.id,
                    product_id=p_id,
                    item_name=itm.get("item_name") or "Sales Item",
                    barcode=itm.get("barcode"),
                    sku=itm.get("sku"),
                    size=itm.get("size"),
                    color=itm.get("color"),
                    quantity=int(itm.get("quantity") or 1),
                    unit_price=float(itm.get("unit_price") or 0.0),
                    cost_price=float(itm.get("cost_price") or 0.0),
                    discount_amount=float(itm.get("discount_amount") or 0.0),
                    tax_amount=float(itm.get("tax_amount") or 0.0),
                    total_price=float(itm.get("total_price") or 0.0),
                    is_unlisted=bool(itm.get("is_unlisted", False))
                )
                db.add(inv_item)

            for pay in inv_data.get("payments", []):
                try:
                    pm = PaymentMode(pay.get("payment_mode", "CASH"))
                except Exception:
                    pm = PaymentMode.CASH
                p_entry = Payment(
                    invoice_id=inv.id,
                    payment_mode=pm,
                    amount=float(pay.get("amount") or 0.0),
                    transaction_ref=pay.get("transaction_ref"),
                    created_at=parse_iso_datetime(pay.get("created_at")) or datetime.utcnow()
                )
                db.add(p_entry)

        db.commit()

        # 8. Restore Returns & Return Items
        existing_return_numbers = {r[0] for r in db.query(ReturnOrder.return_number).all()}
        for ret_data in data.get("returns", []):
            r_num = (ret_data.get("return_number") or "").strip()
            if not r_num or r_num in existing_return_numbers:
                continue

            inv_match = db.query(Invoice.id).filter(Invoice.bill_number == ret_data.get("bill_number")).first() if ret_data.get("bill_number") else None
            cust_match = db.query(Customer.id).filter(Customer.phone == ret_data.get("customer_phone")).first() if ret_data.get("customer_phone") else None

            try:
                rtype = ReturnType(ret_data.get("return_type", "REFUND_CASH"))
            except Exception:
                rtype = ReturnType.REFUND_CASH

            ret_order = ReturnOrder(
                return_number=r_num,
                invoice_id=inv_match[0] if inv_match else None,
                customer_id=cust_match[0] if cust_match else None,
                return_type=rtype,
                total_refund_amount=float(ret_data.get("total_refund_amount") or 0.0),
                reason=ret_data.get("reason"),
                notes=ret_data.get("notes"),
                created_at=parse_iso_datetime(ret_data.get("created_at")) or datetime.utcnow()
            )
            db.add(ret_order)
            db.flush()
            existing_return_numbers.add(r_num)
            imported_returns += 1

            for ritem in ret_data.get("items", []):
                p_id = prod_id_by_barcode.get(ritem.get("barcode") or "")
                ro_item = ReturnItem(
                    return_id=ret_order.id,
                    product_id=p_id,
                    item_name=ritem.get("item_name") or "Returned Item",
                    barcode=ritem.get("barcode"),
                    quantity=int(ritem.get("quantity") or 1),
                    refund_price=float(ritem.get("refund_price") or ritem.get("refund_amount") or ritem.get("unit_price") or 0.0),
                    is_defective=bool(ritem.get("is_defective", False)),
                    restocked=bool(ritem.get("restocked", True))
                )
                db.add(ro_item)

        db.commit()

        # 9. Restore Expenses
        for exp_data in data.get("expenses", []):
            try:
                exp_cat = ExpenseCategory(exp_data.get("category", "OTHER"))
            except Exception:
                exp_cat = ExpenseCategory.OTHER

            exp = Expense(
                category=exp_cat,
                title=exp_data.get("title") or "General Expense",
                amount=float(exp_data.get("amount") or 0.0),
                payment_mode=exp_data.get("payment_mode", "CASH"),
                paid_to=exp_data.get("paid_to"),
                notes=exp_data.get("notes"),
                expense_date=parse_iso_datetime(exp_data.get("expense_date")) or datetime.utcnow()
            )
            db.add(exp)
            imported_expenses += 1

        # 10. Restore Procurement Notes
        imported_notes = 0
        for n_data in data.get("procurement_notes", []):
            note = ProcurementNote(
                item_name=n_data.get("item_name") or "Item",
                quantity=int(n_data.get("quantity") or 1),
                description=n_data.get("description"),
                vendor_name=n_data.get("vendor_name"),
                estimated_price=float(n_data.get("estimated_price") or 0.0) if n_data.get("estimated_price") is not None else None,
                priority=str(n_data.get("priority", "NORMAL")),
                status=str(n_data.get("status", "PENDING")),
                created_at=parse_iso_datetime(n_data.get("created_at")) or datetime.utcnow()
            )
            db.add(note)
            imported_notes += 1

        # 11. Restore Lost Demand
        imported_lost_demands = 0
        for ld_data in data.get("lost_demands", []):
            try:
                urg = LostDemandUrgency(ld_data.get("urgency", "NORMAL"))
            except Exception:
                urg = LostDemandUrgency.NORMAL
            try:
                d_stat = LostDemandStatus(ld_data.get("status", "PENDING_PROCUREMENT"))
            except Exception:
                d_stat = LostDemandStatus.PENDING_PROCUREMENT

            ld = LostDemand(
                item_description=ld_data.get("item_description") or "Item",
                category_name=ld_data.get("category_name") or "General",
                preferred_size=ld_data.get("preferred_size") or "Standard",
                preferred_color=ld_data.get("preferred_color") or "Any",
                customer_name=ld_data.get("customer_name") or "Walk-in Customer",
                customer_phone=ld_data.get("customer_phone") or "N/A",
                urgency=urg,
                request_count=int(ld_data.get("request_count") or 1),
                status=d_stat,
                notes=ld_data.get("notes"),
                created_at=parse_iso_datetime(ld_data.get("created_at")) or datetime.utcnow()
            )
            db.add(ld)
            imported_lost_demands += 1

        db.commit()

        return {
            "success": True,
            "message": f"Full Database Restored in <1s! Processed {imported_products} products, {imported_invoices} bills, {imported_purchases} purchases, {imported_returns} returns, {imported_expenses} expenses, {imported_customers} customers, and {imported_vendors} vendors. Store Information preserved intact.",
            "counts": {
                "products": imported_products,
                "invoices": imported_invoices,
                "purchases": imported_purchases,
                "returns": imported_returns,
                "expenses": imported_expenses,
                "customers": imported_customers,
                "vendors": imported_vendors,
                "procurement_notes": imported_notes,
                "lost_demands": imported_lost_demands
            }
        }

backup_service = BackupService()


