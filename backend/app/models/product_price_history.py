from datetime import datetime
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship
from app.core.database import Base

class ProductPriceHistory(Base):
    __tablename__ = "product_price_history"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    old_purchase_price = Column(Float, default=0.0)
    new_purchase_price = Column(Float, default=0.0)
    old_selling_price = Column(Float, default=0.0)
    new_selling_price = Column(Float, default=0.0)
    old_mrp = Column(Float, default=0.0)
    new_mrp = Column(Float, default=0.0)
    reason = Column(String(200), default="Price Update")
    changed_by = Column(String(100), default="Admin")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="price_history")
