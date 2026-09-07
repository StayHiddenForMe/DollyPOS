from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String(50), unique=True, index=True, nullable=False)
    sku = Column(String(50), unique=True, index=True, nullable=True)
    manufacture_code = Column(String(50), index=True, nullable=True)
    vendor_code = Column(String(50), index=True, nullable=True)
    name = Column(String(200), index=True, nullable=False)
    
    # Hierarchy
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    subcategory_id = Column(Integer, ForeignKey("subcategories.id", ondelete="SET NULL"), nullable=True)
    
    # Product Attributes
    brand = Column(String(100), nullable=True)
    gender = Column(String(30), nullable=True)
    age_group = Column(String(50), nullable=True)
    size = Column(String(50), index=True, nullable=True)
    color = Column(String(50), index=True, nullable=True)
    fabric = Column(String(100), nullable=True)
    season = Column(String(50), nullable=True)
    tags = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    
    # Financials
    purchase_price = Column(Float, default=0.0, nullable=False)
    selling_price = Column(Float, default=0.0, nullable=False)
    mrp = Column(Float, default=0.0, nullable=False)
    gst_percent = Column(Float, default=0.0, nullable=False)
    margin_percent = Column(Float, default=0.0, nullable=False)
    
    # Stock & Inventory
    stock_quantity = Column(Integer, default=0, nullable=False)
    min_stock_alert = Column(Integer, default=3, nullable=False)
    damaged_quantity = Column(Integer, default=0, nullable=False)
    location_shelf = Column(String(50), nullable=True)
    
    # Speed Dial & Fast Billing Shortcode (e.g. 1, M10, S01)
    is_speed_dial = Column(Boolean, default=False, nullable=False, index=True)
    speed_dial_code = Column(String(20), unique=True, index=True, nullable=True)
    speed_dial_color = Column(String(20), default="#3B82F6", nullable=True)
    
    # Status & Timestamps
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_purchased_at = Column(DateTime, nullable=True)
    last_sold_at = Column(DateTime, nullable=True)

    # Relationships
    category = relationship("Category", back_populates="products")
    subcategory = relationship("Subcategory", back_populates="products")
    invoice_items = relationship("InvoiceItem", back_populates="product")
    purchase_items = relationship("PurchaseItem", back_populates="product")
    return_items = relationship("ReturnItem", back_populates="product")
    price_history = relationship("ProductPriceHistory", back_populates="product", cascade="all, delete-orphan", order_by="desc(ProductPriceHistory.created_at)")

    # Composite Index
    __table_args__ = (
        Index("idx_product_search", "name", "barcode", "sku", "size", "color", "speed_dial_code"),
    )
