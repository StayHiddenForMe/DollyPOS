from pydantic import BaseModel
from typing import Optional, List

class SubcategoryBase(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None

class SubcategoryCreate(SubcategoryBase):
    pass

class SubcategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class SubcategoryOut(SubcategoryBase):
    id: int

    class Config:
        from_attributes = True

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "Package"

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None

class CategoryOut(CategoryBase):
    id: int
    subcategories: List[SubcategoryOut] = []

    class Config:
        from_attributes = True
