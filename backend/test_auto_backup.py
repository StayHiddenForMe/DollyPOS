import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.product_price_history import ProductPriceHistory
from app.models.settings import StoreSettings
from app.services.backup_service import backup_service
from app.api.backup_router import get_backup_status, save_backup_config, BackupConfigRequest

def test_auto_backup_system():
    print("==========================================================")
    print("     DOLLY POS - AUTOMATIC MONTHLY BACKUP TEST SUITE      ")
    print("==========================================================")

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        # 1. Test Saving Custom Backup Path
        test_dir = os.path.abspath("./test_backups_dir")
        os.makedirs(test_dir, exist_ok=True)
        print(f"\n[TEST 1] Setting custom backup path to: {test_dir}...")
        
        cfg_req = BackupConfigRequest(backup_path=test_dir, auto_backup=True, backup_frequency="MONTHLY")
        save_res = save_backup_config(cfg_req, current_user=owner, db=db)
        assert save_res["success"] == True
        print(f"  [PASS] Custom backup path saved in StoreSettings.")

        # 2. Test Instant Backup Creation
        print("\n[TEST 2] Creating Instant Backup in custom directory...")
        backup_res = backup_service.create_database_backup(db, custom_path=test_dir)
        assert backup_res["success"] == True
        assert os.path.exists(backup_res["file_path"])
        print(f"  [PASS] Backup file created: {backup_res['file_name']} (Size: {backup_res['file_size_kb']} KB, Products: {backup_res['product_count']})")

        # 3. Test Automatic 1st-of-the-Month Backup Runner
        print("\n[TEST 3] Testing Automatic Monthly Backup on 1st of every month...")
        auto_res = backup_service.check_and_run_monthly_auto_backup(db)
        assert auto_res["status"] in ["CREATED_NOW", "UP_TO_DATE"]
        assert os.path.exists(auto_res["file_path"])
        print(f"  [PASS] Monthly Backup: {os.path.basename(auto_res['file_path'])} (Status: {auto_res['status']})")

        # 4. Test Backup Status API
        print("\n[TEST 4] Testing GET /backup/status...")
        status_res = get_backup_status(current_user=owner, db=db)
        assert status_res["auto_backup_enabled"] == True
        assert status_res["total_backups_found"] >= 2
        print(f"  [PASS] Total backup files verified in destination directory: {status_res['total_backups_found']}")

        print("\n==========================================================")
        print("   AUTOMATIC MONTHLY BACKUP SYSTEM 100% OPERATIONAL!      ")
        print("==========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_auto_backup_system()
