import json
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Optional, Any

def log_action(
    db: Session,
    user_id: Optional[int],
    action_type: str,
    entity: str,
    entity_id: Optional[str] = None,
    details: Optional[Any] = None,
    ip_address: Optional[str] = None
):
    try:
        from app.models.audit_log import AuditLog
        details_str = json.dumps(details, default=str) if details else None
        audit_entry = AuditLog(
            user_id=user_id,
            action_type=action_type,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            details_json=details_str,
            ip_address=ip_address,
            created_at=datetime.utcnow()
        )
        db.add(audit_entry)
        db.commit()
    except Exception as e:
        print(f"Error logging audit: {e}")
        db.rollback()
