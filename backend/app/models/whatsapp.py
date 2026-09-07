from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Enum as SQLEnum
from app.core.database import Base
import enum

class WhatsAppStatus(str, enum.Enum):
    SENT = "SENT"
    QUEUED = "QUEUED"
    FAILED = "FAILED"

class WhatsAppMessageType(str, enum.Enum):
    BILL_RECEIPT = "BILL_RECEIPT"
    FESTIVAL_GREETING = "FESTIVAL_GREETING"
    KHATA_REMINDER = "KHATA_REMINDER"
    CUSTOM_BROADCAST = "CUSTOM_BROADCAST"

class WhatsAppProvider(str, enum.Enum):
    DIRECT_WEB = "DIRECT_WEB"
    META_CLOUD_API = "META_CLOUD_API"

class WhatsAppConfig(Base):
    __tablename__ = "whatsapp_config"

    id = Column(Integer, primary_key=True, index=True)
    store_phone = Column(String(20), default="7972558842", nullable=False)
    store_name = Column(String(100), default="Dolly Toys and Kids Wear", nullable=False)
    provider = Column(SQLEnum(WhatsAppProvider), default=WhatsAppProvider.DIRECT_WEB, nullable=False)
    meta_api_token = Column(Text, nullable=True)
    meta_phone_number_id = Column(String(100), nullable=True)
    meta_business_account_id = Column(String(100), nullable=True)
    is_connected = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class WhatsAppLog(Base):
    __tablename__ = "whatsapp_logs"

    id = Column(Integer, primary_key=True, index=True)
    recipient_name = Column(String(100), nullable=True)
    recipient_phone = Column(String(20), nullable=False, index=True)
    message_type = Column(SQLEnum(WhatsAppMessageType), default=WhatsAppMessageType.CUSTOM_BROADCAST, nullable=False)
    message_text = Column(Text, nullable=False)
    status = Column(SQLEnum(WhatsAppStatus), default=WhatsAppStatus.SENT, nullable=False)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
