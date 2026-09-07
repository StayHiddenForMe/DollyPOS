from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String(50), nullable=False, index=True)  # 'CREATE_BILL', 'CANCEL_BILL', 'ADD_PRODUCT', 'DELETE_PRODUCT', 'UPDATE_SETTINGS', etc.
    entity = Column(String(50), nullable=False, index=True)       # 'INVOICE', 'PRODUCT', 'EXPENSE', 'SETTINGS', 'USER'
    entity_id = Column(String(50), nullable=True)
    details_json = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")
