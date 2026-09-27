import os
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List

from app.core.database import get_db
from app.api.auth_router import require_owner
from app.models.user import User
from app.models.settings import StoreSettings
from app.services.google_drive_service import google_drive_service, GOOGLE_DRIVE_FILES_URL
from app.services.backup_service import backup_service
import requests

router = APIRouter(prefix="/google-drive", tags=["Google Drive Cloud Backup"])

class GoogleCredentialsRequest(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None

class BackupPreferencesRequest(BaseModel):
    backup_destination: Optional[str] = "BOTH" # 'BOTH', 'GOOGLE_DRIVE_ONLY', 'LOCAL_ONLY'
    backup_on_app_close: Optional[bool] = True
    backup_retention_days: Optional[int] = 30  # 7, 15, 30, 60, 90, 180, 365, 0 (Never)

@router.get("/status")
def get_google_drive_status(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Returns Google Drive connection status, email, folder name, preferences, last cloud sync, and configured credentials."""
    st = db.query(StoreSettings).first()
    return {
        "connected": bool(st.google_drive_connected) if st else False,
        "email": st.google_drive_email if st else None,
        "folder_name": "DollyPOS_Cloud_Backups",
        "folder_id": st.google_drive_folder_id if st else None,
        "backup_destination": st.backup_destination if st and st.backup_destination else "BOTH",
        "backup_on_app_close": st.backup_on_app_close if st and st.backup_on_app_close is not None else True,
        "backup_retention_days": st.backup_retention_days if st and st.backup_retention_days is not None else 30,
        "last_cloud_backup_at": st.last_cloud_backup_at.isoformat() if st and st.last_cloud_backup_at else None,
        "has_custom_credentials": bool(st and st.google_client_id and st.google_client_secret),
        "client_id": st.google_client_id if st and st.google_client_id else "",
        "client_secret": st.google_client_secret if st and st.google_client_secret else ""
    }

@router.get("/auth-url")
def get_auth_url(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Generates Google OAuth 2.0 authorization URL for desktop app authorization."""
    try:
        url = google_drive_service.get_authorization_url(db)
        return {"success": True, "auth_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/callback", response_class=HTMLResponse)
def handle_oauth_callback(
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Receives authorization code from Google OAuth redirect and completes pairing."""
    if error:
        return HTMLResponse(
            content=f"""<!DOCTYPE html>
            <html>
            <head><title>Google Authorization Failed - Dolly POS</title></head>
            <body style="font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#fef2f2;color:#991b1b;">
              <h2>❌ Google Connection Cancelled / Failed</h2>
              <p>Error details: {error}</p>
              <p>Please return to Dolly POS Settings and try again.</p>
              <button onclick="window.close()" style="margin-top:20px;padding:10px 20px;background:#ef4444;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Close Window</button>
            </body>
            </html>""",
            status_code=400
        )

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    try:
        res = google_drive_service.exchange_code_for_tokens(db, code)
        user_email = res.get("email", "Your Google Account")
        return HTMLResponse(
            content=f"""<!DOCTYPE html>
            <html>
            <head>
              <title>Google Drive Connected - Dolly POS</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body style="font-family:system-ui, -apple-system, sans-serif;text-align:center;padding:60px 20px;background:#f0fdf4;color:#14532d;">
              <div style="max-width:480px;margin:0 auto;background:white;padding:35px;border-radius:24px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);border:1px solid #bbf7d0;">
                <div style="font-size:48px;margin-bottom:12px;">☁️ ✅</div>
                <h2 style="color:#15803d;margin:0 0 10px 0;font-size:22px;font-weight:800;">Google Account Connected!</h2>
                <p style="font-size:14px;color:#374151;line-height:1.5;">
                  Connected: <b style="color:#111827;">{user_email}</b><br>
                  Cloud Folder: <b style="color:#2563eb;">DollyPOS_Cloud_Backups</b>
                </p>
                <p style="font-size:12px;color:#6b7280;margin-top:15px;">
                  Automatic backups will now sync safely to your Google Drive. You can close this window.
                </p>
                <button onclick="window.close()" style="margin-top:15px;padding:10px 24px;background:#16a34a;color:white;border:none;border-radius:12px;font-weight:bold;cursor:pointer;font-size:13px;">
                  Return to Dolly POS
                </button>
              </div>
              <script>
                if (window.opener) {{
                  window.opener.postMessage({{ type: 'GOOGLE_DRIVE_CONNECTED', email: '{user_email}' }}, '*');
                }}
                setTimeout(function() {{ window.close(); }}, 3000);
              </script>
            </body>
            </html>"""
        )
    except Exception as e:
        return HTMLResponse(
            content=f"""<!DOCTYPE html>
            <html>
            <head><title>Google Connection Error - Dolly POS</title></head>
            <body style="font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#fef2f2;color:#991b1b;">
              <h2>❌ Authentication Error</h2>
              <p>{str(e)}</p>
              <button onclick="window.close()" style="margin-top:20px;padding:10px 20px;background:#ef4444;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Close</button>
            </body>
            </html>""",
            status_code=500
        )

@router.post("/save-preferences")
def save_backup_preferences(
    req: BackupPreferencesRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Saves backup destination ('BOTH', 'GOOGLE_DRIVE_ONLY', 'LOCAL_ONLY'), on-close toggle, and retention days."""
    st = db.query(StoreSettings).first()
    if not st:
        st = StoreSettings()
        db.add(st)

    if req.backup_destination is not None:
        st.backup_destination = req.backup_destination.upper()
    if req.backup_on_app_close is not None:
        st.backup_on_app_close = req.backup_on_app_close
    if req.backup_retention_days is not None:
        st.backup_retention_days = req.backup_retention_days

    db.commit()
    db.refresh(st)

    return {
        "success": True,
        "message": "Backup & Retention preferences saved successfully.",
        "backup_destination": st.backup_destination,
        "backup_on_app_close": st.backup_on_app_close,
        "backup_retention_days": st.backup_retention_days
    }

@router.post("/save-credentials")
def save_google_credentials(
    req: GoogleCredentialsRequest,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Saves custom OAuth 2.0 Client ID and Secret."""
    st = db.query(StoreSettings).first()
    if not st:
        st = StoreSettings()
        db.add(st)

    if req.client_id is not None:
        st.google_client_id = req.client_id.strip() if req.client_id else None
    if req.client_secret is not None:
        st.google_client_secret = req.client_secret.strip() if req.client_secret else None

    db.commit()
    return {
        "success": True,
        "message": "Custom Google OAuth credentials saved successfully."
    }

@router.post("/disconnect")
def disconnect_google_account(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Disconnects Google Account and revokes cloud backup access."""
    return google_drive_service.disconnect(db)

@router.post("/sync-now")
def sync_to_google_drive_now(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Triggers immediate database snapshot and upload to Google Drive."""
    res = backup_service.execute_full_backup_flow(db, force_cloud=True)
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("message"))
    return res

@router.get("/cloud-files")
def list_cloud_files(
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Returns list of backups currently stored in Google Drive folder."""
    files = google_drive_service.list_cloud_backups(db)
    return {
        "folder_name": "DollyPOS_Cloud_Backups",
        "total_files": len(files),
        "files": files
    }

@router.post("/restore/{file_id}")
def restore_from_google_drive(
    file_id: str,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """
    Downloads backup snapshot JSON directly from Google Drive cloud folder
    and restores 100% of products, transactions, ledgers, and inventory.
    """
    try:
        data = google_drive_service.download_cloud_backup_content(db, file_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cloud backup from Google Drive: {str(e)}")

    try:
        return backup_service.restore_database_from_dict(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database restore failed: {str(e)}")

@router.get("/download/{file_id}")
def download_cloud_backup_file(
    file_id: str,
    filename: Optional[str] = Query(None),
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    """Downloads a backup snapshot JSON file directly from Google Drive."""
    token = google_drive_service.get_valid_access_token(db)
    if not token:
        raise HTTPException(status_code=401, detail="Google Drive is not connected.")

    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(
        f"{GOOGLE_DRIVE_FILES_URL}/{file_id}?alt=media",
        headers=headers,
        timeout=45
    )
    if not resp.ok:
        raise HTTPException(status_code=500, detail="Failed to fetch file from Google Drive.")

    clean_name = filename or f"GoogleDrive_Backup_{file_id}.json"
    return Response(
        content=resp.content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{clean_name}"'}
    )


