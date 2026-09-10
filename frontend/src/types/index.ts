export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF' | 'CASHIER';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  plain_password?: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  description?: string;
}

export interface ProductPriceHistory {
  id: number;
  product_id: number;
  old_purchase_price: number;
  new_purchase_price: number;
  old_selling_price: number;
  new_selling_price: number;
  old_mrp: number;
  new_mrp: number;
  reason?: string;
  changed_by?: string;
  created_at: string;
}

export interface Product {
  id: number;
  barcode: string;
  sku?: string;
  manufacture_code?: string;
  vendor_code?: string;
  name: string;
  category_id?: number;
  subcategory_id?: number;
  category_name?: string;
  subcategory_name?: string;
  brand?: string;
  gender?: string;
  age_group?: string;
  size?: string;
  color?: string;
  fabric?: string;
  season?: string;
  tags?: string;
  description?: string;
  purchase_price: number;
  selling_price: number;
  mrp: number;
  gst_percent: number;
  margin_percent: number;
  stock_quantity: number;
  min_stock_alert: number;
  damaged_quantity: number;
  location_shelf?: string;
  is_speed_dial: boolean;
  speed_dial_code?: string;
  speed_dial_color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_purchased_at?: string;
  last_sold_at?: string;
}

export type PaymentMode = 'CASH' | 'UPI' | 'CREDIT_KHATA' | 'CARD' | 'SPLIT';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'CREDIT' | 'REFUNDED';

export interface CartItem {
  cart_item_id: string;
  product_id?: number;
  item_name: string;
  barcode?: string;
  sku?: string;
  size?: string;
  color?: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total_price: number;
  is_unlisted: boolean;
  max_stock?: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  alt_phone?: string;
  email?: string;
  address?: string;
  city?: string;
  date_of_birth?: string;
  anniversary_date?: string;
  favorite_category?: string;
  notes?: string;
  credit_balance: number;
  total_spend: number;
  visit_count: number;
  created_at: string;
  last_visit_at?: string;
}

export interface InvoiceItem {
  id: number;
  product_id?: number;
  item_name: string;
  barcode?: string;
  sku?: string;
  size?: string;
  color?: string;
  quantity: number;
  unit_price: number;
  cost_price?: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total_price: number;
  is_unlisted: boolean;
}

export interface Payment {
  id: number;
  payment_mode: PaymentMode;
  amount: number;
  transaction_ref?: string;
  created_at: string;
}

export interface Invoice {
  id: number;
  bill_number: string;
  customer_id?: number;
  customer_name?: string;
  customer_phone?: string;
  cashier_id?: number;
  subtotal: number;
  discount_amount: number;
  discount_type: string;
  tax_amount: number;
  round_off: number;
  grand_total: number;
  paid_amount: number;
  change_amount: number;
  due_amount: number;
  payment_mode: PaymentMode;
  payment_status: PaymentStatus;
  is_held: boolean;
  is_cancelled: boolean;
  is_gift_receipt: boolean;
  notes?: string;
  created_at: string;
  items: InvoiceItem[];
  payments: Payment[];
}

export interface HeldBillSummary {
  id: number;
  bill_number: string;
  customer_name?: string;
  customer_phone?: string;
  item_count: number;
  grand_total: number;
  created_at: string;
}

export interface StoreSettings {
  id: number;
  shop_name: string;
  tag_line?: string;
  is_tagline_bold?: boolean;
  address: string;
  mobile: string;
  alt_mobile?: string;
  email?: string;
  gstin?: string;
  show_gst_on_bill: boolean;
  upi_id: string;
  opening_date?: string;
  bill_header?: string;
  bill_footer?: string;
  footer_font_size?: string;
  is_footer_bold?: boolean;
  power_footer_font_size?: string;
  is_power_footer_bold?: boolean;
  terms_and_conditions?: string;
  show_terms_on_bill?: boolean;
  instagram_handle?: string;
  show_instagram_on_bill?: boolean;
  facebook_handle?: string;
  show_facebook_on_bill?: boolean;
  threads_handle?: string;
  show_threads_on_bill?: boolean;
  website_url?: string;
  show_website_on_bill?: boolean;
  custom_social_label?: string;
  custom_social_handle?: string;
  show_custom_social_on_bill?: boolean;
  custom_social_label2?: string;
  custom_social_handle2?: string;
  show_custom_social_on_bill2?: boolean;
  custom_social_label3?: string;
  custom_social_handle3?: string;
  show_custom_social_on_bill3?: boolean;
  custom_social_label4?: string;
  custom_social_handle4?: string;
  show_custom_social_on_bill4?: boolean;
  custom_social_label5?: string;
  custom_social_handle5?: string;
  show_custom_social_on_bill5?: boolean;
  thermal_printer_name?: string;
  thermal_width: string;
  barcode_printer_name?: string;
  barcode_label_size: string;
  theme_mode: string;
  auto_backup: boolean;
  backup_frequency: string;
  backup_path?: string;
}

export interface Vendor {
  id: number;
  vendor_code?: string;
  name: string;
  company_name?: string;
  phone: string;
  alt_phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_holder_name?: string;
  vendor_upi_id?: string;
  outstanding_due: number;
  is_active: boolean;
  created_at: string;
}

export interface Expense {
  id: number;
  category: string;
  title: string;
  amount: number;
  payment_mode: string;
  paid_to?: string;
  notes?: string;
  expense_date: string;
  logged_by?: number;
  logged_by_name?: string;
  created_at: string;
}

export interface DashboardMetrics {
  today_sales: number;
  today_bills_count: number;
  avg_bill_value: number;
  today_cash: number;
  today_upi: number;
  today_credit: number;
  today_expenses: number;
  today_gross_profit: number;
  today_net_profit: number;
  low_stock_count: number;
  month_sales: number;
  month_expenses: number;
  inventory_valuation: number;
  top_selling_products: Array<{
    name: string;
    barcode: string;
    quantity_sold: number;
    total_revenue: number;
  }>;
  dead_stock_preview: Array<any>;
}
