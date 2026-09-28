import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, Float
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cloud_hub.db")
# Fix postgres URL if provided by Render / Heroku (postgres:// -> postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# -------------------------------------------------------------
# Database Models
# -------------------------------------------------------------
class HubStore(Base):
    __tablename__ = "hub_stores"

    id = Column(Integer, primary_key=True, index=True)
    store_token = Column(String(50), unique=True, index=True, nullable=False)
    store_secret = Column(String(100), nullable=True)
    shop_name = Column(String(150), default="Dolly Store", nullable=False)
    tagline = Column(String(200), nullable=True)
    mobile = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    upi_id = Column(String(100), nullable=True)
    is_online = Column(Boolean, default=False)
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class HubSnapshot(Base):
    __tablename__ = "hub_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    store_token = Column(String(50), index=True, nullable=False)
    period = Column(String(20), default="TODAY", nullable=False)
    data_json = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class HubDemand(Base):
    __tablename__ = "hub_demands"

    id = Column(Integer, primary_key=True, index=True)
    store_token = Column(String(50), index=True, nullable=False)
    item_description = Column(String(255), nullable=False)
    category_name = Column(String(100), nullable=True)
    preferred_size = Column(String(50), nullable=True)
    preferred_color = Column(String(50), nullable=True)
    customer_name = Column(String(100), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    request_count = Column(Integer, default=1)
    notes = Column(Text, nullable=True)
    synced_to_pos = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class HubStoreData(Base):
    __tablename__ = "hub_store_data"

    id = Column(Integer, primary_key=True, index=True)
    store_token = Column(String(50), index=True, nullable=False)
    data_type = Column(String(50), index=True, nullable=False)  # 'INVENTORY', 'KHATA', 'REPORTS', 'CATEGORIES'
    data_json = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------------------------------------------------
# FastAPI App
# -------------------------------------------------------------
app = FastAPI(
    title="Dolly POS Central Cloud Hub",
    description="24/7 Multi-Store Synchronizer & Token Resolver for Dolly POS",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Request Schemas
# -------------------------------------------------------------
class SyncPayload(BaseModel):
    store_id: Optional[str] = "default"
    store_token: str
    store_secret: Optional[str] = None
    shop_name: str
    tagline: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    upi_id: Optional[str] = None
    overview: Optional[Dict[str, Any]] = None
    snapshots: Optional[Dict[str, Any]] = None
    inventory: Optional[Dict[str, Any]] = None
    reports: Optional[Dict[str, Any]] = None
    khata: Optional[Dict[str, Any]] = None
    categories: Optional[List[Dict[str, Any]]] = None
    synced_at: Optional[str] = None

class DemandCreatePayload(BaseModel):
    item_description: str
    category_name: Optional[str] = None
    preferred_size: Optional[str] = None
    preferred_color: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    request_count: Optional[int] = 1
    notes: Optional[str] = None

class PairStoreRequest(BaseModel):
    store_token: str

# -------------------------------------------------------------
# API Endpoints
# -------------------------------------------------------------
@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Dolly POS Central Cloud Hub",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/api/v1/hub/sync")
def sync_from_desktop_pos(payload: SyncPayload, db: Session = Depends(get_db)):
    """
    Called every 30s by Store Desktop POS.
    Saves multi-period snapshots, inventory catalog, khata balances, reports,
    and delivers pending mobile demands to the laptop POS.
    """
    token = payload.store_token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == token).first()

    now = datetime.utcnow()
    if not store:
        store = HubStore(
            store_token=token,
            store_secret=payload.store_secret,
            shop_name=payload.shop_name,
            tagline=payload.tagline,
            mobile=payload.mobile,
            address=payload.address,
            upi_id=payload.upi_id,
            is_online=True,
            last_seen_at=now
        )
        db.add(store)
    else:
        store.shop_name = payload.shop_name
        store.tagline = payload.tagline
        store.mobile = payload.mobile
        store.address = payload.address
        store.upi_id = payload.upi_id
        store.is_online = True
        store.last_seen_at = now

    # 1. Multi-period Snapshots (TODAY, YESTERDAY, WEEK, MONTH, YEAR)
    if payload.snapshots:
        for p_name, s_data in payload.snapshots.items():
            p_upper = p_name.upper()
            snap = db.query(HubSnapshot).filter(
                HubSnapshot.store_token == token,
                HubSnapshot.period == p_upper
            ).first()
            if not snap:
                snap = HubSnapshot(
                    store_token=token,
                    period=p_upper,
                    data_json=json.dumps(s_data)
                )
                db.add(snap)
            else:
                snap.data_json = json.dumps(s_data)
                snap.updated_at = now
    elif payload.overview:
        p_name = payload.overview.get("period", "TODAY").upper()
        snap = db.query(HubSnapshot).filter(
            HubSnapshot.store_token == token,
            HubSnapshot.period == p_name
        ).first()
        if not snap:
            snap = HubSnapshot(
                store_token=token,
                period=p_name,
                data_json=json.dumps(payload.overview)
            )
            db.add(snap)
        else:
            snap.data_json = json.dumps(payload.overview)
            snap.updated_at = now

    # 2. Inventory Catalog Sync
    if payload.inventory is not None:
        inv_record = db.query(HubStoreData).filter(
            HubStoreData.store_token == token,
            HubStoreData.data_type == "INVENTORY"
        ).first()
        if not inv_record:
            inv_record = HubStoreData(
                store_token=token,
                data_type="INVENTORY",
                data_json=json.dumps(payload.inventory)
            )
            db.add(inv_record)
        else:
            inv_record.data_json = json.dumps(payload.inventory)
            inv_record.updated_at = now

    # 3. Khata Customer Balances Sync
    if payload.khata is not None:
        khata_record = db.query(HubStoreData).filter(
            HubStoreData.store_token == token,
            HubStoreData.data_type == "KHATA"
        ).first()
        if not khata_record:
            khata_record = HubStoreData(
                store_token=token,
                data_type="KHATA",
                data_json=json.dumps(payload.khata)
            )
            db.add(khata_record)
        else:
            khata_record.data_json = json.dumps(payload.khata)
            khata_record.updated_at = now

    # 4. Reports Sync
    if payload.reports is not None:
        reports_record = db.query(HubStoreData).filter(
            HubStoreData.store_token == token,
            HubStoreData.data_type == "REPORTS"
        ).first()
        if not reports_record:
            reports_record = HubStoreData(
                store_token=token,
                data_type="REPORTS",
                data_json=json.dumps(payload.reports)
            )
            db.add(reports_record)
        else:
            reports_record.data_json = json.dumps(payload.reports)
            reports_record.updated_at = now

    # 5. Categories Sync
    if payload.categories is not None:
        cat_record = db.query(HubStoreData).filter(
            HubStoreData.store_token == token,
            HubStoreData.data_type == "CATEGORIES"
        ).first()
        if not cat_record:
            cat_record = HubStoreData(
                store_token=token,
                data_type="CATEGORIES",
                data_json=json.dumps(payload.categories)
            )
            db.add(cat_record)
        else:
            cat_record.data_json = json.dumps(payload.categories)
            cat_record.updated_at = now

    # 6. Fetch unsynced mobile demands for this store to deliver to the desktop
    unsynced_demands = db.query(HubDemand).filter(
        HubDemand.store_token == token,
        HubDemand.synced_to_pos == False
    ).all()

    demands_to_deliver = []
    for d in unsynced_demands:
        demands_to_deliver.append({
            "id": d.id,
            "item_description": d.item_description,
            "category_name": d.category_name,
            "preferred_size": d.preferred_size,
            "preferred_color": d.preferred_color,
            "customer_name": d.customer_name,
            "customer_phone": d.customer_phone,
            "request_count": d.request_count,
            "notes": d.notes,
            "created_at": d.created_at.isoformat()
        })
        d.synced_to_pos = True

    db.commit()

    return {
        "status": "success",
        "store_token": token,
        "message": "Store data successfully synced to Cloud Hub.",
        "pending_demands": demands_to_deliver
    }

@app.post("/api/v1/hub/pair")
def pair_store_mobile(payload: PairStoreRequest, db: Session = Depends(get_db)):
    """Validates Store Access Token and returns store details for 1-tap mobile pairing."""
    token = payload.store_token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == token).first()
    if not store:
        raise HTTPException(
            status_code=404,
            detail=f"Store Token '{token}' not found. Please verify the code shown on your Dolly POS laptop screen."
        )

    # Check if laptop is currently online (seen in last 90 seconds)
    is_online = False
    if store.last_seen_at:
        is_online = (datetime.utcnow() - store.last_seen_at) < timedelta(seconds=90)

    return {
        "status": "valid",
        "store_token": store.store_token,
        "shop_name": store.shop_name,
        "tagline": store.tagline,
        "address": store.address,
        "mobile": store.mobile,
        "is_pos_online": is_online,
        "last_seen_at": store.last_seen_at.isoformat() if store.last_seen_at else None
    }

@app.get("/api/v1/hub/stores/{token}/overview")
def get_store_overview_for_mobile(
    token: str,
    period: str = "TODAY",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    24/7 Mobile Overview endpoint.
    Returns latest snapshot even if the store laptop is powered off.
    Falls back to TODAY snapshot if specific period is not found.
    """
    t_clean = token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == t_clean).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found with this token.")

    req_period = period.strip().upper()
    snapshot = db.query(HubSnapshot).filter(
        HubSnapshot.store_token == t_clean,
        HubSnapshot.period == req_period
    ).first()

    # Fallback to TODAY if requested period is not found
    if not snapshot and req_period != "TODAY":
        snapshot = db.query(HubSnapshot).filter(
            HubSnapshot.store_token == t_clean,
            HubSnapshot.period == "TODAY"
        ).first()

    # Determine if POS is currently online
    is_online = False
    if store.last_seen_at:
        is_online = (datetime.utcnow() - store.last_seen_at) < timedelta(seconds=90)

    overview_data = {}
    if snapshot and snapshot.data_json:
        try:
            overview_data = json.loads(snapshot.data_json)
        except Exception:
            overview_data = {}

    # Guarantee essential fields are always present
    overview_data["shop_name"] = store.shop_name
    overview_data["is_pos_online"] = is_online
    overview_data["last_pos_sync"] = store.last_seen_at.isoformat() if store.last_seen_at else None
    
    if "sales" not in overview_data:
        overview_data["sales"] = {
            "gross_sales": 0.0, "net_sales": 0.0, "total_cogs": 0.0,
            "gross_profit": 0.0, "net_profit": 0.0, "margin_percent": 0.0,
            "total_tax": 0.0, "total_discount": 0.0, "bill_count": 0, "average_bill": 0.0
        }
    if "payment_breakdown" not in overview_data:
        overview_data["payment_breakdown"] = {"CASH": 0.0, "UPI": 0.0, "CARD": 0.0, "CREDIT": 0.0}
    if "hourly_velocity" not in overview_data:
        overview_data["hourly_velocity"] = []
    if "top_products" not in overview_data:
        overview_data["top_products"] = []
    if "low_stock_items" not in overview_data:
        overview_data["low_stock_items"] = []
    if "low_stock_count" not in overview_data:
        overview_data["low_stock_count"] = 0
    if "khata_outstanding" not in overview_data:
        overview_data["khata_outstanding"] = 0.0

    return overview_data

@app.get("/api/v1/hub/stores/{token}/inventory")
def get_store_inventory_for_mobile(
    token: str,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    low_stock_only: bool = False,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    24/7 Mobile Inventory Lookup.
    Filters products by search term, category, and low-stock threshold with pagination.
    """
    t_clean = token.strip().upper()
    data_row = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "INVENTORY"
    ).first()

    if not data_row or not data_row.data_json:
        return {
            "page": page,
            "limit": limit,
            "total_count": 0,
            "has_more": False,
            "products": []
        }

    try:
        inv_data = json.loads(data_row.data_json)
        prods = inv_data.get("products", [])
    except Exception:
        prods = []

    # Filtering
    if search and search.strip():
        s = search.strip().lower()
        prods = [p for p in prods if s in str(p.get("name", "")).lower() or s in str(p.get("barcode", "")).lower()]

    if category_id:
        prods = [p for p in prods if p.get("category_id") == category_id]

    if low_stock_only:
        prods = [
            p for p in prods
            if p.get("is_low_stock") is True or (p.get("current_stock", 0) <= p.get("min_stock", 3))
        ]

    total_count = len(prods)
    offset = (page - 1) * limit
    page_prods = prods[offset:offset + limit]

    return {
        "page": page,
        "limit": limit,
        "total_count": total_count,
        "has_more": (offset + len(page_prods)) < total_count,
        "products": page_prods
    }

@app.get("/api/v1/hub/stores/{token}/categories")
def get_store_categories_for_mobile(token: str, db: Session = Depends(get_db)):
    """24/7 Category list for mobile app."""
    t_clean = token.strip().upper()
    data_row = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "CATEGORIES"
    ).first()

    if not data_row or not data_row.data_json:
        return []

    try:
        return json.loads(data_row.data_json)
    except Exception:
        return []

@app.get("/api/v1/hub/stores/{token}/khata")
def get_store_khata_for_mobile(
    token: str,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """24/7 Customer Khata / Udhar ledger for mobile app."""
    t_clean = token.strip().upper()
    data_row = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "KHATA"
    ).first()

    if not data_row or not data_row.data_json:
        return {
            "total_customers": 0,
            "total_outstanding": 0.0,
            "customers": []
        }

    try:
        khata_data = json.loads(data_row.data_json)
        custs = khata_data.get("customers", [])
    except Exception:
        custs = []

    if search and isinstance(search, str) and search.strip():
        s = search.strip().lower()
        custs = [c for c in custs if s in str(c.get("name", "")).lower() or s in str(c.get("phone", "")).lower()]

    total_outstanding = sum(float(c.get("balance", 0.0)) for c in custs)

    return {
        "total_customers": len(custs),
        "total_outstanding": round(total_outstanding, 2),
        "customers": custs
    }

@app.get("/api/v1/hub/stores/{token}/reports")
def get_store_reports_for_mobile(
    token: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    report_type: str = "SALES",
    db: Session = Depends(get_db)
):
    """
    24/7 Reports Studio endpoint for Mobile App.
    Handles SALES, PAYMENTS, CATEGORIES, EXPENSES, DAMAGED, and PLANNER reports.
    """
    t_clean = token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == t_clean).first()
    store_title = store.shop_name if store else "Dolly Store"

    rep_upper = report_type.strip().upper()

    data_row = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "REPORTS"
    ).first()

    reports_data: Dict[str, Any] = {}
    if data_row and data_row.data_json:
        try:
            reports_data = json.loads(data_row.data_json)
        except Exception:
            reports_data = {}

    s_str = start_date or ""
    e_str = end_date or ""

    # 1. SALES REGISTER
    if rep_upper == "SALES":
        invoices = reports_data.get("sales_invoices", [])
        if s_str and e_str:
            invoices = [inv for inv in invoices if s_str <= inv.get("date_ymd", "") <= e_str]

        total_gross = sum(float(inv.get("gross_amount", 0.0)) for inv in invoices)
        total_net = sum(float(inv.get("net_amount", 0.0)) for inv in invoices)
        total_discount = sum(float(inv.get("discount", 0.0)) for inv in invoices)
        total_tax = sum(float(inv.get("tax", 0.0)) for inv in invoices)
        unique_dates = len(set(inv.get("date_ymd", "") for inv in invoices)) or 1

        return {
            "report_type": "SALES",
            "title": f"Sales Register ({s_str or 'All'} to {e_str or 'All'})",
            "store_name": store_title,
            "start_date": s_str,
            "end_date": e_str,
            "summary": {
                "total_bills": len(invoices),
                "total_gross": round(total_gross, 2),
                "total_discount": round(total_discount, 2),
                "total_tax": round(total_tax, 2),
                "total_net": round(total_net, 2),
                "avg_daily_sales": round(total_net / unique_dates, 2)
            },
            "columns": ["Date", "Bill #", "Customer", "Payment Mode", "Gross (₹)", "Discount", "Tax", "Net Amount (₹)"],
            "rows": invoices
        }

    # 2. PAYMENTS BREAKDOWN
    elif rep_upper == "PAYMENTS":
        payments = reports_data.get("payments", [])
        if s_str and e_str:
            payments = [p for p in payments if s_str <= p.get("date_ymd", "") <= e_str]

        mode_stats = {
            "CASH": {"mode": "Cash Counter", "bills": 0, "amount": 0.0},
            "UPI": {"mode": "UPI / QR / Online", "bills": 0, "amount": 0.0},
            "CARD": {"mode": "Card / EDC POS", "bills": 0, "amount": 0.0},
            "CREDIT": {"mode": "Khata Udhar Dues", "bills": 0, "amount": 0.0},
        }
        total_collected = 0.0
        for p in payments:
            m = str(p.get("payment_mode", "")).upper()
            amt = float(p.get("amount", 0.0))
            total_collected += amt
            if "CASH" in m:
                mode_stats["CASH"]["bills"] += 1
                mode_stats["CASH"]["amount"] += amt
            elif "UPI" in m or "ONLINE" in m:
                mode_stats["UPI"]["bills"] += 1
                mode_stats["UPI"]["amount"] += amt
            elif "CARD" in m:
                mode_stats["CARD"]["bills"] += 1
                mode_stats["CARD"]["amount"] += amt
            else:
                mode_stats["CREDIT"]["bills"] += 1
                mode_stats["CREDIT"]["amount"] += amt

        rows = []
        for k, v in mode_stats.items():
            pct = round((v["amount"] / total_collected * 100), 1) if total_collected > 0 else 0.0
            rows.append({
                "mode": v["mode"],
                "bills": v["bills"],
                "amount": round(v["amount"], 2),
                "share_pct": pct
            })

        return {
            "report_type": "PAYMENTS",
            "title": f"Payment Mode Analysis ({s_str or 'All'} to {e_str or 'All'})",
            "store_name": store_title,
            "start_date": s_str,
            "end_date": e_str,
            "summary": {
                "total_collected": round(total_collected, 2),
                "total_transactions": len(payments)
            },
            "columns": ["Payment Channel", "Bills", "Amount (₹)", "Share %"],
            "rows": rows
        }

    # 3. CATEGORIES SALES
    elif rep_upper == "CATEGORIES":
        cats = reports_data.get("categories", [])
        total_rev = sum(float(c.get("revenue", 0.0)) for c in cats)
        for c in cats:
            rev = float(c.get("revenue", 0.0))
            c["share_pct"] = round((rev / total_rev * 100), 1) if total_rev > 0 else 0.0

        return {
            "report_type": "CATEGORIES",
            "title": f"Category Performance ({s_str or 'All'} to {e_str or 'All'})",
            "store_name": store_title,
            "start_date": s_str,
            "end_date": e_str,
            "summary": {
                "total_categories": len(cats),
                "total_revenue": round(total_rev, 2)
            },
            "columns": ["Category", "Items Sold", "Revenue (₹)", "Share %"],
            "rows": cats
        }

    # 4. EXPENSES REGISTER
    elif rep_upper == "EXPENSES":
        expenses = reports_data.get("expenses", [])
        if s_str and e_str:
            expenses = [e for e in expenses if s_str <= e.get("date_ymd", "") <= e_str]

        total_exp = sum(float(e.get("amount", 0.0)) for e in expenses)

        return {
            "report_type": "EXPENSES",
            "title": f"Expenses Register ({s_str or 'All'} to {e_str or 'All'})",
            "store_name": store_title,
            "start_date": s_str,
            "end_date": e_str,
            "summary": {
                "total_entries": len(expenses),
                "total_expense": round(total_exp, 2)
            },
            "columns": ["Date", "Category", "Description", "Mode", "Amount (₹)"],
            "rows": expenses
        }

    # 5. DAMAGED GOODS
    elif rep_upper == "DAMAGED":
        damaged = reports_data.get("damaged", [])
        total_dmg_units = sum(int(d.get("damaged_quantity", 0)) for d in damaged)
        total_cost_loss = sum(float(d.get("total_loss", 0.0)) for d in damaged)

        return {
            "report_type": "DAMAGED",
            "title": "Damaged Goods Valuation",
            "store_name": store_title,
            "start_date": s_str,
            "end_date": e_str,
            "summary": {
                "damaged_products_count": len(damaged),
                "total_damaged_units": total_dmg_units,
                "total_cost_loss": round(total_cost_loss, 2)
            },
            "columns": ["Product", "Barcode", "Damaged Qty", "Cost (₹)", "Selling (₹)", "Total Loss (₹)"],
            "rows": damaged
        }

    # 6. REORDER & DEMAND PLANNER
    elif rep_upper == "PLANNER":
        planner = reports_data.get("planner", [])
        total_suggested = sum(int(p.get("suggested_order", 0)) for p in planner)

        return {
            "report_type": "PLANNER",
            "title": "Demand & Reorder Planner",
            "store_name": store_title,
            "start_date": s_str,
            "end_date": e_str,
            "summary": {
                "critical_items_count": len(planner),
                "total_suggested_units": total_suggested
            },
            "columns": ["Product", "Barcode", "Stock", "Alert Level", "Suggested Order", "Est. Cost (₹)"],
            "rows": planner
        }

    else:
        # Fallback empty report
        return {
            "report_type": rep_upper,
            "title": f"{rep_upper} Report",
            "store_name": store_title,
            "start_date": s_str,
            "end_date": e_str,
            "summary": {},
            "columns": [],
            "rows": []
        }

@app.get("/api/v1/hub/stores/{token}/status")
def get_store_status_for_mobile(token: str, db: Session = Depends(get_db)):
    """Heartbeat endpoint for mobile app connection indicator."""
    t_clean = token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == t_clean).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found.")

    is_online = False
    if store.last_seen_at:
        is_online = (datetime.utcnow() - store.last_seen_at) < timedelta(seconds=90)

    return {
        "store_token": store.store_token,
        "shop_name": store.shop_name,
        "is_pos_online": is_online,
        "last_seen_at": store.last_seen_at.isoformat() if store.last_seen_at else None
    }

@app.get("/api/v1/hub/stores/{token}/demands")
def get_store_demands_for_mobile(token: str, db: Session = Depends(get_db)):
    """Returns demand planner logs for this store."""
    t_clean = token.strip().upper()
    demands = db.query(HubDemand).filter(
        HubDemand.store_token == t_clean
    ).order_by(HubDemand.created_at.desc()).limit(100).all()

    items = []
    for d in demands:
        items.append({
            "id": d.id,
            "item_description": d.item_description,
            "category_name": d.category_name,
            "preferred_size": d.preferred_size,
            "preferred_color": d.preferred_color,
            "customer_name": d.customer_name,
            "customer_phone": d.customer_phone,
            "request_count": d.request_count,
            "status": "ORDERED_WITH_VENDOR" if d.synced_to_pos else "PENDING_PROCUREMENT",
            "notes": d.notes,
            "created_at": d.created_at.isoformat()
        })
    return {"demands": items}

@app.post("/api/v1/hub/stores/{token}/demands")
def create_store_demand_from_mobile(
    token: str,
    payload: DemandCreatePayload,
    db: Session = Depends(get_db)
):
    """Allows remote logging of customer request / demand from mobile companion."""
    t_clean = token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == t_clean).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found.")

    demand = HubDemand(
        store_token=t_clean,
        item_description=payload.item_description.strip(),
        category_name=payload.category_name,
        preferred_size=payload.preferred_size,
        preferred_color=payload.preferred_color,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        request_count=payload.request_count or 1,
        notes=payload.notes or "Logged remotely from Dolly POS Mobile App",
        synced_to_pos=False
    )
    db.add(demand)
    db.commit()
    db.refresh(demand)

    return {
        "status": "success",
        "message": "Demand logged! Will sync to Dolly POS laptop on next sync cycle.",
        "id": demand.id
    }

@app.get("/api/v1/hub/version/check")
def check_for_updates(client_type: str = "desktop", current_version: str = "1.0.0"):
    """
    Version & update feed for 1-click desktop and mobile updates.
    """
    LATEST_DESKTOP_VERSION = "1.0.0"
    LATEST_MOBILE_VERSION = "1.0.0"

    if client_type == "mobile":
        has_update = current_version != LATEST_MOBILE_VERSION
        return {
            "has_update": has_update,
            "latest_version": LATEST_MOBILE_VERSION,
            "release_notes": "Improved mobile loading speed, eliminated UI jitter, and added 24/7 Cloud Hub sync.",
            "download_url": "https://expo.dev/artifacts/eas"
        }
    else:
        has_update = current_version != LATEST_DESKTOP_VERSION
        return {
            "has_update": has_update,
            "latest_version": LATEST_DESKTOP_VERSION,
            "release_notes": "Multi-Store Hybrid Cloud Sync and single installer support.",
            "download_url": ""
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
