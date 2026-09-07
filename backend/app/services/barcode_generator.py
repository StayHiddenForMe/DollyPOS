import io
import base64
import barcode
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont
from typing import Optional, Dict, Any

class BarcodeGenerator:
    @staticmethod
    def generate_code128_base64(code: str) -> str:
        """Generates a 95% wide 1D Code128 barcode with bold TrueType numeric digits."""
        import os
        code128 = barcode.get_barcode_class('code128')
        writer = ImageWriter()
        
        # Load high-contrast bold font on Windows if available
        bold_font_candidates = [
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/calibrib.ttf",
            "C:/Windows/Fonts/segoeuib.ttf"
        ]
        for f_path in bold_font_candidates:
            if os.path.exists(f_path):
                writer.font_path = f_path
                break
                
        writer.font_size = 14
        writer.text_distance = 2.5
        
        buffer = io.BytesIO()
        barcode_instance = code128(code, writer=writer)
        barcode_instance.write(buffer, options={
            "module_width": 0.46,
            "module_height": 10.5,
            "quiet_zone": 1.0,
            "write_text": True
        })
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{img_base64}"

    @staticmethod
    def generate_printable_label(
        shop_name: str,
        product_name: str,
        barcode_val: str,
        selling_price: float,
        mrp: Optional[float] = None,
        sku: Optional[str] = None,
        size: Optional[str] = None,
        color: Optional[str] = None,
        label_size_mm: str = "50x25mm"
    ) -> Dict[str, Any]:
        """
        Creates a structured label payload containing barcode base64 and formatted product details
        for direct rendering and thermal label printing.
        """
        barcode_data_url = BarcodeGenerator.generate_code128_base64(barcode_val)
        display_mrp = mrp if mrp and mrp > 0 else selling_price
        return {
            "shop_name": shop_name or "DOLLY TOYS & KIDS WEAR",
            "product_name": product_name,
            "barcode": barcode_val,
            "barcode_image": barcode_data_url,
            "selling_price": selling_price,
            "mrp": display_mrp,
            "sku": sku or "",
            "size": size or "",
            "color": color or "",
            "label_size_mm": label_size_mm
        }

barcode_service = BarcodeGenerator()
