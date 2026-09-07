from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.core.database import get_db
from app.api.auth_router import get_current_user, require_owner
from app.models.user import User
from app.models.category import Category, Subcategory
from app.schemas.category_schema import (
    CategoryOut, CategoryCreate, CategoryUpdate,
    SubcategoryOut, SubcategoryCreate, SubcategoryUpdate
)

router = APIRouter(prefix="/categories", tags=["Categories & Subcategories"])

@router.get("", response_model=List[CategoryOut])
def get_all_categories(db: Session = Depends(get_db)):
    """Fetches all product categories with their subcategories."""
    categories = db.query(Category).options(joinedload(Category.subcategories)).order_by(Category.id).all()
    return categories

@router.post("", response_model=CategoryOut)
def create_category(
    cat_in: CategoryCreate,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    existing = db.query(Category).filter(Category.name.ilike(cat_in.name.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Category '{cat_in.name}' already exists")

    cat = Category(
        name=cat_in.name.strip(),
        description=cat_in.description,
        icon=cat_in.icon or "Package"
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    cat_in: CategoryUpdate,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if cat_in.name:
        cat.name = cat_in.name.strip()
    if cat_in.description is not None:
        cat.description = cat_in.description
    if cat_in.icon:
        cat.icon = cat_in.icon

    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(cat)
    db.commit()
    return {"message": "Category deleted successfully"}

# --- Subcategories ---

@router.post("/subcategories", response_model=SubcategoryOut)
def create_subcategory(
    sub_in: SubcategoryCreate,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == sub_in.category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Parent Category not found")

    sub = Subcategory(
        category_id=sub_in.category_id,
        name=sub_in.name.strip(),
        description=sub_in.description
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub

@router.put("/subcategories/{subcategory_id}", response_model=SubcategoryOut)
def update_subcategory(
    subcategory_id: int,
    sub_in: SubcategoryUpdate,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    sub = db.query(Subcategory).filter(Subcategory.id == subcategory_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    if sub_in.name:
        sub.name = sub_in.name.strip()
    if sub_in.description is not None:
        sub.description = sub_in.description

    db.commit()
    db.refresh(sub)
    return sub

@router.delete("/subcategories/{subcategory_id}")
def delete_subcategory(
    subcategory_id: int,
    current_user: User = Depends(require_owner),
    db: Session = Depends(get_db)
):
    sub = db.query(Subcategory).filter(Subcategory.id == subcategory_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    db.delete(sub)
    db.commit()
    return {"message": "Subcategory deleted"}
