import io
import base64
import urllib.parse
import qrcode
from typing import Dict, Any, Optional

class UPIService:
    @staticmethod
    def generate_upi_uri(
        upi_id: str,
        merchant_name: str,
        amount: float,
        bill_number: str,
        currency: str = "INR"
    ) -> str:
        """
        Builds a compliant NPCI UPI payment URL with encoded parameters.
        Format: upi://pay?pa={upi_id}&pn={name}&am={amount}&cu=INR&tn=Bill_{bill_number}
        """
        encoded_name = urllib.parse.quote(merchant_name)
        encoded_note = urllib.parse.quote(f"Bill {bill_number}")
        formatted_amount = f"{amount:.2f}"
        
        uri = (
            f"upi://pay?pa={upi_id}"
            f"&pn={encoded_name}"
            f"&am={formatted_amount}"
            f"&cu={currency}"
            f"&tn={encoded_note}"
        )
        return uri

    @staticmethod
    def generate_upi_qr_base64(
        upi_id: str,
        merchant_name: str,
        amount: float,
        bill_number: str
    ) -> Dict[str, Any]:
        """
        Generates a high-contrast QR code image for scanning with GPay, PhonePe, Paytm, BHIM, etc.
        """
        uri = UPIService.generate_upi_uri(upi_id, merchant_name, amount, bill_number)
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2
        )
        qr.add_data(uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return {
            "upi_uri": uri,
            "qr_image_base64": f"data:image/png;base64,{img_base64}",
            "amount": amount,
            "bill_number": bill_number,
            "merchant_name": merchant_name,
            "upi_id": upi_id
        }

upi_service = UPIService()
