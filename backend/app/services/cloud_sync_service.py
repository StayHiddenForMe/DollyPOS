import os
import time
import requests
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.settings import StoreSettings
from app.models.invoice import Invoice, InvoiceItem, Payment, PaymentMode
from app.models.product import Product
from app.models.expense import Expense
from app.models.customer import Customer
from app.models.lost_demand import LostDemand, LostDemandStatus, LostDemandUrgency

IST_OFFSET = timedelta(hours=5, minutes=30)

def get_ist_now() -> datetime:
    return datetime.utcnow() + IST_OFFSET

def get_utc_range_for_ist(start_date_str: str, end_date_str: str) -> tuple[datetime, datetime]:
    s_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    e_date = datetime.combine(datetime.strptime(end_date_str, "%Y-%m-%d").date(), datetime.max.time())
    return s_date - IST_OFFSET, e_date - IST_OFFSET

class CloudSyncService:
    @staticmethod
    def build_overview_snapshot(db: Session, period: str = "TODAY") -> Dict[str, Any]:
        """Builds high-performance overview snapshot for cloud distribution."""
        ist_now = get_ist_now()
        today_ist = ist_now.date()

        p_upper = period.upper()
        if p_upper == "YESTERDAY":
            y_date = today_ist - timedelta(days=1)
            s_str = y_date.strftime("%Y-%m-%d")
            e_str = s_str
            date_label = f"Yesterday • {y_date.strftime('%d %b %Y')}"
        elif p_upper == "WEEK":
            w_start = today_ist - timedelta(days=7)
            s_str = w_start.strftime("%Y-%m-%d")
            e_str = today_ist.strftime("%Y-%m-%d")
            date_label = f"Last 7 Days ({w_start.strftime('%d %b')} – {today_ist.strftime('%d %b %Y')})"
        elif p_upper == "MONTH":
            m_start = date(today_ist.year, today_ist.month, 1)
            s_str = m_start.strftime("%Y-%m-%d")
            e_str = today_ist.strftime("%Y-%m-%d")
            date_label = f"This Month ({today_ist.strftime('%B %Y')})"
        elif p_upper == "YEAR":
            yr_start = date(today_ist.year, 1, 1)
            s_str = yr_start.strftime("%Y-%m-%d")
            e_str = today_ist.strftime("%Y-%m-%d")
            date_label = f"This Year ({today_ist.year})"
        else:
            s_str = today_ist.strftime("%Y-%m-%d")
            e_str = s_str
            date_label = f"Today • {today_ist.strftime('%d %b %Y')}"

        st = db.query(StoreSettings).first()
        live_shop_name = st.shop_name if st and st.shop_name else "Dolly Toys & Kids Wear"

        s_utc, e_utc = get_utc_range_for_ist(s_str, e_str)

        # Invoices Query
        invoices = db.query(Invoice).filter(
            Invoice.created_at >= s_utc,
            Invoice.created_at <= e_utc,
            Invoice.is_cancelled == False
        ).all()

        bill_count = len(invoices)
        gross_sales = float(sum(inv.subtotal or inv.grand_total for inv in invoices))
        net_sales = float(sum(inv.grand_total for inv in invoices))
        total_tax = float(sum(inv.tax_amount or 0.0 for inv in invoices))
        total_discount = float(sum(inv.discount_amount or 0.0 for inv in invoices))
        avg_bill = round(net_sales / bill_count, 2) if bill_count > 0 else 0.0

        invoice_ids = [inv.id for inv in invoices]
        total_cogs = 0.0
        if invoice_ids:
            cogs_query = (
                db.query(func.coalesce(func.sum(InvoiceItem.quantity * InvoiceItem.cost_price), 0.0))
                .filter(InvoiceItem.invoice_id.in_(invoice_ids))
                .scalar()
            )
            total_cogs = float(cogs_query or 0.0)

        gross_profit = round(net_sales - total_cogs, 2)
        margin_percent = round((gross_profit / net_sales * 100), 1) if net_sales > 0 else 0.0

        period_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).filter(
            Expense.expense_date >= s_utc,
            Expense.expense_date <= e_utc
        ).scalar()
        period_expenses_val = round(float(period_expenses or 0.0), 2)
        net_profit = round(gross_profit - period_expenses_val, 2)

        # Payment Modes Breakdown
        payment_modes = {"CASH": 0.0, "UPI": 0.0, "CARD": 0.0, "CREDIT": 0.0}
        invoices_with_payments = set()
        if invoice_ids:
            payments = db.query(Payment).filter(Payment.invoice_id.in_(invoice_ids)).all()
            for p in payments:
                invoices_with_payments.add(p.invoice_id)
                mode_str = str(p.payment_mode.value if hasattr(p.payment_mode, "value") else p.payment_mode).upper()
                if "CASH" in mode_str:
                    payment_modes["CASH"] += float(p.amount)
                elif "UPI" in mode_str or "ONLINE" in mode_str:
                    payment_modes["UPI"] += float(p.amount)
                elif "CARD" in mode_str:
                    payment_modes["CARD"] += float(p.amount)
                elif "CREDIT" in mode_str or "KHATA" in mode_str:
                    payment_modes["CREDIT"] += float(p.amount)
                else:
                    payment_modes["CASH"] += float(p.amount)

        for inv in invoices:
            if inv.id not in invoices_with_payments:
                mode_str = str(inv.payment_mode.value if hasattr(inv.payment_mode, "value") else inv.payment_mode).upper()
                amt = float(inv.grand_total)
                if "CASH" in mode_str:
                    payment_modes["CASH"] += amt
                elif "UPI" in mode_str or "ONLINE" in mode_str:
                    payment_modes["UPI"] += amt
                elif "CARD" in mode_str:
                    payment_modes["CARD"] += amt
                elif "CREDIT" in mode_str or "KHATA" in mode_str:
                    payment_modes["CREDIT"] += amt
                else:
                    payment_modes["CASH"] += amt

        # Low stock count
        low_stock_count = db.query(Product).filter(
            Product.is_active == True,
            Product.stock_quantity <= Product.min_stock_alert
        ).count()

        # Khata outstanding
        khata_total = db.query(func.coalesce(func.sum(Customer.credit_balance), 0.0)).scalar()

        return {
            "shop_name": live_shop_name,
            "period": p_upper,
            "date_str": date_label,
            "start_date": s_str,
            "end_date": e_str,
            "last_updated": ist_now.strftime("%I:%M:%S %p"),
            "sales": {
                "gross_sales": gross_sales,
                "net_sales": net_sales,
                "total_cogs": total_cogs,
                "gross_profit": gross_profit,
                "net_profit": net_profit,
                "margin_percent": margin_percent,
                "total_tax": total_tax,
                "total_discount": total_discount,
                "bill_count": bill_count,
                "average_bill": avg_bill
            },
            "period_expenses": period_expenses_val,
            "payment_breakdown": payment_modes,
            "low_stock_count": low_stock_count,
            "khata_outstanding": float(khata_total or 0.0)
        }

    @classmethod
    def sync_to_cloud(cls, db: Session, force: bool = False) -> Dict[str, Any]:
        """
        Executes a background push to Cloud Hub.
        Segregated by store_token. Never crashes or blocks local billing.
        """
        st = db.query(StoreSettings).first()
        if not st:
            return {"status": "skipped", "message": "No store settings configured."}

        if not getattr(st, "cloud_sync_enabled", True) and not force:
            return {"status": "disabled", "message": "Cloud sync is disabled in settings."}

        hub_url = getattr(st, "cloud_hub_url", "").strip().rstrip("/")
        store_token = getattr(st, "store_token", None)
        store_secret = getattr(st, "store_secret", None)

        if not hub_url or not store_token:
            return {
                "status": "unconfigured",
                "message": "Store Access Token or Cloud Hub URL is not set."
            }

        try:
            # Build current today snapshot
            snapshot_today = cls.build_overview_snapshot(db, "TODAY")
            
            payload = {
                "store_id": getattr(st, "store_id", "default"),
                "store_token": store_token,
                "store_secret": store_secret,
                "shop_name": st.shop_name,
                "tagline": st.tag_line,
                "mobile": st.mobile,
                "address": st.address,
                "upi_id": st.upi_id,
                "overview": snapshot_today,
                "synced_at": datetime.utcnow().isoformat()
            }

            sync_endpoint = f"{hub_url}/api/v1/hub/sync"
            response = requests.post(
                sync_endpoint,
                json=payload,
                timeout=6.0,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code in [200, 201]:
                res_data = response.json()
                
                # Check for pending demands logged from mobile app to pull down to local DB
                pending_demands = res_data.get("pending_demands", [])
                pulled_demands_count = 0
                for d in pending_demands:
                    desc_text = d.get("item_description", "").strip()
                    if desc_text:
                        existing = db.query(LostDemand).filter(
                            LostDemand.item_description == desc_text,
                            LostDemand.customer_phone == d.get("customer_phone")
                        ).first()
                        if not existing:
                            new_demand = LostDemand(
                                item_description=desc_text,
                                category_name=d.get("category_name"),
                                preferred_size=d.get("preferred_size"),
                                preferred_color=d.get("preferred_color"),
                                customer_name=d.get("customer_name"),
                                customer_phone=d.get("customer_phone"),
                                request_count=d.get("request_count", 1),
                                notes=d.get("notes") or "Logged remotely from Dolly POS Mobile App"
                            )
                            db.add(new_demand)
                            pulled_demands_count += 1
                
                if pulled_demands_count > 0:
                    db.commit()

                st.last_cloud_sync_at = datetime.utcnow()
                st.cloud_sync_status = "SUCCESS"
                st.cloud_sync_error = None
                db.commit()

                return {
                    "status": "success",
                    "synced_at": st.last_cloud_sync_at.isoformat(),
                    "store_token": store_token,
                    "demands_pulled": pulled_demands_count,
                    "message": "Store data successfully synced to Cloud Hub."
                }
            else:
                error_msg = f"Cloud Hub returned HTTP {response.status_code}: {response.text[:200]}"
                st.cloud_sync_status = "ERROR"
                st.cloud_sync_error = error_msg
                db.commit()
                return {"status": "error", "message": error_msg}

        except requests.exceptions.RequestException as e:
            # Network failure / Hub unreachable - fail gracefully without blocking
            error_msg = f"Cannot reach Cloud Hub ({hub_url}): {str(e)[:150]}"
            st.cloud_sync_status = "OFFLINE"
            st.cloud_sync_error = error_msg
            try:
                db.commit()
            except Exception:
                db.rollback()
            return {"status": "offline", "message": error_msg}
        except Exception as e:
            error_msg = f"Unexpected cloud sync error: {str(e)[:150]}"
            st.cloud_sync_status = "ERROR"
            st.cloud_sync_error = error_msg
            try:
                db.commit()
            except Exception:
                db.rollback()
            return {"status": "error", "message": error_msg}

cloud_sync_service = CloudSyncService()
