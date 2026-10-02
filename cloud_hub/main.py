import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Depends, Query, status, Response
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

class HubDemandMutation(Base):
    __tablename__ = "hub_demand_mutations"

    id = Column(Integer, primary_key=True, index=True)
    store_token = Column(String(50), index=True, nullable=False)
    demand_id = Column(Integer, nullable=False)
    item_description = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    action = Column(String(50), nullable=False)  # 'UPDATE_STATUS' | 'DELETE'
    status = Column(String(50), nullable=True)
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

class HubPendingVendor(Base):
    __tablename__ = "hub_pending_vendors"

    id = Column(Integer, primary_key=True, index=True)
    store_token = Column(String(50), index=True, nullable=False)
    name = Column(String(100), nullable=False)
    company_name = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=False)
    alt_phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    gstin = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(50), nullable=True)
    state = Column(String(50), default="Maharashtra", nullable=True)
    notes = Column(Text, nullable=True)
    bank_name = Column(String(100), nullable=True)
    bank_account_no = Column(String(50), nullable=True)
    bank_ifsc = Column(String(20), nullable=True)
    bank_holder_name = Column(String(100), nullable=True)
    vendor_upi_id = Column(String(100), nullable=True)
    opening_due = Column(Float, default=0.0)
    synced_to_pos = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class HubPendingVendorPayment(Base):
    __tablename__ = "hub_pending_vendor_payments"

    id = Column(Integer, primary_key=True, index=True)
    store_token = Column(String(50), index=True, nullable=False)
    vendor_id = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    payment_mode = Column(String(50), default="UPI", nullable=False)
    reference_no = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    synced_to_pos = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class HubPendingVendorUpdate(Base):
    __tablename__ = "hub_pending_vendor_updates"

    id = Column(Integer, primary_key=True, index=True)
    store_token = Column(String(50), index=True, nullable=False)
    vendor_id = Column(Integer, nullable=True)
    vendor_name = Column(String(100), nullable=True)
    vendor_phone = Column(String(20), nullable=True)
    updates_json = Column(Text, nullable=False)
    synced_to_pos = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class HubStoreData(Base):
    __tablename__ = "hub_store_data"

    id = Column(Integer, primary_key=True, index=True)
    store_token = Column(String(50), index=True, nullable=False)
    data_type = Column(String(50), index=True, nullable=False)  # 'INVENTORY', 'KHATA', 'REPORTS', 'CATEGORIES', 'DEMANDS', 'VENDORS'
    data_json = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# Safe schema upgrade check
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE hub_demands ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING_PROCUREMENT'"))
        conn.execute(text("ALTER TABLE hub_demand_mutations ADD COLUMN IF NOT EXISTS item_description VARCHAR(255)"))
        conn.execute(text("ALTER TABLE hub_demand_mutations ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50)"))
        conn.execute(text("ALTER TABLE hub_pending_vendors ADD COLUMN IF NOT EXISTS vendor_upi_id VARCHAR(100)"))
        conn.execute(text("ALTER TABLE hub_pending_vendors ADD COLUMN IF NOT EXISTS opening_due FLOAT DEFAULT 0.0"))
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
    vendors: Optional[List[Dict[str, Any]]] = None
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

class VendorCreatePayload(BaseModel):
    name: str
    phone: str
    company_name: Optional[str] = None
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    notes: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_holder_name: Optional[str] = None
    vendor_upi_id: Optional[str] = None
    opening_due: Optional[float] = 0.0

class VendorUpdatePayload(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    notes: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_holder_name: Optional[str] = None
    vendor_upi_id: Optional[str] = None

class VendorPaymentPayload(BaseModel):
    amount: float
    payment_mode: Optional[str] = "UPI"
    reference_no: Optional[str] = None
    notes: Optional[str] = None

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

    if payload.vendors is not None:
        # Merge incoming desktop vendors with any pending vendors created from mobile
        v_list = list(payload.vendors or [])
        existing_phones = {str(v.get("phone", "")).strip() for v in v_list if v.get("phone")}
        existing_names = {str(v.get("name", "")).strip().lower() for v in v_list if v.get("name")}

        pending_v = db.query(HubPendingVendor).filter(
            HubPendingVendor.store_token == token
        ).all()
        for pv in pending_v:
            if pv.phone not in existing_phones and pv.name.lower() not in existing_names:
                v_list.append({
                    "id": pv.id,
                    "name": pv.name,
                    "company_name": pv.company_name,
                    "phone": pv.phone,
                    "alt_phone": pv.alt_phone,
                    "email": pv.email,
                    "gstin": pv.gstin,
                    "address": pv.address,
                    "city": pv.city,
                    "state": pv.state,
                    "notes": pv.notes,
                    "bank_name": pv.bank_name,
                    "bank_account_no": pv.bank_account_no,
                    "bank_ifsc": pv.bank_ifsc,
                    "bank_holder_name": pv.bank_holder_name,
                    "vendor_upi_id": pv.vendor_upi_id,
                    "outstanding_due": pv.opening_due,
                    "is_active": True,
                    "created_at": pv.created_at.isoformat() if pv.created_at else None
                })

        v_record = db.query(HubStoreData).filter(
            HubStoreData.store_token == token,
            HubStoreData.data_type == "VENDORS"
        ).first()
        if not v_record:
            v_record = HubStoreData(
                store_token=token,
                data_type="VENDORS",
                data_json=json.dumps(v_list)
            )
            db.add(v_record)
        else:
            v_record.data_json = json.dumps(v_list)
            v_record.updated_at = now

    if payload.demands is not None:
        # Purge obsolete mutations that were already synced to POS in previous cycles
        try:
            db.query(HubDemandMutation).filter(
                HubDemandMutation.store_token == token,
                HubDemandMutation.synced_to_pos == True
            ).delete(synchronize_session=False)
            db.commit()
        except Exception:
            pass

        # Only apply pending mutations that POS has not yet processed
        mutations = db.query(HubDemandMutation).filter(
            HubDemandMutation.store_token == token,
            HubDemandMutation.synced_to_pos == False
        ).all()
        deleted_ids = {m.demand_id for m in mutations if m.action == "DELETE"}
        deleted_descs = {m.item_description.strip().lower() for m in mutations if m.action == "DELETE" and m.item_description}
        status_updates_by_id = {m.demand_id: m.status for m in mutations if m.action == "UPDATE_STATUS" and m.status}
        status_updates_by_desc = {m.item_description.strip().lower(): m.status for m in mutations if m.action == "UPDATE_STATUS" and m.status and m.item_description}

        filtered_demands = []
        for d in payload.demands:
            did = d.get("id")
            desc = (d.get("item_description") or "").strip().lower()
            if did in deleted_ids or (desc and desc in deleted_descs):
                continue
            if did in status_updates_by_id:
                d["status"] = status_updates_by_id[did]
            elif desc and desc in status_updates_by_desc:
                d["status"] = status_updates_by_desc[desc]
            filtered_demands.append(d)

        dem_record = db.query(HubStoreData).filter(
            HubStoreData.store_token == token,
            HubStoreData.data_type == "DEMANDS"
        ).first()
        if not dem_record:
            dem_record = HubStoreData(
                store_token=token,
                data_type="DEMANDS",
                data_json=json.dumps(filtered_demands)
            )
            db.add(dem_record)
        else:
            dem_record.data_json = json.dumps(filtered_demands)
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

    # 8. Fetch unsynced demand mutations (status updates & deletions from mobile)
    unsynced_mutations = db.query(HubDemandMutation).filter(
        HubDemandMutation.store_token == token,
        HubDemandMutation.synced_to_pos == False
    ).all()
    mutations_to_deliver = []
    for m in unsynced_mutations:
        mutations_to_deliver.append({
            "id": m.id,
            "demand_id": m.demand_id,
            "item_description": m.item_description,
            "customer_phone": m.customer_phone,
            "action": m.action,
            "status": m.status
        })
        m.synced_to_pos = True

    # 9. Fetch unsynced pending vendors created remotely on mobile
    unsynced_vendors = db.query(HubPendingVendor).filter(
        HubPendingVendor.store_token == token,
        HubPendingVendor.synced_to_pos == False
    ).all()
    vendors_to_deliver = []
    for pv in unsynced_vendors:
        vendors_to_deliver.append({
            "id": pv.id,
            "name": pv.name,
            "company_name": pv.company_name,
            "phone": pv.phone,
            "alt_phone": pv.alt_phone,
            "email": pv.email,
            "gstin": pv.gstin,
            "address": pv.address,
            "city": pv.city,
            "state": pv.state,
            "notes": pv.notes,
            "bank_name": pv.bank_name,
            "bank_account_no": pv.bank_account_no,
            "bank_ifsc": pv.bank_ifsc,
            "bank_holder_name": pv.bank_holder_name,
            "vendor_upi_id": pv.vendor_upi_id,
            "opening_due": pv.opening_due
        })
        pv.synced_to_pos = True

    # 10. Fetch unsynced vendor updates made remotely on mobile
    unsynced_vendor_updates = db.query(HubPendingVendorUpdate).filter(
        HubPendingVendorUpdate.store_token == token,
        HubPendingVendorUpdate.synced_to_pos == False
    ).all()
    vendor_updates_to_deliver = []
    for vu in unsynced_vendor_updates:
        try:
            updates_dict = json.loads(vu.updates_json)
        except Exception:
            updates_dict = {}
        vendor_updates_to_deliver.append({
            "id": vu.id,
            "vendor_id": vu.vendor_id,
            "vendor_name": vu.vendor_name,
            "vendor_phone": vu.vendor_phone,
            "updates": updates_dict
        })
        vu.synced_to_pos = True

    # 11. Fetch unsynced vendor payments recorded on mobile
    unsynced_vendor_pmts = db.query(HubPendingVendorPayment).filter(
        HubPendingVendorPayment.store_token == token,
        HubPendingVendorPayment.synced_to_pos == False
    ).all()
    vendor_pmts_to_deliver = []
    for pvp in unsynced_vendor_pmts:
        vendor_pmts_to_deliver.append({
            "id": pvp.id,
            "vendor_id": pvp.vendor_id,
            "amount": pvp.amount,
            "payment_mode": pvp.payment_mode,
            "reference_no": pvp.reference_no,
            "notes": pvp.notes
        })
        pvp.synced_to_pos = True

    db.commit()

    return {
        "status": "success",
        "store_token": token,
        "message": "Store data successfully synced to Cloud Hub.",
        "pending_demands": demands_to_deliver,
        "pending_products": products_to_deliver,
        "pending_demand_mutations": mutations_to_deliver,
        "pending_vendors": vendors_to_deliver,
        "pending_vendor_updates": vendor_updates_to_deliver,
        "pending_vendor_payments": vendor_pmts_to_deliver
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

    # Check if laptop is currently online (seen in last 360 seconds / 6 minutes)
    is_online = False
    if store.last_seen_at:
        is_online = (datetime.utcnow() - store.last_seen_at) < timedelta(seconds=360)

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

    # Determine if POS is currently online (360 seconds threshold)
    is_online = False
    if store.last_seen_at:
        is_online = (datetime.utcnow() - store.last_seen_at) < timedelta(seconds=360)

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

@app.get("/api/v1/hub/stores/{token}/has-pending")
def check_store_has_pending(
    token: str,
    db: Session = Depends(get_db)
):
    """Super lightweight check (10ms, <50 bytes) for desktop POS to detect if mobile made changes."""
    t_clean = token.strip().upper()
    has_pending = (
        db.query(HubPendingVendor.id).filter(HubPendingVendor.store_token == t_clean, HubPendingVendor.synced_to_pos == False).first() is not None
        or db.query(HubPendingVendorUpdate.id).filter(HubPendingVendorUpdate.store_token == t_clean, HubPendingVendorUpdate.synced_to_pos == False).first() is not None
        or db.query(HubPendingVendorPayment.id).filter(HubPendingVendorPayment.store_token == t_clean, HubPendingVendorPayment.synced_to_pos == False).first() is not None
        or db.query(HubDemand.id).filter(HubDemand.store_token == t_clean, HubDemand.synced_to_pos == False).first() is not None
        or db.query(HubDemandMutation.id).filter(HubDemandMutation.store_token == t_clean, HubDemandMutation.synced_to_pos == False).first() is not None
        or db.query(HubPendingProduct.id).filter(HubPendingProduct.store_token == t_clean, HubPendingProduct.synced_to_pos == False).first() is not None
    )
    return {"has_pending": bool(has_pending)}

@app.get("/api/v1/hub/stores/{token}/reports")
def get_store_reports_for_mobile(
    token: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    report_type: str = "SALES",
    limit: int = 25,
    export: bool = False,
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

        # Fallback: If no granular invoices matched the range but daily sales summary exists, generate aggregate rows
        if not invoices and daily_sales:
            for day_k in sorted(daily_sales.keys(), reverse=True):
                if (not s_str or day_k >= s_str) and (not e_str or day_k <= e_str):
                    day_v = daily_sales[day_k]
                    invoices.append({
                        "date_ymd": day_k,
                        "date": day_k,
                        "time": "—",
                        "bill_number": f"{day_v.get('bills', 0)} bills",
                        "customer": "Daily Aggregate Summary",
                        "payment_mode": "STORE COUNTER",
                        "gross_amount": round(float(day_v.get("gross", 0.0)), 2),
                        "discount": round(float(day_v.get("discount", 0.0)), 2),
                        "tax": round(float(day_v.get("tax", 0.0)), 2),
                        "net_amount": round(float(day_v.get("net", 0.0)), 2)
                    })

        # Cap preview rows to 25 for mobile screen (instant rendering, zero lag).
        # When exporting as Excel or PDF, export all invoices (up to 10,000).
        if export:
            preview_rows = invoices[:10000]
        else:
            preview_rows = invoices[:limit]

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
            "is_truncated": total_bills > len(preview_rows)
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

        # Ensure all credit/khata invoices are counted in mode_stats so Khata Udhar dues is never 0
        invoices = reports_data.get("sales_invoices", [])
        if s_str and e_str:
            invoices = [inv for inv in invoices if s_str <= inv.get("date_ymd", "") <= e_str]
        
        credit_invs = [inv for inv in invoices if "CREDIT" in str(inv.get("payment_mode", "")).upper() or "KHATA" in str(inv.get("payment_mode", "")).upper()]
        if credit_invs and mode_stats["CREDIT"]["amount"] == 0:
            for inv in credit_invs:
                amt = float(inv.get("net_amount", 0.0))
                mode_stats["CREDIT"]["bills"] += 1
                mode_stats["CREDIT"]["amount"] += amt
                total_collected += amt
            total_transactions += len(credit_invs)

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
        total_dmg_units = sum(int(d.get("damaged_quantity", d.get("damaged_units", 0))) for d in damaged)
        total_cost_loss = sum(float(d.get("total_loss", d.get("total_cost_loss", 0.0))) for d in damaged)

        rows = []
        for d in damaged:
            qty = int(d.get("damaged_quantity", d.get("damaged_units", 0)))
            cp = float(d.get("cost_price", d.get("purchase_price", 0.0)))
            rows.append({
                "product_name": d.get("product_name", "—"),
                "barcode": d.get("barcode", "—"),
                "damaged_units": qty,
                "cost_price": round(cp, 2),
            })

        return {
            "report_type": "DAMAGED",
            "title": "Damaged Goods Register",
            "store_name": store_title,
            "start_date": s_str,
            "end_date": e_str,
            "summary": {
                "damaged_products_count": len(rows),
                "total_damaged_units": total_dmg_units,
                "total_cost_loss": round(total_cost_loss, 2)
            },
            "columns": ["Product Name", "Barcode", "Damaged Qty", "Cost Price (₹)"],
            "rows": rows
        }

    # 6. REORDER & DEMAND PLANNER
    elif rep_upper == "PLANNER":
        planner = reports_data.get("planner", [])
        total_suggested = sum(int(p.get("suggested_order", 0)) for p in planner)

        rows = []
        for p in planner:
            rows.append({
                "product_name": p.get("product_name", "—"),
                "current_stock": int(p.get("current_stock", p.get("stock", 0))),
                "suggested_order": int(p.get("suggested_order", 0)),
            })

        return {
            "report_type": "PLANNER",
            "title": "Smart Stock Replenishment Planner",
            "store_name": store_title,
            "start_date": s_str,
            "end_date": e_str,
            "summary": {
                "critical_items_count": len(rows),
                "total_suggested_units": total_suggested
            },
            "columns": ["Product Name", "Stock Left", "Suggested Order"],
            "rows": rows
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
    """Heartbeat endpoint for mobile app connection indicator (360s threshold)."""
    t_clean = token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == t_clean).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found.")

    is_online = False
    if store.last_seen_at:
        is_online = (datetime.utcnow() - store.last_seen_at) < timedelta(seconds=360)

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

    desktop_map = {}
    for dd in desktop_demands:
        key = (dd.get("item_description", "").strip().lower(), (dd.get("customer_phone") or "").strip())
        desktop_map[key] = dd

    items = []
    seen_keys = set()
    for d in mobile_demands:
        key = (d.item_description.strip().lower(), (d.customer_phone or "").strip())
        seen_keys.add(key)
        desktop_item = desktop_map.get(key)
        cur_status = d.status or (desktop_item.get("status") if desktop_item else "PENDING_PROCUREMENT")
        if not cur_status:
            cur_status = "PENDING_PROCUREMENT"
        unique_dem_id = d.id if d.id >= 100000 else 100000 + d.id
        items.append({
            "id": unique_dem_id,
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
    """Updates status of a customer demand request from mobile app and queues mutation for POS."""
    t_clean = token.strip().upper()
    raw_status = payload.status.strip().upper()
    if raw_status in ["ARRIVED", "FULFILLED", "STOCK ARRIVED", "COMPLETED", "RECEIVED"]:
        new_status = "FULFILLED"
    elif raw_status in ["ORDERED", "ORDERED_WITH_VENDOR"]:
        new_status = "ORDERED_WITH_VENDOR"
    elif raw_status in ["PENDING", "PENDING_PROCUREMENT", "PENDING BUY"]:
        new_status = "PENDING_PROCUREMENT"
    else:
        new_status = raw_status

    target_desc = None
    target_phone = None

    # 1. Update in mobile demands table if present
    d = db.query(HubDemand).filter(
        HubDemand.store_token == t_clean,
        HubDemand.id == demand_id
    ).first()
    if d:
        d.status = new_status
        target_desc = d.item_description
        target_phone = d.customer_phone

    # 2. Update in desktop-synced demands JSON cache
    dem_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "DEMANDS"
    ).first()
    if dem_record and dem_record.data_json:
        try:
            d_list = json.loads(dem_record.data_json)
            for item in d_list:
                match_id = (item.get("id") == demand_id)
                match_desc = (target_desc and str(item.get("item_description", "")).strip().lower() == target_desc.strip().lower())
                if match_id or match_desc:
                    item["status"] = new_status
                    if not target_desc:
                        target_desc = item.get("item_description")
                        target_phone = item.get("customer_phone")
            dem_record.data_json = json.dumps(d_list)
        except Exception:
            pass

    # Record mutation for desktop POS sync with description and phone for robust matching
    mutation = HubDemandMutation(
        store_token=t_clean,
        demand_id=demand_id,
        item_description=target_desc,
        customer_phone=target_phone,
        action="UPDATE_STATUS",
        status=new_status,
        synced_to_pos=False
    )
    db.add(mutation)
    db.commit()
    return {"status": "success", "message": f"Demand status updated to {new_status}"}

@app.delete("/api/v1/hub/stores/{token}/demands/{demand_id}")
def delete_store_demand(
    token: str,
    demand_id: int,
    db: Session = Depends(get_db)
):
    """Deletes a customer demand entry from the Cloud Hub and queues deletion for POS."""
    t_clean = token.strip().upper()

    target_desc = None
    target_phone = None

    # 1. Delete from mobile demands
    hd = db.query(HubDemand).filter(
        HubDemand.store_token == t_clean,
        HubDemand.id == demand_id
    ).first()
    if hd:
        target_desc = hd.item_description
        target_phone = hd.customer_phone
        db.delete(hd)

    # 2. Delete from desktop-synced demands JSON cache
    dem_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "DEMANDS"
    ).first()
    if dem_record and dem_record.data_json:
        try:
            d_list = json.loads(dem_record.data_json)
            if not target_desc:
                for item in d_list:
                    if item.get("id") == demand_id:
                        target_desc = item.get("item_description")
                        target_phone = item.get("customer_phone")
                        break
            filtered_list = []
            for item in d_list:
                match_id = (item.get("id") == demand_id)
                match_desc = (target_desc and str(item.get("item_description", "")).strip().lower() == target_desc.strip().lower() and (not target_phone or str(item.get("customer_phone", "")).strip() == str(target_phone).strip()))
                if not match_id and not match_desc:
                    filtered_list.append(item)
            dem_record.data_json = json.dumps(filtered_list)
        except Exception:
            pass

    # Record deletion mutation for desktop POS sync with item description and phone
    mutation = HubDemandMutation(
        store_token=t_clean,
        demand_id=demand_id,
        item_description=target_desc,
        customer_phone=target_phone,
        action="DELETE",
        status=None,
        synced_to_pos=False
    )
    db.add(mutation)
    db.commit()
    return {"status": "success", "message": "Demand removed successfully"}

@app.get("/api/v1/hub/stores/{token}/backup")
def download_store_backup_from_cloud(token: str, db: Session = Depends(get_db)):
    """
    Synthesizes and downloads complete cloud database backup snapshot for the store.
    Allows remote backup download from mobile even when store laptop is off-LAN.
    """
    t_clean = token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == t_clean).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found.")

    def get_data(dtype: str):
        row = db.query(HubStoreData).filter(
            HubStoreData.store_token == t_clean,
            HubStoreData.data_type == dtype
        ).first()
        if row and row.data_json:
            try:
                return json.loads(row.data_json)
            except Exception:
                return None
        return None

    inventory_data = get_data("INVENTORY") or {}
    khata_data = get_data("KHATA") or {}
    reports_data = get_data("REPORTS") or {}
    categories_data = get_data("CATEGORIES") or []
    demands_data = get_data("DEMANDS") or []
    vendors_data = get_data("VENDORS") or []

    timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H%M%S")
    backup_payload = {
        "backup_version": "2.1",
        "export_source": "Dolly POS Cloud Hub",
        "store_token": store.store_token,
        "store_name": store.shop_name,
        "export_date": datetime.utcnow().isoformat(),
        "store_settings": {
            "shop_name": store.shop_name,
            "tag_line": store.tagline,
            "mobile": store.mobile,
            "address": store.address,
            "upi_id": store.upi_id,
        },
        "inventory": inventory_data.get("products", []) if isinstance(inventory_data, dict) else inventory_data,
        "customers": khata_data.get("customers", []) if isinstance(khata_data, dict) else khata_data,
        "categories": categories_data,
        "invoices": reports_data.get("sales_invoices", []) if isinstance(reports_data, dict) else [],
        "expenses": reports_data.get("expenses", []) if isinstance(reports_data, dict) else [],
        "demands": demands_data,
        "vendors": vendors_data,
    }

    content_str = json.dumps(backup_payload, indent=2)
    filename = f"DollyPOS_CloudBackup_{store.store_token}_{timestamp}.json"

    return Response(
        content=content_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@app.get("/api/v1/hub/stores/{token}/vendors")
def get_store_vendors_for_mobile(
    token: str,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Returns vendor directory with dues and bank details."""
    t_clean = token.strip().upper()
    v_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "VENDORS"
    ).first()

    vendors = []
    if v_record and v_record.data_json:
        try:
            vendors = json.loads(v_record.data_json)
        except Exception:
            vendors = []

    # Merge pending vendors created from mobile
    pending = db.query(HubPendingVendor).filter(
        HubPendingVendor.store_token == t_clean
    ).all()
    for pv in pending:
        existing = next((v for v in vendors if v.get("id") == pv.id or str(v.get("phone", "")).strip() == pv.phone.strip() or str(v.get("name", "")).strip().lower() == pv.name.strip().lower()), None)
        if not existing:
            unique_pv_id = pv.id if pv.id >= 100000 else 100000 + pv.id
            vendors.append({
                "id": unique_pv_id,
                "name": pv.name,
                "company_name": pv.company_name,
                "phone": pv.phone,
                "alt_phone": pv.alt_phone,
                "email": pv.email,
                "gstin": pv.gstin,
                "address": pv.address,
                "city": pv.city,
                "state": pv.state,
                "notes": pv.notes,
                "bank_name": pv.bank_name,
                "bank_account_no": pv.bank_account_no,
                "bank_ifsc": pv.bank_ifsc,
                "bank_holder_name": pv.bank_holder_name,
                "vendor_upi_id": pv.vendor_upi_id,
                "outstanding_due": pv.opening_due,
                "is_active": True,
                "created_at": pv.created_at.isoformat() if pv.created_at else None
            })
        else:
            # Enrich existing vendor with any bank/UPI details if missing in desktop
            if pv.vendor_upi_id and not existing.get("vendor_upi_id"):
                existing["vendor_upi_id"] = pv.vendor_upi_id
            if pv.bank_name and not existing.get("bank_name"):
                existing["bank_name"] = pv.bank_name
            if pv.bank_account_no and not existing.get("bank_account_no"):
                existing["bank_account_no"] = pv.bank_account_no
            if pv.bank_ifsc and not existing.get("bank_ifsc"):
                existing["bank_ifsc"] = pv.bank_ifsc
            if pv.bank_holder_name and not existing.get("bank_holder_name"):
                existing["bank_holder_name"] = pv.bank_holder_name

    # Apply any pending vendor updates on the fly so UI always has latest UPI / bank details
    pending_updates = db.query(HubPendingVendorUpdate).filter(
        HubPendingVendorUpdate.store_token == t_clean
    ).all()
    for pu in pending_updates:
        try:
            up_dict = json.loads(pu.updates_json)
        except Exception:
            up_dict = {}
        for v in vendors:
            match_id = (pu.vendor_id and v.get("id") == pu.vendor_id)
            match_name = (pu.vendor_name and str(v.get("name", "")).strip().lower() == pu.vendor_name.strip().lower())
            match_phone = (pu.vendor_phone and str(v.get("phone", "")).strip() == pu.vendor_phone.strip())
            if match_id or match_name or match_phone:
                for k, val in up_dict.items():
                    if val is not None:
                        v[k] = val

    if search and search.strip():
        s = search.strip().lower()
        vendors = [v for v in vendors if s in str(v.get("name", "")).lower() or s in str(v.get("phone", "")).lower() or s in str(v.get("company_name", "")).lower() or s in str(v.get("vendor_code", "")).lower()]

    total_dues = sum(float(v.get("outstanding_due", 0.0)) for v in vendors)

    return {
        "total_vendors": len(vendors),
        "total_dues": round(total_dues, 2),
        "vendors": vendors
    }

@app.post("/api/v1/hub/stores/{token}/vendors")
def create_store_vendor_from_mobile(
    token: str,
    payload: VendorCreatePayload,
    db: Session = Depends(get_db)
):
    """Allows remote creation of a vendor from mobile companion."""
    t_clean = token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == t_clean).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found.")

    pv = HubPendingVendor(
        store_token=t_clean,
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        company_name=payload.company_name,
        alt_phone=payload.alt_phone,
        email=payload.email,
        gstin=payload.gstin,
        address=payload.address,
        city=payload.city,
        state=payload.state or "Maharashtra",
        notes=payload.notes,
        bank_name=payload.bank_name,
        bank_account_no=payload.bank_account_no,
        bank_ifsc=payload.bank_ifsc,
        bank_holder_name=payload.bank_holder_name,
        vendor_upi_id=payload.vendor_upi_id,
        opening_due=payload.opening_due or 0.0,
        synced_to_pos=False
    )
    db.add(pv)
    db.commit()
    db.refresh(pv)

    # Inject into live VENDORS cache
    v_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "VENDORS"
    ).first()
    new_vendor_entry = {
        "id": pv.id,
        "name": pv.name,
        "company_name": pv.company_name,
        "phone": pv.phone,
        "alt_phone": pv.alt_phone,
        "email": pv.email,
        "gstin": pv.gstin,
        "address": pv.address,
        "city": pv.city,
        "state": pv.state,
        "notes": pv.notes,
        "bank_name": pv.bank_name,
        "bank_account_no": pv.bank_account_no,
        "bank_ifsc": pv.bank_ifsc,
        "bank_holder_name": pv.bank_holder_name,
        "vendor_upi_id": pv.vendor_upi_id,
        "outstanding_due": pv.opening_due,
        "is_active": True,
        "created_at": pv.created_at.isoformat()
    }
    if not v_record:
        v_record = HubStoreData(
            store_token=t_clean,
            data_type="VENDORS",
            data_json=json.dumps([new_vendor_entry])
        )
        db.add(v_record)
        db.commit()
    else:
        try:
            v_list = json.loads(v_record.data_json) if v_record.data_json else []
            v_list.append(new_vendor_entry)
            v_record.data_json = json.dumps(v_list)
            db.commit()
        except Exception:
            pass

    return {
        "status": "success",
        "message": "Vendor created! Will sync to Dolly POS laptop.",
        "id": pv.id
    }

@app.put("/api/v1/hub/stores/{token}/vendors/{vendor_id}")
def update_store_vendor_from_mobile(
    token: str,
    vendor_id: int,
    payload: VendorUpdatePayload,
    db: Session = Depends(get_db)
):
    """Updates vendor bank details and information from mobile and queues for POS sync."""
    t_clean = token.strip().upper()
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}

    # 1. Update in HubPendingVendor if present
    pv = db.query(HubPendingVendor).filter(
        HubPendingVendor.store_token == t_clean,
        HubPendingVendor.id == vendor_id
    ).first()
    v_name = None
    v_phone = None
    if pv:
        v_name = pv.name
        v_phone = pv.phone
        for k, v in updates.items():
            if hasattr(pv, k):
                setattr(pv, k, v)

    # 2. Update in HubStoreData(VENDORS) cache
    v_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "VENDORS"
    ).first()
    if v_record and v_record.data_json:
        try:
            v_list = json.loads(v_record.data_json)
            for v in v_list:
                match_id = (v.get("id") == vendor_id)
                match_name = (v_name and str(v.get("name", "")).strip().lower() == v_name.strip().lower())
                if match_id or match_name:
                    v_name = v.get("name")
                    v_phone = v.get("phone")
                    for k, val in updates.items():
                        v[k] = val
            v_record.data_json = json.dumps(v_list)
        except Exception:
            pass

    # 3. Queue update mutation for desktop POS sync
    update_rec = HubPendingVendorUpdate(
        store_token=t_clean,
        vendor_id=vendor_id,
        vendor_name=v_name,
        vendor_phone=v_phone,
        updates_json=json.dumps(updates),
        synced_to_pos=False
    )
    db.add(update_rec)
    db.commit()

    return {"status": "success", "message": "Vendor details updated successfully"}

@app.post("/api/v1/hub/stores/{token}/vendors/{vendor_id}/payment")
def record_store_vendor_payment_from_mobile(
    token: str,
    vendor_id: int,
    payload: VendorPaymentPayload,
    db: Session = Depends(get_db)
):
    """Records payment made to vendor and queues for laptop sync."""
    t_clean = token.strip().upper()
    pvp = HubPendingVendorPayment(
        store_token=t_clean,
        vendor_id=vendor_id,
        amount=payload.amount,
        payment_mode=payload.payment_mode or "UPI",
        reference_no=payload.reference_no,
        notes=payload.notes,
        synced_to_pos=False
    )
    db.add(pvp)
    db.commit()

    # Deduct from outstanding_due in live VENDORS cache
    v_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "VENDORS"
    ).first()
    new_due = 0.0
    if v_record and v_record.data_json:
        try:
            v_list = json.loads(v_record.data_json)
            for v in v_list:
                if v.get("id") == vendor_id:
                    v["outstanding_due"] = max(0.0, float(v.get("outstanding_due", 0.0)) - payload.amount)
                    new_due = v["outstanding_due"]
            v_record.data_json = json.dumps(v_list)
            db.commit()
        except Exception:
            pass

    return {
        "status": "success",
        "message": f"Payment of ₹{payload.amount:,.2f} recorded! Dues updated.",
        "new_due": new_due
    }

@app.delete("/api/v1/hub/stores/{token}/vendors/{vendor_id}")
def delete_store_vendor_from_mobile(
    token: str,
    vendor_id: int,
    db: Session = Depends(get_db)
):
    """Deletes vendor from hub cache and queues removal for POS."""
    t_clean = token.strip().upper()
    v_record = db.query(HubStoreData).filter(
        HubStoreData.store_token == t_clean,
        HubStoreData.data_type == "VENDORS"
    ).first()
    if v_record and v_record.data_json:
        try:
            vendors = json.loads(v_record.data_json)
            vendors = [v for v in vendors if v.get("id") != vendor_id]
            v_record.data_json = json.dumps(vendors)
            v_record.updated_at = datetime.utcnow()
        except Exception:
            pass

    # Also clean pending vendor record if matching
    db.query(HubPendingVendor).filter(
        HubPendingVendor.store_token == t_clean,
        HubPendingVendor.id == vendor_id
    ).delete()

    db.commit()
    return {"status": "success", "message": "Vendor deleted"}

@app.get("/api/v1/hub/stores/{token}/vendors/{vendor_id}/ledger")
def get_store_vendor_ledger_for_mobile(
    token: str,
    vendor_id: int,
    db: Session = Depends(get_db)
):
    """Returns ledger history of payments made to vendor."""
    t_clean = token.strip().upper()
    pending = db.query(HubPendingVendorPayment).filter(
        HubPendingVendorPayment.store_token == t_clean,
        HubPendingVendorPayment.vendor_id == vendor_id
    ).order_by(HubPendingVendorPayment.created_at.desc()).all()

    entries = []
    for p in pending:
        entries.append({
            "id": p.id,
            "vendor_id": p.vendor_id,
            "entry_type": "PAYMENT_MADE",
            "reference_no": p.reference_no or "UPI_PAYMENT",
            "debit_amount": p.amount,
            "credit_amount": 0.0,
            "balance_after": 0.0,
            "payment_mode": p.payment_mode,
            "notes": p.notes or "Payment via Mobile App",
            "created_at": p.created_at.isoformat()
        })
    return entries

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
