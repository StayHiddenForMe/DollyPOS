import os
import json
import logging
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.settings import StoreSettings

logger = logging.getLogger(__name__)

# Default Fallback OAuth Credentials (can be customized via StoreSettings)
DEFAULT_CLIENT_ID = "336916515822-dollypos.apps.googleusercontent.com"
DEFAULT_CLIENT_SECRET = "GOCSPX-DollyPOS_Secure_Key"

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"

FOLDER_NAME = "DollyPOS_Cloud_Backups"
SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email"

class GoogleDriveService:
    @staticmethod
    def _get_client_credentials(st: Optional[StoreSettings]) -> tuple[str, str]:
        client_id = (st.google_client_id if st and st.google_client_id else "").strip() or DEFAULT_CLIENT_ID
        client_secret = (st.google_client_secret if st and st.google_client_secret else "").strip() or DEFAULT_CLIENT_SECRET
        return client_id, client_secret

    @staticmethod
    def get_authorization_url(db: Session, redirect_uri: str = "http://localhost:8000/api/v1/google-drive/callback") -> str:
        """Generates Google OAuth 2.0 authorization URL for desktop app flow."""
        st = db.query(StoreSettings).first()
        client_id, _ = GoogleDriveService._get_client_credentials(st)

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true"
        }
        req = requests.Request("GET", GOOGLE_AUTH_URL, params=params).prepare()
        return req.url

    @staticmethod
    def exchange_code_for_tokens(
        db: Session, 
        code: str, 
        redirect_uri: str = "http://localhost:8000/api/v1/google-drive/callback"
    ) -> Dict[str, Any]:
        """Exchanges authorization code for tokens, retrieves user email, and initializes backup folder."""
        st = db.query(StoreSettings).first()
        if not st:
            st = StoreSettings()
            db.add(st)

        client_id, client_secret = GoogleDriveService._get_client_credentials(st)

        # 1. Exchange auth code for tokens
        token_data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri
        }

        token_resp = requests.post(GOOGLE_TOKEN_URL, data=token_data, timeout=10)
        if not token_resp.ok:
            logger.error(f"Google token exchange failed: {token_resp.text}")
            raise Exception(f"Google authentication failed: {token_resp.json().get('error_description', token_resp.text)}")

        token_json = token_resp.json()
        access_token = token_json.get("access_token")
        refresh_token = token_json.get("refresh_token")
        expires_in = token_json.get("expires_in", 3600)

        # 2. Fetch user profile email
        email = None
        try:
            userinfo_resp = requests.get(
                GOOGLE_USERINFO_URL, 
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=8
            )
            if userinfo_resp.ok:
                email = userinfo_resp.json().get("email")
        except Exception as e:
            logger.warning(f"Could not fetch Google user info: {e}")

        # 3. Store tokens in database
        st.google_drive_connected = True
        st.google_drive_access_token = access_token
        if refresh_token:
            st.google_drive_refresh_token = refresh_token
        st.google_drive_email = email or "connected_account@gmail.com"
        st.google_drive_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)
        db.commit()

        # 4. Ensure DollyPOS_Cloud_Backups folder exists
        try:
            folder_id = GoogleDriveService.ensure_backup_folder(db)
            st.google_drive_folder_id = folder_id
            db.commit()
        except Exception as e:
            logger.warning(f"Could not initialize Google Drive folder immediately: {e}")

        return {
            "success": True,
            "message": f"Successfully connected Google Account: {st.google_drive_email}",
            "email": st.google_drive_email,
            "folder_name": FOLDER_NAME,
            "folder_id": st.google_drive_folder_id
        }

    @staticmethod
    def get_valid_access_token(db: Session) -> Optional[str]:
        """Returns active access token, automatically refreshing if expired."""
        st = db.query(StoreSettings).first()
        if not st or not st.google_drive_connected:
            return None

        # Check if current token is still valid
        if st.google_drive_access_token and st.google_drive_token_expires_at:
            if datetime.utcnow() < st.google_drive_token_expires_at:
                return st.google_drive_access_token

        # Needs refresh
        if not st.google_drive_refresh_token:
            return st.google_drive_access_token

        client_id, client_secret = GoogleDriveService._get_client_credentials(st)
        refresh_data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": st.google_drive_refresh_token,
            "grant_type": "refresh_token"
        }

        try:
            resp = requests.post(GOOGLE_TOKEN_URL, data=refresh_data, timeout=8)
            if resp.ok:
                resp_json = resp.json()
                new_token = resp_json.get("access_token")
                expires_in = resp_json.get("expires_in", 3600)
                st.google_drive_access_token = new_token
                st.google_drive_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)
                db.commit()
                return new_token
            else:
                logger.error(f"Failed to refresh Google token: {resp.text}")
        except Exception as e:
            logger.error(f"Error refreshing Google token: {e}")

        return st.google_drive_access_token

    @staticmethod
    def ensure_backup_folder(db: Session) -> str:
        """Finds or creates the dedicated DollyPOS_Cloud_Backups folder on Google Drive."""
        token = GoogleDriveService.get_valid_access_token(db)
        if not token:
            raise Exception("Google Drive is not connected or token is invalid.")

        st = db.query(StoreSettings).first()
        headers = {"Authorization": f"Bearer {token}"}

        # Check if existing folder_id is still valid
        if st and st.google_drive_folder_id:
            try:
                check_resp = requests.get(
                    f"{GOOGLE_DRIVE_FILES_URL}/{st.google_drive_folder_id}?fields=id,name,trashed",
                    headers=headers,
                    timeout=6
                )
                if check_resp.ok and not check_resp.json().get("trashed"):
                    return st.google_drive_folder_id
            except Exception:
                pass

        # Search for existing folder by name
        query = f"name = '{FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        search_resp = requests.get(
            GOOGLE_DRIVE_FILES_URL,
            headers=headers,
            params={"q": query, "fields": "files(id, name)"},
            timeout=8
        )

        if search_resp.ok:
            files = search_resp.json().get("files", [])
            if files:
                folder_id = files[0]["id"]
                if st:
                    st.google_drive_folder_id = folder_id
                    db.commit()
                return folder_id

        # Create folder if not found
        folder_metadata = {
            "name": FOLDER_NAME,
            "mimeType": "application/vnd.google-apps.folder",
            "description": "Automated Cloud Backups for Dolly POS System"
        }
        create_resp = requests.post(
            GOOGLE_DRIVE_FILES_URL,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=folder_metadata,
            timeout=8
        )

        if not create_resp.ok:
            raise Exception(f"Failed to create Google Drive backup folder: {create_resp.text}")

        folder_id = create_resp.json()["id"]
        if st:
            st.google_drive_folder_id = folder_id
            db.commit()
        return folder_id

    @staticmethod
    def upload_backup_file(db: Session, file_path: str, custom_filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Uploads a local backup JSON snapshot to Google Drive in the DollyPOS_Cloud_Backups folder.
        Uses multipart upload for zero-overhead performance.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Backup file not found: {file_path}")

        token = GoogleDriveService.get_valid_access_token(db)
        if not token:
            raise Exception("Google Drive is not connected. Please connect your Google Account in Settings.")

        folder_id = GoogleDriveService.ensure_backup_folder(db)
        file_name = custom_filename or os.path.basename(file_path)
        file_size = os.path.getsize(file_path)

        with open(file_path, "r", encoding="utf-8") as f:
            file_content = f.read()

        metadata = {
            "name": file_name,
            "parents": [folder_id],
            "description": f"Dolly POS Database Snapshot created at {datetime.now().strftime('%Y-%m-%d %I:%M %p')}",
            "mimeType": "application/json"
        }

        files = {
            "data": ("metadata", json.dumps(metadata), "application/json; charset=UTF-8"),
            "file": (file_name, file_content, "application/json")
        }

        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.post(
            GOOGLE_DRIVE_UPLOAD_URL,
            headers=headers,
            files=files,
            timeout=25
        )

        if not resp.ok:
            raise Exception(f"Google Drive upload failed: {resp.text}")

        resp_json = resp.json()
        cloud_file_id = resp_json.get("id")

        # Update last cloud backup timestamp in settings
        st = db.query(StoreSettings).first()
        if st:
            st.last_cloud_backup_at = datetime.utcnow()
            db.commit()

        # Trigger auto-purge of old cloud backups based on configured retention
        purged_count = 0
        try:
            retention_days = st.backup_retention_days if st else 30
            if retention_days > 0:
                purged_count = GoogleDriveService.purge_old_cloud_backups(db, retention_days)
        except Exception as e:
            logger.warning(f"Could not purge old cloud backups: {e}")

        return {
            "success": True,
            "file_id": cloud_file_id,
            "file_name": file_name,
            "size_kb": round(file_size / 1024, 2),
            "folder_name": FOLDER_NAME,
            "folder_id": folder_id,
            "cloud_purged": purged_count,
            "uploaded_at": datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
        }

    @staticmethod
    def purge_old_cloud_backups(db: Session, retention_days: int) -> int:
        """
        Deletes backup files older than retention_days from the DollyPOS_Cloud_Backups folder.
        If retention_days is 0 (Never Delete), no files are purged.
        """
        if retention_days <= 0:
            return 0

        token = GoogleDriveService.get_valid_access_token(db)
        if not token:
            return 0

        try:
            folder_id = GoogleDriveService.ensure_backup_folder(db)
        except Exception:
            return 0

        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        cutoff_iso = cutoff_date.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Query files created before cutoff in the backup folder
        query = f"'{folder_id}' in parents and createdTime < '{cutoff_iso}' and trashed = false"
        headers = {"Authorization": f"Bearer {token}"}

        resp = requests.get(
            GOOGLE_DRIVE_FILES_URL,
            headers=headers,
            params={"q": query, "fields": "files(id, name, createdTime)"},
            timeout=10
        )

        if not resp.ok:
            logger.warning(f"Failed to query old backups for purge: {resp.text}")
            return 0

        files_to_delete = resp.json().get("files", [])
        deleted_count = 0

        for file_info in files_to_delete:
            file_id = file_info.get("id")
            file_name = file_info.get("name")
            try:
                del_resp = requests.delete(
                    f"{GOOGLE_DRIVE_FILES_URL}/{file_id}",
                    headers=headers,
                    timeout=6
                )
                if del_resp.status_code in [200, 204]:
                    deleted_count += 1
                    logger.info(f"Purged expired cloud backup ({retention_days}d retention): {file_name}")
            except Exception as e:
                logger.warning(f"Failed to delete expired cloud backup {file_name}: {e}")

        return deleted_count

    @staticmethod
    def list_cloud_backups(db: Session) -> List[Dict[str, Any]]:
        """Lists all database backups stored in the DollyPOS_Cloud_Backups folder."""
        token = GoogleDriveService.get_valid_access_token(db)
        if not token:
            return []

        try:
            folder_id = GoogleDriveService.ensure_backup_folder(db)
        except Exception:
            return []

        query = f"'{folder_id}' in parents and trashed = false"
        headers = {"Authorization": f"Bearer {token}"}

        resp = requests.get(
            GOOGLE_DRIVE_FILES_URL,
            headers=headers,
            params={
                "q": query,
                "fields": "files(id, name, size, createdTime, webViewLink)",
                "orderBy": "createdTime desc"
            },
            timeout=10
        )

        if not resp.ok:
            return []

        files = resp.json().get("files", [])
        result = []
        for f in files:
            size_bytes = int(f.get("size", 0))
            result.append({
                "id": f.get("id"),
                "filename": f.get("name"),
                "size_kb": round(size_bytes / 1024, 2) if size_bytes else 0,
                "created_time": f.get("createdTime"),
                "web_link": f.get("webViewLink")
            })

        return result

    @staticmethod
    def download_cloud_backup_content(db: Session, file_id: str) -> Dict[str, Any]:
        """Downloads and parses the JSON content of a backup file from Google Drive."""
        token = GoogleDriveService.get_valid_access_token(db)
        if not token:
            raise Exception("Google Drive is not connected or session expired. Please connect your Google Account.")

        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(
            f"{GOOGLE_DRIVE_FILES_URL}/{file_id}?alt=media",
            headers=headers,
            timeout=45
        )
        if not resp.ok:
            raise Exception(f"Failed to download cloud backup file from Google Drive: {resp.text}")

        try:
            return resp.json()
        except Exception as e:
            raise Exception(f"Invalid JSON content in downloaded Google Drive backup file: {str(e)}")

    @staticmethod
    def disconnect(db: Session) -> Dict[str, Any]:
        """Disconnects and clears stored Google Drive credentials."""
        st = db.query(StoreSettings).first()
        if not st:
            return {"success": True, "message": "No settings found."}

        # Attempt token revocation at Google endpoint
        if st.google_drive_access_token or st.google_drive_refresh_token:
            token_to_revoke = st.google_drive_refresh_token or st.google_drive_access_token
            try:
                requests.post(GOOGLE_REVOKE_URL, params={"token": token_to_revoke}, timeout=5)
            except Exception:
                pass

        prev_email = st.google_drive_email
        st.google_drive_connected = False
        st.google_drive_email = None
        st.google_drive_folder_id = None
        st.google_drive_access_token = None
        st.google_drive_refresh_token = None
        st.google_drive_token_expires_at = None
        db.commit()

        return {
            "success": True,
            "message": f"Successfully disconnected Google Account ({prev_email or 'Account'})."
        }

google_drive_service = GoogleDriveService()
