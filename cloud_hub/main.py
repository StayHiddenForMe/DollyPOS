import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, Float, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.path.join(BASE_DIR, "cloud_hub.db").replace("\\", "/")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB}")
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
    status = Column(String(50), default="PENDING_PROCUREMENT", nullable=True)
    notes = Column(Text, nullable=True)
    synced_to_pos = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class HubPendingProduct(Base):
    __tablename__ = "hub_pending_products"

    id = Column(Integer, primary_key=True, index=True)
    store_token = Column(String(50), index=True, nullable=False)
    name = Column(String(200), nullable=False)
    barcode = Column(String(100), nullable=True)
    category_id = Column(Integer, nullable=True)
    purchase_price = Column(Float, default=0.0)
    selling_price = Column(Float, default=0.0)
    mrp = Column(Float, nullable=True)
    stock_quantity = Column(Integer, default=1)
    min_stock_alert = Column(Integer, default=3)
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

# Safe schema upgrade check
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE hub_demands ADD COLUMN status VARCHAR(50) DEFAULT 'PENDING_PROCUREMENT'"))
        conn.commit()
except Exception:
    pass

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
    demands: Optional[List[Dict[str, Any]]] = None
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

class DemandStatusUpdatePayload(BaseModel):
    status: str

class MobileProductCreatePayload(BaseModel):
    name: str
    barcode: Optional[str] = None
    category_id: Optional[int] = None
    purchase_price: float = 0.0
    selling_price: float = 0.0
    mrp: Optional[float] = None
    stock_quantity: int = 1
    min_stock_alert: int = 3

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

    if payload.demands is not None:
        dem_record = db.query(HubStoreData).filter(
            HubStoreData.store_token == token,
            HubStoreData.data_type == "DEMANDS"
        ).first()
        if not dem_record:
            dem_record = HubStoreData(
                store_token=token,
                data_type="DEMANDS",
                data_json=json.dumps(payload.demands)
            )
            db.add(dem_record)
        else:
            dem_record.data_json = json.dumps(payload.demands)
            dem_record.updated_at = now

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

    # 7. Fetch unsynced mobile products for this store to deliver to the desktop
    unsynced_prods = db.query(HubPendingProduct).filter(
        HubPendingProduct.store_token == token,
        HubPendingProduct.synced_to_pos == False
    ).all()

    products_to_deliver = []
    for p in unsynced_prods:
        products_to_deliver.append({
            "id": p.id,
            "name": p.name,
            "barcode": p.barcode,
            "category_id": p.category_id,
            "purchase_price": p.purchase_price,
            "selling_price": p.selling_price,
            "mrp": p.mrp,
            "stock_quantity": p.stock_quantity,
            "min_stock_alert": p.min_stock_alert,
        })
        p.synced_to_pos = True

    db.commit()

    return {
        "status": "success",
        "store_token": token,
        "message": "Store data successfully synced to Cloud Hub.",
        "pending_demands": demands_to_deliver,
        "pending_products": products_to_deliver
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

    # Determine if POS is currently online
    is_online = False
    if store.last_seen_at:
        is_online = (datetime.utcnow() - store.last_seen_at) < timedelta(seconds=90)

    req_period = period.strip().upper()
    overview_data = {}

    if req_period == "CUSTOM" and start_date and end_date:
        data_row = db.query(HubStoreData).filter(
            HubStoreData.store_token == t_clean,
            HubStoreData.data_type == "REPORTS"
        ).first()
        if data_row and data_row.data_json:
            try:
                rep_data = json.loads(data_row.data_json)
                all_invs = rep_data.get("sales_invoices", [])
                filtered_invs = [inv for inv in all_invs if start_date <= inv.get("date_ymd", "") <= end_date]
                
                b_count = len(filtered_invs)
                g_sales = sum(float(inv.get("gross_amount", 0.0)) for inv in filtered_invs)
                n_sales = sum(float(inv.get("net_amount", 0.0)) for inv in filtered_invs)
                t_disc = sum(float(inv.get("discount", 0.0)) for inv in filtered_invs)
                t_tax = sum(float(inv.get("tax", 0.0)) for inv in filtered_invs)
                avg_b = round(n_sales / b_count, 2) if b_count > 0 else 0.0

                pmt_modes = {"CASH": 0.0, "UPI": 0.0, "CARD": 0.0, "CREDIT": 0.0}
                for inv in filtered_invs:
                    m = str(inv.get("payment_mode", "CASH")).upper()
                    amt = float(inv.get("net_amount", 0.0))
                    if "CASH" in m: pmt_modes["CASH"] += amt
                    elif "UPI" in m or "ONLINE" in m: pmt_modes["UPI"] += amt
                    elif "CARD" in m: pmt_modes["CARD"] += amt
                    elif "CREDIT" in m or "KHATA" in m: pmt_modes["CREDIT"] += amt
                    else: pmt_modes["CASH"] += amt

                for k in pmt_modes:
                    pmt_modes[k] = round(pmt_modes[k], 2)

                all_exps = rep_data.get("expenses", [])
                filtered_exps = [e for e in all_exps if start_date <= e.get("date_ymd", "") <= end_date]
                exp_total = sum(float(e.get("amount", 0.0)) for e in filtered_exps)

                overview_data = {
                    "period": "CUSTOM",
                    "date_str": f"{start_date} to {end_date}",
                    "start_date": start_date,
                    "end_date": end_date,
                    "sales": {
                        "gross_sales": round(g_sales, 2),
                        "net_sales": round(n_sales, 2),
                        "total_cogs": 0.0,
                        "gross_profit": round(n_sales, 2),
                        "net_profit": round(n_sales - exp_total, 2),
                        "margin_percent": 100.0 if n_sales > 0 else 0.0,
                        "total_tax": round(t_tax, 2),
                        "total_discount": round(t_disc, 2),
                        "bill_count": b_count,
                        "average_bill": avg_b
                    },
                    "period_expenses": round(exp_total, 2),
                    "payment_breakdown": pmt_modes,
                    "hourly_velocity": [],
                    "top_products": [],
                    "low_stock_items": [],
                    "low_stock_count": 0,
                    "khata_outstanding": 0.0
                }
            except Exception:
                overview_data = {}

    if not overview_data:
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
        daily_sales = reports_data.get("daily_sales", {})
        invoices = reports_data.get("sales_invoices", [])
        if s_str and e_str:
            invoices = [inv for inv in invoices if s_str <= inv.get("date_ymd", "") <= e_str]

        # Use complete daily_sales aggregates if available for 100% precision
        if daily_sales:
            filtered_days = [v for k, v in daily_sales.items() if (not s_str or k >= s_str) and (not e_str or k <= e_str)]
            total_bills = sum(d.get("bills", 0) for d in filtered_days)
            total_gross = sum(float(d.get("gross", 0.0)) for d in filtered_days)
            total_net = sum(float(d.get("net", 0.0)) for d in filtered_days)
            total_discount = sum(float(d.get("discount", 0.0)) for d in filtered_days)
            total_tax = sum(float(d.get("tax", 0.0)) for d in filtered_days)
            unique_dates = len(filtered_days) or 1
        else:
            total_bills = len(invoices)
            total_gross = sum(float(inv.get("gross_amount", 0.0)) for inv in invoices)
            total_net = sum(float(inv.get("net_amount", 0.0)) for inv in invoices)
            total_discount = sum(float(inv.get("discount", 0.0)) for inv in invoices)
            total_tax = sum(float(inv.get("tax", 0.0)) for inv in invoices)
            unique_dates = len(set(inv.get("date_ymd", "") for inv in invoices)) or 1

        # Cap preview rows to 150 to prevent Android OutOfMemory crashes on large datasets
        preview_rows = invoices[:150]

        return {
            "report_type": "SALES",
            "title": f"Sales Register ({s_str or 'All'} to {e_str or 'All'})",
            "store_name": store_title,
            "start_date": s_str,
            "end_date": e_str,
            "summary": {
                "total_bills": total_bills,
                "total_gross": round(total_gross, 2),
                "total_discount": round(total_discount, 2),
                "total_tax": round(total_tax, 2),
                "total_net": round(total_net, 2),
                "avg_daily_sales": round(total_net / unique_dates, 2)
            },
            "columns": ["Date", "Bill #", "Customer", "Payment Mode", "Gross (₹)", "Discount", "Tax", "Net Amount (₹)"],
            "rows": preview_rows,
            "total_rows": total_bills,
            "is_truncated": total_bills > 150
        }

    # 2. PAYMENTS BREAKDOWN
    elif rep_upper == "PAYMENTS":
        daily_payments = reports_data.get("daily_payments", {})
        mode_stats = {
            "CASH": {"mode": "Cash Counter", "bills": 0, "amount": 0.0},
            "UPI": {"mode": "UPI / QR / Online", "bills": 0, "amount": 0.0},
            "CARD": {"mode": "Card / EDC POS", "bills": 0, "amount": 0.0},
            "CREDIT": {"mode": "Khata Udhar Dues", "bills": 0, "amount": 0.0},
        }
        total_collected = 0.0
        total_transactions = 0

        if daily_payments:
            filtered_pmts = [v for k, v in daily_payments.items() if (not s_str or k >= s_str) and (not e_str or k <= e_str)]
            for dp in filtered_pmts:
                total_transactions += dp.get("bills", 0)
                for m in ["CASH", "UPI", "CARD", "CREDIT"]:
                    amt = float(dp.get(m, 0.0))
                    mode_stats[m]["amount"] += amt
                    total_collected += amt
                    if amt > 0:
                        mode_stats[m]["bills"] += dp.get("bills", 0)
        else:
            payments = reports_data.get("payments", [])
            if s_str and e_str:
                payments = [p for p in payments if s_str <= p.get("date_ymd", "") <= e_str]
            total_transactions = len(payments)
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
                "total_transactions": total_transactions
            },
            "columns": ["Payment Channel", "Bills", "Amount (₹)", "Share %"],
            "rows": rows
        }

    # 3. CATEGORIES SALES
    elif rep_upper == "CATEGORIES":
        daily_categories = reports_data.get("daily_categories", {})
        if daily_categories:
            filtered_cats = [v for k, v in daily_categories.items() if (not s_str or k >= s_str) and (not e_str or k <= e_str)]
            cat_totals = {}
            for day_dict in filtered_cats:
                for cname, cdata in day_dict.items():
                    if cname not in cat_totals:
                        cat_totals[cname] = {"category": cname, "items_sold": 0, "revenue": 0.0}
                    cat_totals[cname]["items_sold"] += cdata.get("qty", 0)
                    cat_totals[cname]["revenue"] += cdata.get("rev", 0.0)

            cats = sorted(cat_totals.values(), key=lambda x: x["revenue"], reverse=True)
            total_rev = sum(c["revenue"] for c in cats)
            for c in cats:
                c["revenue"] = round(c["revenue"], 2)
                c["share_pct"] = round((c["revenue"] / total_rev * 100), 1) if total_rev > 0 else 0.0
        else:
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
def get_store_demands_for_mobile(
    token: str,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Returns demand planner logs for this store, combining desktop POS logs and mobile entries."""
    t_clean = token.strip().upper()

    # 1. Fetch desktop-synced demands
    dem_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "DEMANDS"
    ).first()
    desktop_demands = []
    if dem_record and dem_record.data_json:
        try:
            desktop_demands = json.loads(dem_record.data_json)
        except Exception:
            desktop_demands = []

    # 2. Fetch mobile-created demands
    mobile_demands = db.query(HubDemand).filter(
        HubDemand.store_token == t_clean
    ).order_by(HubDemand.created_at.desc()).limit(100).all()

    items = []
    seen_keys = set()
    for d in mobile_demands:
        key = (d.item_description.strip().lower(), (d.customer_phone or "").strip())
        seen_keys.add(key)
        cur_status = d.status or ("ORDERED_WITH_VENDOR" if d.synced_to_pos else "PENDING_PROCUREMENT")
        items.append({
            "id": d.id,
            "item_description": d.item_description,
            "category_name": d.category_name,
            "preferred_size": d.preferred_size,
            "preferred_color": d.preferred_color,
            "customer_name": d.customer_name,
            "customer_phone": d.customer_phone,
            "request_count": d.request_count,
            "urgency": "NORMAL",
            "status": cur_status,
            "notes": d.notes,
            "created_at": d.created_at.isoformat() if d.created_at else None
        })

    for dd in desktop_demands:
        key = (dd.get("item_description", "").strip().lower(), (dd.get("customer_phone") or "").strip())
        if key not in seen_keys:
            items.append(dd)
            seen_keys.add(key)

    if status and status != "ALL":
        items = [d for d in items if str(d.get("status", "")).upper() == status.upper()]

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
        status="PENDING_PROCUREMENT",
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

@app.put("/api/v1/hub/stores/{token}/demands/{demand_id}/status")
def update_store_demand_status(
    token: str,
    demand_id: int,
    payload: DemandStatusUpdatePayload,
    db: Session = Depends(get_db)
):
    """Updates status of a customer demand request from mobile app."""
    t_clean = token.strip().upper()
    new_status = payload.status.strip()

    # 1. Update in mobile demands table if present
    d = db.query(HubDemand).filter(
        HubDemand.store_token == t_clean,
        HubDemand.id == demand_id
    ).first()
    if d:
        d.status = new_status
        db.commit()
        return {"status": "success", "message": f"Demand status updated to {new_status}"}

    # 2. Update in desktop-synced demands JSON cache
    dem_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "DEMANDS"
    ).first()
    if dem_record and dem_record.data_json:
        try:
            d_list = json.loads(dem_record.data_json)
            updated = False
            for item in d_list:
                if item.get("id") == demand_id:
                    item["status"] = new_status
                    updated = True
                    break
            if updated:
                dem_record.data_json = json.dumps(d_list)
                db.commit()
                return {"status": "success", "message": f"Demand status updated to {new_status}"}
        except Exception:
            pass

    return {"status": "success", "message": f"Demand status recorded as {new_status}"}

@app.delete("/api/v1/hub/stores/{token}/demands/{demand_id}")
def delete_store_demand(
    token: str,
    demand_id: int,
    db: Session = Depends(get_db)
):
    """Deletes a customer demand entry from the Cloud Hub."""
    t_clean = token.strip().upper()

    # 1. Delete from mobile demands
    deleted_mobile = db.query(HubDemand).filter(
        HubDemand.store_token == t_clean,
        HubDemand.id == demand_id
    ).delete()
    if deleted_mobile:
        db.commit()
        return {"status": "success", "message": "Demand removed"}

    # 2. Delete from desktop-synced demands JSON cache
    dem_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "DEMANDS"
    ).first()
    if dem_record and dem_record.data_json:
        try:
            d_list = json.loads(dem_record.data_json)
            before_len = len(d_list)
            d_list = [item for item in d_list if item.get("id") != demand_id]
            if len(d_list) < before_len:
                dem_record.data_json = json.dumps(d_list)
                db.commit()
                return {"status": "success", "message": "Demand removed"}
        except Exception:
            pass

    return {"status": "success", "message": "Demand removed"}

@app.post("/api/v1/hub/stores/{token}/inventory")
def add_product_to_store_inventory(
    token: str,
    payload: MobileProductCreatePayload,
    db: Session = Depends(get_db)
):
    """
    Adds a new product remotely from mobile app.
    Queues into HubPendingProduct for desktop sync and injects into live inventory cache immediately.
    """
    t_clean = token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == t_clean).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found.")

    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Product name is required")

    barcode = (payload.barcode or "").strip()
    if not barcode:
        barcode = f"890{int(datetime.utcnow().timestamp()) % 100000000:08d}99"

    mrp_val = float(payload.mrp) if payload.mrp and payload.mrp > 0 else float(payload.selling_price)

    # 1. Queue for desktop sync
    pending_p = HubPendingProduct(
        store_token=t_clean,
        name=name_clean,
        barcode=barcode,
        category_id=payload.category_id,
        purchase_price=float(payload.purchase_price),
        selling_price=float(payload.selling_price),
        mrp=mrp_val,
        stock_quantity=int(payload.stock_quantity),
        min_stock_alert=int(payload.min_stock_alert),
        synced_to_pos=False
    )
    db.add(pending_p)
    db.commit()
    db.refresh(pending_p)

    # 2. Inject immediately into cached inventory data for 24/7 mobile access
    inv_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "INVENTORY"
    ).first()
    if inv_record and inv_record.data_json:
        try:
            inv_data = json.loads(inv_record.data_json)
            prods = inv_data.get("products", [])
            new_item = {
                "id": pending_p.id,
                "name": name_clean,
                "barcode": barcode,
                "category": "General",
                "category_id": payload.category_id,
                "current_stock": int(payload.stock_quantity),
                "selling_price": round(float(payload.selling_price), 2),
                "mrp": round(mrp_val, 2),
                "purchase_price": round(float(payload.purchase_price), 2),
                "min_stock": int(payload.min_stock_alert),
                "is_low_stock": False
            }
            prods.insert(0, new_item)
            inv_data["products"] = prods
            inv_data["total_count"] = len(prods)
            inv_record.data_json = json.dumps(inv_data)
            db.commit()
        except Exception:
            pass

    return {
        "success": True,
        "message": f"Product '{name_clean}' added successfully! Synced to Cloud Hub and queued for POS.",
        "product": {
            "id": pending_p.id,
            "name": name_clean,
            "barcode": barcode,
            "selling_price": payload.selling_price,
            "stock_quantity": payload.stock_quantity
        }
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
