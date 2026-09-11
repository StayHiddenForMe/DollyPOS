from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from app.core.database import Base

class StoreSettings(Base):
    __tablename__ = "store_settings"

    id = Column(Integer, primary_key=True, index=True)
    shop_name = Column(String(150), default="Dolly Toys and Kids Wear", nullable=False)
    tag_line = Column(String(200), default="Exclusive Kids Wear & Quality Toys", nullable=True)
    is_tagline_bold = Column(Boolean, default=False, nullable=False)
    address = Column(Text, default="Agra Road, Near Mahatma Gandhi Statue, Dhule", nullable=False)
    mobile = Column(String(20), default="7972558842", nullable=False)
    alt_mobile = Column(String(20), nullable=True)
    active_purge_token = Column(String(500), nullable=True)
    email = Column(String(100), nullable=True)
    gstin = Column(String(20), nullable=True)
    show_gst_on_bill = Column(Boolean, default=False, nullable=False)
    upi_id = Column(String(100), default="7972558842@upi", nullable=False)
    opening_date = Column(String(50), default="2002-01-01", nullable=True)
    
    # Receipts Customization
    bill_header = Column(Text, default="Tax Invoice / Retail Bill", nullable=True)
    bill_footer = Column(Text, default="Thank you for shopping with Dolly Toys! No exchange without original bill.", nullable=True)
    footer_font_size = Column(String(20), default="10px", nullable=True)
    is_footer_bold = Column(Boolean, default=False, nullable=False)
    power_footer_font_size = Column(String(20), default="9px", nullable=True)
    is_power_footer_bold = Column(Boolean, default=False, nullable=False)
    terms_and_conditions = Column(Text, default="1. Goods once sold can be exchanged within 7 days with original tag and bill intact.\n2. No cash refund.", nullable=True)
    show_terms_on_bill = Column(Boolean, default=True, nullable=False)
    
    # Social Media & Branding
    instagram_handle = Column(String(100), default="@dollytoys_dhule", nullable=True)
    show_instagram_on_bill = Column(Boolean, default=True, nullable=False)
    facebook_handle = Column(String(150), nullable=True)
    show_facebook_on_bill = Column(Boolean, default=False, nullable=False)
    threads_handle = Column(String(100), nullable=True)
    show_threads_on_bill = Column(Boolean, default=False, nullable=False)
    website_url = Column(String(150), nullable=True)
    show_website_on_bill = Column(Boolean, default=False, nullable=False)
    
    # Custom Social Handles (1 to 5)
    custom_social_label = Column(String(50), nullable=True)
    custom_social_handle = Column(String(150), nullable=True)
    show_custom_social_on_bill = Column(Boolean, default=False, nullable=False)
    
    custom_social_label2 = Column(String(50), nullable=True)
    custom_social_handle2 = Column(String(150), nullable=True)
    show_custom_social_on_bill2 = Column(Boolean, default=False, nullable=False)
    
    custom_social_label3 = Column(String(50), nullable=True)
    custom_social_handle3 = Column(String(150), nullable=True)
    show_custom_social_on_bill3 = Column(Boolean, default=False, nullable=False)
    
    custom_social_label4 = Column(String(50), nullable=True)
    custom_social_handle4 = Column(String(150), nullable=True)
    show_custom_social_on_bill4 = Column(Boolean, default=False, nullable=False)
    
    custom_social_label5 = Column(String(50), nullable=True)
    custom_social_handle5 = Column(String(150), nullable=True)
    show_custom_social_on_bill5 = Column(Boolean, default=False, nullable=False)
    
    # Hardware & Printers
    thermal_printer_name = Column(String(100), nullable=True)
    thermal_width = Column(String(10), default="80mm", nullable=False)  # '80mm', '58mm', '112mm', 'A4', 'A5'
    barcode_printer_name = Column(String(100), nullable=True)
    barcode_label_size = Column(String(20), default="50x25mm", nullable=False)  # '50x25mm', '38x25mm', '50x35mm', 'a4_24up'
    
    # Preferences
    theme_mode = Column(String(10), default="light", nullable=False)
    sound_enabled = Column(Boolean, default=True, nullable=False)
    auto_backup = Column(Boolean, default=True, nullable=False)
    backup_frequency = Column(String(20), default="DAILY", nullable=False)
    backup_path = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
