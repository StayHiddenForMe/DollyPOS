from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StoreSettingsBase(BaseModel):
    shop_name: str = "Dolly Toys and Kids Wear"
    tag_line: Optional[str] = "Exclusive Kids Wear & Quality Toys"
    is_tagline_bold: bool = False
    address: str = "Agra Road, Near Mahatma Gandhi Statue, Dhule"
    mobile: str = "7972558842"
    alt_mobile: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    show_gst_on_bill: bool = False
    upi_id: str = "7972558842@upi"
    show_upi_qr_on_bill: bool = True
    opening_date: Optional[str] = "2002-01-01"
    bill_header: Optional[str] = "Tax Invoice / Retail Bill"
    bill_footer: Optional[str] = "Thank you for shopping with Dolly Toys! No exchange without original bill."
    footer_font_size: Optional[str] = "10px"
    is_footer_bold: bool = False
    power_footer_text: Optional[str] = "Software powered by Dolly POS© | Since 2002"
    power_footer_font_size: Optional[str] = "9px"
    is_power_footer_bold: bool = False
    terms_and_conditions: Optional[str] = "1. Goods once sold can be exchanged within 7 days with original tag and bill intact.\n2. No cash refund."
    show_terms_on_bill: bool = True
    whatsapp_bill_template: Optional[str] = None
    
    # Social Media
    instagram_handle: Optional[str] = "@dollytoys_dhule"
    show_instagram_on_bill: bool = True
    facebook_handle: Optional[str] = None
    show_facebook_on_bill: bool = False
    threads_handle: Optional[str] = None
    show_threads_on_bill: bool = False
    website_url: Optional[str] = None
    show_website_on_bill: bool = False
    custom_social_label: Optional[str] = None
    custom_social_handle: Optional[str] = None
    show_custom_social_on_bill: bool = False
    custom_social_label2: Optional[str] = None
    custom_social_handle2: Optional[str] = None
    show_custom_social_on_bill2: bool = False
    custom_social_label3: Optional[str] = None
    custom_social_handle3: Optional[str] = None
    show_custom_social_on_bill3: bool = False
    custom_social_label4: Optional[str] = None
    custom_social_handle4: Optional[str] = None
    show_custom_social_on_bill4: bool = False
    custom_social_label5: Optional[str] = None
    custom_social_handle5: Optional[str] = None
    show_custom_social_on_bill5: bool = False

    # Hardware & Printers
    thermal_printer_name: Optional[str] = None
    thermal_width: str = "80mm"
    barcode_printer_name: Optional[str] = None
    barcode_label_size: str = "50x25mm"
    theme_mode: str = "light"
    sound_enabled: bool = True
    auto_backup: bool = True
    backup_frequency: str = "DAILY"
    backup_path: Optional[str] = None

    # Extra Charges & Surcharges (5 Templates)
    extra_charge_enabled_1: bool = False
    extra_charge_name_1: Optional[str] = "Online / MDR Surcharge"
    extra_charge_condition_1: Optional[str] = "GREATER_THAN"
    extra_charge_threshold_1: Optional[float] = 2000.0
    extra_charge_type_1: Optional[str] = "PERCENT"
    extra_charge_value_1: Optional[float] = 0.04
    extra_charge_payment_mode_1: Optional[str] = "ONLINE"

    extra_charge_enabled_2: bool = False
    extra_charge_name_2: Optional[str] = "Fixed Convenience Fee"
    extra_charge_condition_2: Optional[str] = "ALWAYS"
    extra_charge_threshold_2: Optional[float] = 0.0
    extra_charge_type_2: Optional[str] = "FLAT"
    extra_charge_value_2: Optional[float] = 10.0
    extra_charge_payment_mode_2: Optional[str] = "ALL"

    extra_charge_enabled_3: bool = False
    extra_charge_name_3: Optional[str] = "Packaging / Handling Charge"
    extra_charge_condition_3: Optional[str] = "ALWAYS"
    extra_charge_threshold_3: Optional[float] = 0.0
    extra_charge_type_3: Optional[str] = "FLAT"
    extra_charge_value_3: Optional[float] = 5.0
    extra_charge_payment_mode_3: Optional[str] = "ALL"

    extra_charge_enabled_4: bool = False
    extra_charge_name_4: Optional[str] = "Special Processing Fee"
    extra_charge_condition_4: Optional[str] = "GREATER_EQUAL"
    extra_charge_threshold_4: Optional[float] = 1000.0
    extra_charge_type_4: Optional[str] = "PERCENT"
    extra_charge_value_4: Optional[float] = 1.0
    extra_charge_payment_mode_4: Optional[str] = "ALL"

    extra_charge_enabled_5: bool = False
    extra_charge_name_5: Optional[str] = "Custom Service Surcharge"
    extra_charge_condition_5: Optional[str] = "ALWAYS"
    extra_charge_threshold_5: Optional[float] = 0.0
    extra_charge_type_5: Optional[str] = "FLAT"
    extra_charge_value_5: Optional[float] = 0.0
    extra_charge_payment_mode_5: Optional[str] = "ALL"

class StoreSettingsUpdate(BaseModel):
    shop_name: Optional[str] = None
    tag_line: Optional[str] = None
    is_tagline_bold: Optional[bool] = None
    address: Optional[str] = None
    mobile: Optional[str] = None
    alt_mobile: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    show_gst_on_bill: Optional[bool] = None
    upi_id: Optional[str] = None
    show_upi_qr_on_bill: Optional[bool] = None
    opening_date: Optional[str] = None
    bill_header: Optional[str] = None
    bill_footer: Optional[str] = None
    footer_font_size: Optional[str] = None
    is_footer_bold: Optional[bool] = None
    power_footer_text: Optional[str] = None
    power_footer_font_size: Optional[str] = None
    is_power_footer_bold: Optional[bool] = None
    terms_and_conditions: Optional[str] = None
    show_terms_on_bill: Optional[bool] = None
    whatsapp_bill_template: Optional[str] = None
    instagram_handle: Optional[str] = None
    show_instagram_on_bill: Optional[bool] = None
    facebook_handle: Optional[str] = None
    show_facebook_on_bill: Optional[bool] = None
    threads_handle: Optional[str] = None
    show_threads_on_bill: Optional[bool] = None
    website_url: Optional[str] = None
    show_website_on_bill: Optional[bool] = None
    custom_social_label: Optional[str] = None
    custom_social_handle: Optional[str] = None
    show_custom_social_on_bill: Optional[bool] = None
    custom_social_label2: Optional[str] = None
    custom_social_handle2: Optional[str] = None
    show_custom_social_on_bill2: Optional[bool] = None
    custom_social_label3: Optional[str] = None
    custom_social_handle3: Optional[str] = None
    show_custom_social_on_bill3: Optional[bool] = None
    custom_social_label4: Optional[str] = None
    custom_social_handle4: Optional[str] = None
    show_custom_social_on_bill4: Optional[bool] = None
    custom_social_label5: Optional[str] = None
    custom_social_handle5: Optional[str] = None
    show_custom_social_on_bill5: Optional[bool] = None
    thermal_printer_name: Optional[str] = None
    thermal_width: Optional[str] = None
    barcode_printer_name: Optional[str] = None
    barcode_label_size: Optional[str] = None
    theme_mode: Optional[str] = None
    sound_enabled: Optional[bool] = None
    auto_backup: Optional[bool] = None
    backup_frequency: Optional[str] = None
    backup_path: Optional[str] = None

    # Extra Charges & Surcharges (5 Templates)
    extra_charge_enabled_1: Optional[bool] = None
    extra_charge_name_1: Optional[str] = None
    extra_charge_condition_1: Optional[str] = None
    extra_charge_threshold_1: Optional[float] = None
    extra_charge_type_1: Optional[str] = None
    extra_charge_value_1: Optional[float] = None
    extra_charge_payment_mode_1: Optional[str] = None

    extra_charge_enabled_2: Optional[bool] = None
    extra_charge_name_2: Optional[str] = None
    extra_charge_condition_2: Optional[str] = None
    extra_charge_threshold_2: Optional[float] = None
    extra_charge_type_2: Optional[str] = None
    extra_charge_value_2: Optional[float] = None
    extra_charge_payment_mode_2: Optional[str] = None

    extra_charge_enabled_3: Optional[bool] = None
    extra_charge_name_3: Optional[str] = None
    extra_charge_condition_3: Optional[str] = None
    extra_charge_threshold_3: Optional[float] = None
    extra_charge_type_3: Optional[str] = None
    extra_charge_value_3: Optional[float] = None
    extra_charge_payment_mode_3: Optional[str] = None

    extra_charge_enabled_4: Optional[bool] = None
    extra_charge_name_4: Optional[str] = None
    extra_charge_condition_4: Optional[str] = None
    extra_charge_threshold_4: Optional[float] = None
    extra_charge_type_4: Optional[str] = None
    extra_charge_value_4: Optional[float] = None
    extra_charge_payment_mode_4: Optional[str] = None

    extra_charge_enabled_5: Optional[bool] = None
    extra_charge_name_5: Optional[str] = None
    extra_charge_condition_5: Optional[str] = None
    extra_charge_threshold_5: Optional[float] = None
    extra_charge_type_5: Optional[str] = None
    extra_charge_value_5: Optional[float] = None
    extra_charge_payment_mode_5: Optional[str] = None

class StoreSettingsOut(StoreSettingsBase):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True
