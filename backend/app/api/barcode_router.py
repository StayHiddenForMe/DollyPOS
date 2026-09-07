from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.product import Product
from app.models.settings import StoreSettings
from app.services.barcode_generator import barcode_service

router = APIRouter(prefix="/barcode", tags=["Barcode & Label Generator"])

class SingleBarcodeRequest(BaseModel):
    product_id: Optional[int] = None
    barcode: str
    product_name: str
    selling_price: float
    sku: Optional[str] = ""
    size: Optional[str] = ""
    color: Optional[str] = ""
    label_size_mm: Optional[str] = "50x25mm"

class BatchBarcodeItem(BaseModel):
    product_id: int
    copies: int = 1

class BatchBarcodeRequest(BaseModel):
    items: List[BatchBarcodeItem]
    label_size_mm: Optional[str] = "50x25mm"

@router.get("/generate/{barcode_val}")
@router.get("/preview/{barcode_val}")
def generate_barcode_preview(barcode_val: str):
    """Returns Base64 1D Code128 image string."""
    try:
        img_data_url = barcode_service.generate_code128_base64(barcode_val)
        return {
            "barcode": barcode_val,
            "image_data_url": img_data_url,
            "barcode_base64": img_data_url
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate barcode: {str(e)}")

@router.post("/label")
def generate_single_label(req: SingleBarcodeRequest, db: Session = Depends(get_db)):
    """Generates complete printable sticker metadata."""
    settings = db.query(StoreSettings).first()
    shop_name = settings.shop_name if settings else "DOLLY TOYS & KIDS WEAR"
    
    return barcode_service.generate_printable_label(
        shop_name=shop_name,
        product_name=req.product_name,
        barcode_val=req.barcode,
        selling_price=req.selling_price,
        mrp=req.selling_price,
        sku=req.sku,
        size=req.size,
        color=req.color,
        label_size_mm=req.label_size_mm or (settings.barcode_label_size if settings else "50x25mm")
    )

@router.post("/batch-labels")
def generate_batch_labels(req: BatchBarcodeRequest, db: Session = Depends(get_db)):
    """Generates repeated list of printable stickers for mass printing."""
    settings = db.query(StoreSettings).first()
    shop_name = settings.shop_name if settings else "DOLLY TOYS & KIDS WEAR"
    label_size = req.label_size_mm or (settings.barcode_label_size if settings else "50x25mm")

    labels = []
    for item in req.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if prod:
            label_data = barcode_service.generate_printable_label(
                shop_name=shop_name,
                product_name=prod.name,
                barcode_val=prod.barcode,
                selling_price=prod.selling_price,
                mrp=prod.mrp,
                sku=prod.sku,
                size=prod.size,
                color=prod.color,
                label_size_mm=label_size
            )
            for _ in range(item.copies):
                labels.append(label_data)

    return {"labels": labels, "total_labels": len(labels), "label_size_mm": label_size}

@router.post("/export-bartender-csv")
def export_bartender_csv(req: BatchBarcodeRequest, db: Session = Depends(get_db)):
    """
    Exports a BarTender-ready CSV file formatted for TSC TE244 barcode software.
    Columns: ProductName, Size, Color, SKU, Barcode, MRP, Price, Copies
    """
    import io
    import csv
    from fastapi.responses import Response

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ProductName", "Size", "Color", "SKU", "Barcode", "MRP", "Price", "Copies"])

    for item in req.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if prod:
            display_mrp = prod.mrp if prod.mrp and prod.mrp > 0 else prod.selling_price
            writer.writerow([
                prod.name,
                prod.size or "",
                prod.color or "",
                prod.sku or f"DLY-{prod.barcode[-6:]}",
                prod.barcode,
                f"{display_mrp:.2f}",
                f"{prod.selling_price:.2f}",
                item.copies
            ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=DollyToys_BarTender_Labels.csv"}
    )

