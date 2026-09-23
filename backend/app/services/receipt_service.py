from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from app.services.upi_service import upi_service

def format_ist_datetime(dt: Optional[datetime]) -> str:
    """Converts UTC datetime into Indian Standard Time (IST: UTC+5:30) string."""
    if not dt:
        return ""
    ist_time = dt + timedelta(hours=5, minutes=30)
    return ist_time.strftime("%d-%m-%Y %I:%M %p")

class ReceiptService:
    @staticmethod
    def build_thermal_receipt_data(
        invoice: Any,
        store_settings: Any,
        is_gift_receipt: bool = False
    ) -> Dict[str, Any]:
        raw_shop_name = store_settings.shop_name if store_settings else "Dolly Toys & Kids Wear"
        import re
        shop_name = re.sub(r'\band\b', '&', raw_shop_name, flags=re.IGNORECASE)
        tag_line = getattr(store_settings, 'tag_line', "Exclusive Kids Wear & Quality Toys") if store_settings else "Exclusive Kids Wear & Quality Toys"
        address = store_settings.address if store_settings else "Agra Road, Near Mahatma Gandhi Statue, Dhule"
        mobile = store_settings.mobile if store_settings else "7972558842"
        upi_id = store_settings.upi_id if store_settings else "7972558842@upi"
        bill_header = store_settings.bill_header if store_settings else "Tax Invoice / Retail Bill"
        bill_footer = store_settings.bill_footer if store_settings else "Thank you for shopping at Dolly Toys & Kids Wear!"
        
        # Terms & Conditions
        show_terms = getattr(store_settings, 'show_terms_on_bill', True) if store_settings else True
        terms_and_conditions = getattr(store_settings, 'terms_and_conditions', "1. Goods once sold can be exchanged within 7 days with original tag and bill intact.\n2. No cash refund.") if (store_settings and show_terms) else None

        # Social Media Branding
        show_instagram = getattr(store_settings, 'show_instagram_on_bill', True) if store_settings else False
        instagram_handle = getattr(store_settings, 'instagram_handle', "@dollytoys_dhule") if (store_settings and show_instagram) else None

        show_facebook = getattr(store_settings, 'show_facebook_on_bill', False) if store_settings else False
        facebook_handle = getattr(store_settings, 'facebook_handle', None) if (store_settings and show_facebook) else None

        show_threads = getattr(store_settings, 'show_threads_on_bill', False) if store_settings else False
        threads_handle = getattr(store_settings, 'threads_handle', None) if (store_settings and show_threads) else None

        show_website = getattr(store_settings, 'show_website_on_bill', False) if store_settings else False
        website_url = getattr(store_settings, 'website_url', None) if (store_settings and show_website) else None

        # Build list of active custom social handles
        custom_socials = []
        for idx in ["", "2", "3", "4", "5"]:
            show_flag = getattr(store_settings, f'show_custom_social_on_bill{idx}', False) if store_settings else False
            lbl = getattr(store_settings, f'custom_social_label{idx}', None) if store_settings else None
            hndl = getattr(store_settings, f'custom_social_handle{idx}', None) if store_settings else None
            if show_flag and hndl:
                custom_socials.append({"label": lbl or "Custom", "handle": hndl})

        show_custom_social = len(custom_socials) > 0

        # GSTIN conditionally shown
        show_gst = getattr(store_settings, 'show_gst_on_bill', False) if store_settings else False
        gstin = store_settings.gstin if (store_settings and show_gst and store_settings.gstin) else None

        items = []
        for item in invoice.items:
            items.append({
                "item_name": item.item_name,
                "barcode": item.barcode or "",
                "size": item.size or "",
                "color": item.color or "",
                "quantity": item.quantity,
                "unit_price": item.unit_price if not is_gift_receipt else 0.0,
                "discount_amount": item.discount_amount if not is_gift_receipt else 0.0,
                "total_price": item.total_price if not is_gift_receipt else 0.0,
            })

        show_upi_qr = getattr(store_settings, 'show_upi_qr_on_bill', True) if store_settings else True
        qr_info = None
        if not is_gift_receipt and invoice.grand_total > 0 and show_upi_qr:
            qr_info = upi_service.generate_upi_qr_base64(
                upi_id=upi_id,
                merchant_name=shop_name,
                amount=invoice.grand_total,
                bill_number=invoice.bill_number
            )

        bill_date_str = format_ist_datetime(invoice.created_at) if isinstance(invoice.created_at, datetime) else str(invoice.created_at)

        is_tagline_bold = getattr(store_settings, 'is_tagline_bold', False) if store_settings else False
        footer_font_size = getattr(store_settings, 'footer_font_size', '10px') if store_settings else '10px'
        is_footer_bold = getattr(store_settings, 'is_footer_bold', False) if store_settings else False
        power_footer_text = getattr(store_settings, 'power_footer_text', "Software powered by Dolly POS© | Since 2002") if store_settings else "Software powered by Dolly POS© | Since 2002"
        power_footer_font_size = getattr(store_settings, 'power_footer_font_size', '9px') if store_settings else '9px'
        is_power_footer_bold = getattr(store_settings, 'is_power_footer_bold', False) if store_settings else False

        return {
            "shop_name": shop_name,
            "tag_line": tag_line,
            "is_tagline_bold": is_tagline_bold,
            "address": address,
            "mobile": mobile,
            "gstin": gstin,
            "show_gst": show_gst and bool(gstin),
            "upi_id": upi_id,
            "show_upi_qr_on_bill": show_upi_qr,
            "bill_header": bill_header,
            "bill_footer": bill_footer,
            "footer_font_size": footer_font_size,
            "is_footer_bold": is_footer_bold,
            "power_footer_text": power_footer_text,
            "power_footer_font_size": power_footer_font_size,
            "is_power_footer_bold": is_power_footer_bold,
            "terms_and_conditions": terms_and_conditions,
            "show_terms_on_bill": show_terms,
            "instagram_handle": instagram_handle,
            "show_instagram_on_bill": show_instagram and bool(instagram_handle),
            "facebook_handle": facebook_handle,
            "show_facebook_on_bill": show_facebook and bool(facebook_handle),
            "threads_handle": threads_handle,
            "show_threads_on_bill": show_threads and bool(threads_handle),
            "website_url": website_url,
            "show_website_on_bill": show_website and bool(website_url),
            "custom_socials": custom_socials,
            "show_custom_social_on_bill": show_custom_social,
            "bill_number": invoice.bill_number,
            "bill_date": bill_date_str,
            "customer_name": invoice.customer_name or "Walk-in Customer",
            "customer_phone": invoice.customer_phone or "",
            "is_gift_receipt": is_gift_receipt,
            "items": items,
            "items_count": len(items),
            "total_quantity": sum(i["quantity"] for i in items),
            "total_items": sum(i["quantity"] for i in items),
            "subtotal": invoice.subtotal if not is_gift_receipt else 0.0,
            "discount_amount": invoice.discount_amount if not is_gift_receipt else 0.0,
            "tax_amount": invoice.tax_amount if not is_gift_receipt else 0.0,
            "extra_charges_amount": getattr(invoice, 'extra_charges_amount', 0.0) if not is_gift_receipt else 0.0,
            "extra_charges_breakdown": getattr(invoice, 'extra_charges_breakdown', None) if not is_gift_receipt else None,
            "round_off": invoice.round_off if not is_gift_receipt else 0.0,
            "grand_total": invoice.grand_total if not is_gift_receipt else 0.0,
            "paid_amount": invoice.paid_amount if not is_gift_receipt else 0.0,
            "change_amount": invoice.change_amount if not is_gift_receipt else 0.0,
            "due_amount": invoice.due_amount if not is_gift_receipt else 0.0,
            "payment_mode": invoice.payment_mode.value if hasattr(invoice.payment_mode, 'value') else str(invoice.payment_mode),
            "upi_qr_base64": qr_info["qr_image_base64"] if qr_info else None,
            "thermal_width": store_settings.thermal_width if store_settings else "80mm",
            "whatsapp_bill_template": getattr(store_settings, 'whatsapp_bill_template', None) if store_settings else None
        }

receipt_service = ReceiptService()
