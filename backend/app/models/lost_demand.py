from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Enum as SQLEnum
from app.core.database import Base
import enum

class LostDemandStatus(str, enum.Enum):
    PENDING_PROCUREMENT = "PENDING_PROCUREMENT"
    ORDERED_WITH_VENDOR = "ORDERED_WITH_VENDOR"
    FULFILLED = "FULFILLED"

class LostDemandUrgency(str, enum.Enum):
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"

class LostDemand(Base):
    __tablename__ = "lost_demand_logs"

    id = Column(Integer, primary_key=True, index=True)
    item_description = Column(String(255), nullable=False, index=True)
    category_name = Column(String(100), nullable=True)
    preferred_size = Column(String(50), nullable=True)
    preferred_color = Column(String(50), nullable=True)
    customer_name = Column(String(100), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    request_count = Column(Integer, default=1, nullable=False)
    urgency = Column(SQLEnum(LostDemandUrgency), default=LostDemandUrgency.NORMAL, nullable=False)
    status = Column(SQLEnum(LostDemandStatus), default=LostDemandStatus.PENDING_PROCUREMENT, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class ProcurementNote(Base):
    __tablename__ = "procurement_notes"

    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String(255), nullable=False, index=True)
    quantity = Column(Integer, default=1, nullable=False)
    description = Column(Text, nullable=True)
    vendor_name = Column(String(255), nullable=True, index=True)
    estimated_price = Column(Float, nullable=True, default=0.0)
    priority = Column(String(50), default="NORMAL", nullable=False)  # LOW, NORMAL, HIGH, URGENT
    status = Column(String(50), default="PENDING", nullable=False)    # PENDING, ORDERED, COMPLETED, CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

