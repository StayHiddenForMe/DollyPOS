import secrets
import json
import requests
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth_router import get_current_user
from app.models.user import User
from app.models.settings import StoreSettings
from app.services.cloud_sync_service import cloud_sync_service

router = APIRouter(prefix="/cloud-sync", tags=["Multi-Store Hybrid Cloud Sync"])

class ConfigureSyncRequest(BaseModel):
    cloud_hub_url: Optional[str] = None
    cloud_sync_enabled: Optional[bool] = None
    store_token: Optional[str] = None

class TestConnectionRequest(BaseModel):
    cloud_hub_url: str

@router.get("/status")
def get_cloud_sync_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns current store token, cloud hub connection status, and QR pairing payload."""
    db.expire_all()
    st = db.query(StoreSettings).first()
    if not st:
        raise HTTPException(status_code=404, detail="Store settings not found.")

    # QR Pairing payload structure for 1-tap mobile pairing
    pairing_payload = {
        "store_token": st.store_token,
        "shop_name": st.shop_name,
        "hub_url": st.cloud_hub_url or "https://dollypos-hub.onrender.com"
    }

    return {
        "store_id": st.store_id,
        "store_token": st.store_token,
        "shop_name": st.shop_name,
        "cloud_hub_url": st.cloud_hub_url,
        "cloud_sync_enabled": st.cloud_sync_enabled,
        "last_cloud_sync_at": st.last_cloud_sync_at.isoformat() if st.last_cloud_sync_at else None,
        "cloud_sync_status": st.cloud_sync_status or "IDLE",
        "cloud_sync_error": st.cloud_sync_error,
        "qr_pairing_string": json.dumps(pairing_payload)
    }

@router.post("/trigger")
def trigger_cloud_sync_now(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Triggers an on-demand manual sync of store data to the Cloud Hub."""
    result = cloud_sync_service.sync_to_cloud(db, force=True)
    return result

@router.post("/configure")
def configure_cloud_sync(
    payload: ConfigureSyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates cloud sync settings such as hub URL, enabled status, or custom store token."""
    st = db.query(StoreSettings).first()
    if not st:
        raise HTTPException(status_code=404, detail="Store settings not found.")

    if payload.cloud_hub_url is not None:
        st.cloud_hub_url = payload.cloud_hub_url.strip()
    if payload.cloud_sync_enabled is not None:
        st.cloud_sync_enabled = payload.cloud_sync_enabled
    if payload.store_token is not None and payload.store_token.strip():
        st.store_token = payload.store_token.strip().upper()

    db.commit()
    db.refresh(st)
    return {
        "status": "success",
        "message": "Cloud sync settings updated.",
        "store_token": st.store_token,
        "cloud_hub_url": st.cloud_hub_url,
        "cloud_sync_enabled": st.cloud_sync_enabled
    }

@router.post("/regenerate-token")
def regenerate_store_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generates a new Store Access Token and secret for this store."""
    st = db.query(StoreSettings).first()
    if not st:
        raise HTTPException(status_code=404, detail="Store settings not found.")

    random_part = secrets.token_hex(3).upper()
    st.store_token = f"DLY-STR1-{random_part}"
    st.store_secret = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(st)

    return {
        "status": "success",
        "store_token": st.store_token,
        "message": f"New Store Access Token generated: {st.store_token}"
    }

@router.post("/test-connection")
def test_cloud_hub_connection(
    payload: TestConnectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pings the specified Cloud Hub URL to verify connectivity and latency.
    """
    url = payload.cloud_hub_url.strip().rstrip("/")
    if not url:
        raise HTTPException(status_code=400, detail="Cloud Hub URL is empty.")

    start_time = datetime.utcnow()
    try:
        res = requests.get(url, timeout=5.0)
        elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        if res.status_code == 200:
            try:
                data = res.json()
                service_name = data.get("service", "Dolly POS Cloud Hub")
                return {
                    "status": "online",
                    "latency_ms": elapsed_ms,
                    "service": service_name,
                    "message": f"Connected! {service_name} is LIVE ({elapsed_ms}ms)."
                }
            except Exception:
                return {
                    "status": "online",
                    "latency_ms": elapsed_ms,
                    "message": f"Server responded with HTTP 200 ({elapsed_ms}ms)!"
                }
        elif res.status_code == 404:
            return {
                "status": "not_found",
                "status_code": 404,
                "message": "Server returned HTTP 404 Not Found. Make sure your Render service is deployed and running."
            }
        else:
            return {
                "status": "error",
                "status_code": res.status_code,
                "message": f"Server returned HTTP {res.status_code}."
            }
    except requests.exceptions.Timeout:
        return {
            "status": "timeout",
            "message": "Connection timed out (5s). Cloud server might be sleeping or unreachable."
        }
    except requests.exceptions.RequestException as e:
        return {
            "status": "unreachable",
            "message": f"Cannot reach server: {str(e)[:120]}"
        }

