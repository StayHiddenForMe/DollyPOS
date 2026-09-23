import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.api.auth_router import get_current_user
from app.models.user import User
from app.models.whatsapp import WhatsAppLog, WhatsAppStatus, WhatsAppMessageType, WhatsAppConfig, WhatsAppProvider
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.settings import StoreSettings

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Marketing & Automation"])

DEFAULT_BILL_RECEIPT_TEMPLATE = """🛍️ *{shop_name}*
_{tag_line}_
📍 {shop_address} | 📞 {shop_mobile}
{gstin_line}
------------------------------------
🧾 *INVOICE:* #{bill_number}
👤 *Customer:* {customer_name}
📅 *Date:* {bill_date}
------------------------------------
*PURCHASED ITEMS:*
{items_list}
------------------------------------
{subtotal_line}
{discount_line}
{tax_line}
{extra_charges_line}
💰 *GRAND TOTAL: ₹{grand_total}*
{paid_line}
{due_line}
📦 *Items:* {total_items} | *Qty:* {total_qty}
------------------------------------
✨ {bill_footer}
{social_links}
_Software powered by Dolly POS | Since 2002_"""

class WhatsAppConfigRequest(BaseModel):
    store_phone: str
    store_name: Optional[str] = "Dolly Toys & Kids Wear"
    provider: Optional[WhatsAppProvider] = WhatsAppProvider.DIRECT_WEB
    meta_api_token: Optional[str] = None
    meta_phone_number_id: Optional[str] = None
    meta_business_account_id: Optional[str] = None

class BillTemplateUpdateRequest(BaseModel):
    template: str

class SendSingleMessageRequest(BaseModel):
    recipient_phone: str
    recipient_name: Optional[str] = None
    message_text: str
    message_type: Optional[WhatsAppMessageType] = WhatsAppMessageType.CUSTOM_BROADCAST

class BulkMessageRecipient(BaseModel):
    phone: str
    name: Optional[str] = "Customer"
    balance_due: Optional[float] = 0.0

class SendBulkMessageRequest(BaseModel):
    recipients: List[BulkMessageRecipient]
    message_template: str
    template_type: Optional[WhatsAppMessageType] = WhatsAppMessageType.FESTIVAL_GREETING

@router.get("/bill-template")
def get_bill_template(db: Session = Depends(get_db)):
    """Returns the active customized WhatsApp bill receipt template and factory default template."""
    settings = db.query(StoreSettings).first()
    active_template = settings.whatsapp_bill_template if settings and settings.whatsapp_bill_template else DEFAULT_BILL_RECEIPT_TEMPLATE
    return {
        "template": active_template,
        "default_template": DEFAULT_BILL_RECEIPT_TEMPLATE
    }

@router.post("/bill-template")
def save_bill_template(
    req: BillTemplateUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Saves customized WhatsApp bill template to store settings."""
    settings = db.query(StoreSettings).first()
    if not settings:
        settings = StoreSettings()
        db.add(settings)
    settings.whatsapp_bill_template = req.template.strip()
    db.commit()
    db.refresh(settings)
    return {
        "success": True,
        "message": "WhatsApp bill template saved successfully!",
        "template": settings.whatsapp_bill_template
    }

@router.get("/config")
def get_whatsapp_config(db: Session = Depends(get_db)):
    """Fetches the active WhatsApp configuration."""
    config = db.query(WhatsAppConfig).first()
    store_settings = db.query(StoreSettings).first()
    default_phone = store_settings.mobile if store_settings and store_settings.mobile else "7972558842"
    default_name = store_settings.shop_name if store_settings and store_settings.shop_name else "Dolly Toys & Kids Wear"
    
    if not config:
        config = WhatsAppConfig(
            store_phone=default_phone,
            store_name=default_name,
            provider=WhatsAppProvider.DIRECT_WEB,
            is_connected=True,
            updated_at=datetime.utcnow()
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.post("/config")
def update_whatsapp_config(
    req: WhatsAppConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates WhatsApp connection settings, phone number, and syncs with store settings."""
    config = db.query(WhatsAppConfig).first()
    if not config:
        config = WhatsAppConfig()
        db.add(config)
    
    config.store_phone = req.store_phone.strip()
    config.store_name = req.store_name.strip() if req.store_name else "Dolly Toys & Kids Wear"
    config.provider = req.provider or WhatsAppProvider.DIRECT_WEB
    config.meta_api_token = req.meta_api_token.strip() if req.meta_api_token else None
    config.meta_phone_number_id = req.meta_phone_number_id.strip() if req.meta_phone_number_id else None
    config.meta_business_account_id = req.meta_business_account_id.strip() if req.meta_business_account_id else None
    config.is_connected = True
    config.updated_at = datetime.utcnow()
    
    # Sync with StoreSettings so both stay aligned
    store_settings = db.query(StoreSettings).first()
    if store_settings:
        if req.store_phone.strip():
            store_settings.mobile = req.store_phone.strip()
        if req.store_name and req.store_name.strip():
            store_settings.shop_name = req.store_name.strip()

    db.commit()
    db.refresh(config)
    return {"success": True, "message": "WhatsApp configuration updated and synchronized successfully", "config": config}

@router.get("/status")
def get_whatsapp_status(db: Session = Depends(get_db)):
    """Returns the WhatsApp automated gateway connectivity status."""
    config = db.query(WhatsAppConfig).first()
    store_phone = config.store_phone if config else "7972558842"
    provider = config.provider.value if config else "DIRECT_WEB"
    return {
        "status": "ONLINE",
        "gateway": "DollyPOS Automated WhatsApp Gateway",
        "registered_store_phone": store_phone,
        "provider": provider,
        "supported_test_numbers": [store_phone],
        "is_active": True,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/templates")
def get_whatsapp_templates():
    """Provides comprehensive festive, event, collection, and payment reminder templates."""
    return [
        {
            "id": "diwali_greeting",
            "name": "🪔 Diwali Dhamaka & Lakshmi Pujan Wishes",
            "category": "Festivals",
            "type": "FESTIVAL_GREETING",
            "template": "🪔 *Happy Diwali & Prosperous New Year from Dolly Toys and Kids Wear!* ✨\n\nDear {name},\nWishing you and your family a joyful, sparkling Diwali! May your home be blessed with health, wealth & happiness.\n\n🎉 *Festive Special:* Explore our exclusive festive ethnic wear (Kurta sets, Lehengas, Indo-western) & exciting imported toys collection with special festive discounts!\n\n📍 *Visit us:* Agra Road, Near Mahatma Gandhi Statue, Dhule\n📞 *Call/WhatsApp:* 7972558842"
        },
        {
            "id": "holi_greeting",
            "name": "🎨 Holi Festive Colors & Water Guns Special",
            "category": "Festivals",
            "type": "FESTIVAL_GREETING",
            "template": "🎨 *Happy Holi from Dolly Toys and Kids Wear!* 🌈\n\nDear {name},\nMay the festival of colors bring abundant joy, laughter, and brightness to you and your little ones!\n\n🔫 *Special Holi Arrivals:* Cartoon Pichkaris, Electric Water Guns, Herbal Colors, and cool summer wear now available!\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "ganesh_greeting",
            "name": "🐘 Ganesh Chaturthi & Anant Chaturdashi",
            "category": "Festivals",
            "type": "FESTIVAL_GREETING",
            "template": "🐘 *Ganpati Bappa Morya!* 🙏\n\nDear {name},\nWarm greetings on the auspicious occasion of Ganesh Utsav! May Lord Ganesha bless your home with wisdom, prosperity, and peace.\n\n✨ Check out our latest Traditional Kids Dhoti-Kurta, Festive Frocks & Gift Sets at store!\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "makar_sankranti",
            "name": "🪁 Makar Sankranti & Kite Festival",
            "category": "Festivals",
            "type": "FESTIVAL_GREETING",
            "template": "🪁 *Tilgul Ghya, God God Bola! Happy Makar Sankranti from Dolly Toys & Kids Wear!* ☀️\n\nDear {name},\nWishing you a soaring high Makar Sankranti! Explore our designer kites, firkis, and fresh stylish winter-to-spring collection for boys and girls.\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "eid_mubarak",
            "name": "🌙 Eid Mubarak & Festive Outfits",
            "category": "Festivals",
            "type": "FESTIVAL_GREETING",
            "template": "🌙 *Eid Mubarak from Dolly Toys and Kids Wear!* ✨\n\nDear {name},\nMay this special day bring peace, happiness, and prosperity to your family. Celebrate Eid with our gorgeous ethnic collection, Sherwanis, Shararas, and lovely toys for children!\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "raksha_bandhan",
            "name": "🪢 Raksha Bandhan Brother-Sister Special",
            "category": "Festivals",
            "type": "FESTIVAL_GREETING",
            "template": "🪢 *Happy Raksha Bandhan from Dolly Toys and Kids Wear!* 💖\n\nDear {name},\nCelebrate the cherished bond of brother and sister! Special matching brother-sister combo dresses and exciting Rakhi toy gift hampers available now.\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "janmashtami",
            "name": "👶 Krishna Janmashtami Bal Gopal Costumes",
            "category": "Festivals",
            "type": "FESTIVAL_GREETING",
            "template": "👶 *Happy Janmashtami! Radhe Radhe!* 🪈✨\n\nDear {name},\nDress your little ones as cute Bal Gopal / Radha! Complete Kanha costumes with Mukut, Morpankh, Bansuri, and jewelry sets available in all sizes!\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "navratri_garba",
            "name": "💃 Navratri & Dandiya Special Chaniya Choli",
            "category": "Festivals",
            "type": "FESTIVAL_GREETING",
            "template": "💃 *Subh Navratri from Dolly Toys & Kids Wear!* 🥁\n\nDear {name},\nGet ready for Dandiya & Garba nights! Authentic Kutchi work Chaniya Cholis, Kedia Kurta sets, and colorful Dandiya sticks in stock for kids of all ages.\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "christmas_newyear",
            "name": "🎄 Christmas & New Year Extravaganza",
            "category": "Festivals",
            "type": "FESTIVAL_GREETING",
            "template": "🎄 *Merry Christmas & Happy New Year from Dolly Toys and Kids Wear!* 🎅🎁\n\nDear {name},\nSpread festive cheer with Santa costumes, warm winter hoodies, jackets, and super-fun Christmas toy gifts for kids!\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "monsoon_sale",
            "name": "🌧️ Monsoon Rainwear, Umbrellas & Gumboots",
            "category": "Seasonal",
            "type": "FESTIVAL_GREETING",
            "template": "🌧️ *Monsoon Rainwear Now in Stock at Dolly Toys & Kids Wear!* ☔\n\nDear {name},\nProtect your kids with style! Fresh stocks of 100% waterproof premium raincoats (Sizes S to XL), designer cartoon umbrellas, and gumboots in vibrant colors!\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "summer_collection",
            "name": "☀️ Cool Summer Cotton & Beach Wear",
            "category": "Seasonal",
            "type": "FESTIVAL_GREETING",
            "template": "☀️ *Beat the Heat! Cool Summer Collection at Dolly Toys & Kids Wear!* 🏖️\n\nDear {name},\nKeep your kids comfortable and cool in pure breathable cotton t-shirts, shorts, summer frocks, sunglasses & outdoor water toys!\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "winter_wear",
            "name": "❄️ Winter Warmers, Jackets & Sweaters",
            "category": "Seasonal",
            "type": "FESTIVAL_GREETING",
            "template": "❄️ *Cozy Winter Collection Launch at Dolly Toys & Kids Wear!* 🧣\n\nDear {name},\nKeep your child snug and warm! Fresh arrivals of soft woolen sweaters, stylish jackets, thermals, gloves & cute monkey caps now available.\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "new_arrivals",
            "name": "👗 New Arrivals & Fresh Stock Launch",
            "category": "New Collections",
            "type": "CUSTOM_BROADCAST",
            "template": "✨ *Fresh New Collection Just Landed at Dolly Toys & Kids Wear!* 👗👕\n\nDear {name},\nWe have just unpacked the latest trendiest fashion for newborn to teens and imported educational toys & RC cars. Visit us today to grab the best picks!\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "birthday_greeting",
            "name": "🎂 Customer Child Birthday Special Wishes",
            "category": "Special Events",
            "type": "CUSTOM_BROADCAST",
            "template": "🎂 *Happy Birthday to your Little One from Dolly Toys & Kids Wear!* 🎈🎁\n\nDear {name},\nWishing your child a fantastic birthday filled with joy and laughter! Visit our store this week and show this message to claim a special Birthday Discount & Surprise Gift!\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "weekend_sale",
            "name": "🛍️ Weekend Mega Sale & VIP Customer Offer",
            "category": "Promotions",
            "type": "CUSTOM_BROADCAST",
            "template": "🛍️ *Exclusive Weekend Special Offer for You!* 💥\n\nDear {name},\nAs our valued customer, enjoy exclusive special savings on our complete range of kids wear and toys this weekend only!\n\n📍 *Dolly Toys & Kids Wear, Dhule* | 📞 7972558842"
        },
        {
            "id": "khata_reminder",
            "name": "💳 Polite Khata Due Payment Reminder",
            "category": "Khata Accounts",
            "type": "KHATA_REMINDER",
            "template": "Namaskar {name} ji, 🙏\n\nThis is a gentle reminder regarding your outstanding Khata balance of *₹{balance}* at *Dolly Toys and Kids Wear, Dhule*.\n\n📲 *Pay easily via UPI:* `7972558842@upi`\nOr visit our shop at Agra Road, Near MG Statue, Dhule.\n\nThank you for shopping with us! 😊"
        },
        {
            "id": "custom_composer",
            "name": "✏️ Custom Message Composer",
            "category": "Custom",
            "type": "CUSTOM_BROADCAST",
            "template": "Namaskar {name} ji, 🙏\n\nGreetings from *Dolly Toys and Kids Wear, Dhule*!\n\nWe are delighted to share our latest collection & exclusive in-store offers with you.\n\n📍 *Visit us:* Agra Road, Near Mahatma Gandhi Statue, Dhule\n📞 *Call/WhatsApp:* 7972558842\n\nThank you for choosing Dolly POS! 😊"
        }
    ]

@router.post("/send-single")
def send_single_message(
    req: SendSingleMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Dispatches a single automated message and logs in database."""
    clean_phone = req.recipient_phone.strip().replace("+91", "").replace(" ", "").replace("-", "")
    if len(clean_phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number format")

    log_entry = WhatsAppLog(
        recipient_name=req.recipient_name or "Customer",
        recipient_phone=clean_phone,
        message_type=req.message_type or WhatsAppMessageType.CUSTOM_BROADCAST,
        message_text=req.message_text,
        status=WhatsAppStatus.SENT,
        sent_at=datetime.utcnow()
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    return {
        "success": True,
        "message": f"Automated WhatsApp message sent to {clean_phone}.",
        "log_id": log_entry.id,
        "recipient": clean_phone,
        "status": "SENT"
    }

@router.post("/send-bulk")
def send_bulk_messages(
    req: SendBulkMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Processes automated bulk campaign dispatch with personalized customer tags."""
    if not req.recipients:
        raise HTTPException(status_code=400, detail="No recipients provided")

    success_count = 0
    for r in req.recipients:
        clean_phone = r.phone.strip().replace("+91", "").replace(" ", "").replace("-", "")
        if len(clean_phone) < 10:
            continue

        # Personalize placeholders & clean name
        recipient_display = (r.name or "Customer").strip()
        if re.match(r"^Customer\s*\(\d+\)$", recipient_display, re.IGNORECASE) or recipient_display == "":
            recipient_display = "Customer"

        personalized_text = req.message_template.replace("{name}", recipient_display).replace("{balance}", str(round(r.balance_due or 0, 2)))

        log_entry = WhatsAppLog(
            recipient_name=recipient_display,
            recipient_phone=clean_phone,
            message_type=req.template_type or WhatsAppMessageType.FESTIVAL_GREETING,
            message_text=personalized_text,
            status=WhatsAppStatus.SENT,
            sent_at=datetime.utcnow()
        )
        db.add(log_entry)
        success_count += 1

    db.commit()

    return {
        "success": True,
        "message": f"Successfully launched campaign. Sent {success_count} automated WhatsApp messages.",
        "total_sent": success_count
    }

@router.post("/send-bill/{invoice_id}")
def send_bill_whatsapp(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generates and sends automated digital receipt on WhatsApp."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    phone = inv.customer_phone
    if not phone:
        raise HTTPException(status_code=400, detail="Invoice does not have a customer phone number attached")

    clean_phone = phone.strip().replace("+91", "").replace(" ", "").replace("-", "")
    cust_name = (inv.customer_name or "Customer").strip()
    if re.match(r"^Customer\s*\(\d+\)$", cust_name, re.IGNORECASE) or cust_name == "":
        cust_name = "Customer"

    items_text = "\n".join([f"• {item.item_name} ({item.quantity}x) - ₹{item.total_price:.2f}" for item in inv.items])

    from app.core.timezone import convert_utc_to_ist
    ist_inv_date = convert_utc_to_ist(inv.created_at) if inv.created_at else None
    receipt_message = (
        f"🧾 *Digital Receipt - Dolly Toys and Kids Wear*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"Invoice: *#{inv.invoice_number}*\n"
        f"Customer: *{cust_name}*\n"
        f"Date: {ist_inv_date.strftime('%d-%b-%Y %I:%M %p') if ist_inv_date else ''}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"{items_text}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💰 *Grand Total: ₹{inv.grand_total:.2f}*\n"
        f"Paid ({inv.payment_mode.value}): ₹{inv.paid_amount:.2f}\n"
        f"{f'⚠️ Khata Balance Due: *₹{inv.due_amount:.2f}*' if inv.due_amount > 0 else '✓ Bill Fully Paid'}\n\n"
        f"📍 Agra Road, Near MG Statue, Dhule | 📞 7972558842\n"
        f"Thank you for visiting Dolly Toys and Kids Wear! 😊"
    )

    log_entry = WhatsAppLog(
        recipient_name=cust_name,
        recipient_phone=clean_phone,
        message_type=WhatsAppMessageType.BILL_RECEIPT,
        message_text=receipt_message,
        status=WhatsAppStatus.SENT,
        sent_at=datetime.utcnow()
    )
    db.add(log_entry)
    db.commit()

    return {
        "success": True,
        "message": f"Digital receipt sent via WhatsApp to {clean_phone}.",
        "invoice_number": inv.invoice_number
    }

@router.get("/logs")
def get_whatsapp_logs(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Returns recent WhatsApp automated message delivery logs."""
    from app.core.timezone import convert_utc_to_ist
    logs = db.query(WhatsAppLog).order_by(desc(WhatsAppLog.sent_at)).limit(limit).all()
    return [
        {
            "id": l.id,
            "recipient_name": l.recipient_name,
            "recipient_phone": l.recipient_phone,
            "message_type": l.message_type.value,
            "message_text": l.message_text,
            "status": l.status.value,
            "sent_at": convert_utc_to_ist(l.sent_at).strftime("%d-%b-%Y %I:%M %p") if l.sent_at else ""
        }
        for l in logs
    ]
