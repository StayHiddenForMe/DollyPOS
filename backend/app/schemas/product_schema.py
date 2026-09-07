from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ProductBase(BaseModel):
    barcode: str
    sku: Optional[str] = None
    manufacture_code: Optional[str] = None
    vendor_code: Optional[str] = None
    name: str
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    brand: Optional[str] = None
    gender: Optional[str] = None
    age_group: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    fabric: Optional[str] = None
    season: Optional[str] = None
    tags: Optional[str] = None
    description: Optional[str] = None
    purchase_price: float = 0.0
    selling_price: float = 0.0
    mrp: float = 0.0
    gst_percent: float = 0.0
    margin_percent: float = 0.0
    stock_quantity: int = 0
    min_stock_alert: int = 3
    damaged_quantity: int = 0
    location_shelf: Optional[str] = None
    is_speed_dial: bool = False
    speed_dial_code: Optional[str] = None
    speed_dial_color: Optional[str] = "#3B82F6"
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductMultiSizeCreate(BaseModel):
    base_barcode: Optional[str] = None
    name: str
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    vendor_code: Optional[str] = None
    brand: Optional[str] = None
    gender: Optional[str] = "Unisex"
    age_group: Optional[str] = None
    sizes: List[str]  # e.g. ["22", "24", "26", "28"]
    color: Optional[str] = None
    fabric: Optional[str] = None
    season: Optional[str] = "All-Season"
    purchase_price: float = 0.0
    selling_price: float = 0.0
    mrp: float = 0.0
    gst_percent: float = 0.0
    stock_per_size: int = 1
    min_stock_alert: int = 3
    is_speed_dial: bool = False
    speed_dial_code: Optional[str] = None
    speed_dial_color: Optional[str] = "#3B82F6"

class ProductUpdate(BaseModel):
    barcode: Optional[str] = None
    sku: Optional[str] = None
    manufacture_code: Optional[str] = None
    vendor_code: Optional[str] = None
    name: Optional[str] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    brand: Optional[str] = None
    gender: Optional[str] = None
    age_group: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    fabric: Optional[str] = None
    season: Optional[str] = None
    tags: Optional[str] = None
    description: Optional[str] = None
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None
    mrp: Optional[float] = None
    gst_percent: Optional[float] = None
    margin_percent: Optional[float] = None
    stock_quantity: Optional[int] = None
    min_stock_alert: Optional[int] = None
    damaged_quantity: Optional[int] = None
    location_shelf: Optional[str] = None
    is_speed_dial: Optional[bool] = None
    speed_dial_code: Optional[str] = None
    speed_dial_color: Optional[str] = None
    is_active: Optional[bool] = None
    price_change_reason: Optional[str] = "Price Update"

class ProductPriceHistoryOut(BaseModel):
    id: int
    product_id: int
    old_purchase_price: float
    new_purchase_price: float
    old_selling_price: float
    new_selling_price: float
    old_mrp: float
    new_mrp: float
    reason: Optional[str] = None
    changed_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class MarkDamagedRequest(BaseModel):
    product_id: int
    quantity: int
    reason: str = "Damaged / Defective Stock"

class RestockDamagedRequest(BaseModel):
    product_id: int
    quantity: int
    reason: str = "Restocked / Repaired / Cleaned"

class ProductOut(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    last_purchased_at: Optional[datetime] = None
    last_sold_at: Optional[datetime] = None
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None

    class Config:
        from_attributes = True

class ProductSearchResult(BaseModel):
    items: List[ProductOut]
    total: int
    page: int
    page_size: int
