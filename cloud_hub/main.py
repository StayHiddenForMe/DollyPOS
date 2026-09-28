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
    overview: Dict[str, Any]
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
    Saves live snapshot & delivers pending mobile demands to the laptop POS.
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

    # Save or update snapshot
    period = payload.overview.get("period", "TODAY")
    snapshot = db.query(HubSnapshot).filter(
        HubSnapshot.store_token == token,
        HubSnapshot.period == period
    ).first()

    if not snapshot:
        snapshot = HubSnapshot(
            store_token=token,
            period=period,
            data_json=json.dumps(payload.overview)
        )
        db.add(snapshot)
    else:
        snapshot.data_json = json.dumps(payload.overview)
        snapshot.updated_at = now

    # Fetch unsynced mobile demands for this store to deliver to the desktop
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
        "message": "Store snapshot saved in Cloud Hub.",
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
    db: Session = Depends(get_db)
):
    """
    24/7 Mobile Overview endpoint.
    Returns latest snapshot even if the store laptop is powered off.
    """
    t_clean = token.strip().upper()
    store = db.query(HubStore).filter(HubStore.store_token == t_clean).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found with this token.")

    snapshot = db.query(HubSnapshot).filter(
        HubSnapshot.store_token == t_clean,
        HubSnapshot.period == period.upper()
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

    # Guarantee shop_name is always present
    overview_data["shop_name"] = store.shop_name
    overview_data["is_pos_online"] = is_online
    overview_data["last_pos_sync"] = store.last_seen_at.isoformat() if store.last_seen_at else None

    return overview_data

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
    # Latest production version definition
    LATEST_DESKTOP_VERSION = "1.0.0"
    LATEST_MOBILE_VERSION = "1.0.0"

    if client_type == "mobile":
        has_update = current_version != LATEST_MOBILE_VERSION
        return {
            "has_update": has_update,
            "latest_version": LATEST_MOBILE_VERSION,
            "release_notes": "Improved mobile loading speed, eliminated UI jitter, and added Store Token sync.",
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
