import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.api.ai_router import get_longevity_audit, optimize_database_indexes

def test_ai_longevity():
    print("Testing /ai/longevity-audit and /ai/optimize-indexes...")
    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.username == "admin").first()
        assert owner is not None

        audit = get_longevity_audit(current_user=owner, db=db)
        assert "current_product_count" in audit
        assert "projected_50_year_size_gb" in audit
        print(f"[PASS] Longevity audit: {audit['current_product_count']} products, {audit['current_invoice_count']} bills, 50-yr DB: ~{audit['projected_50_year_size_gb']} GB")

        opt = optimize_database_indexes(current_user=owner, db=db)
        assert opt["success"] == True
        print(f"[PASS] Optimize indexes: {opt['message']}")
    finally:
        db.close()

if __name__ == "__main__":
    test_ai_longevity()
