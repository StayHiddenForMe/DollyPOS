export interface SalesSummary {
  gross_sales: number;
  net_sales: number;
  total_cogs: number;
  gross_profit: number;
  net_profit: number;
  margin_percent: number;
  total_tax: number;
  total_discount: number;
  bill_count: number;
  average_bill: number;
}

export interface PaymentBreakdown {
  CASH: number;
  UPI: number;
  CARD: number;
  CREDIT: number;
}

export interface HourlyVelocity {
  hour: string;
  amount: number;
  bills: number;
}

export interface TopProduct {
  product_name: string;
  quantity: number;
  revenue: number;
}

export interface LowStockItem {
  id: number;
  name: string;
  stock: number;
  min_stock: number;
  barcode: string;
}

export interface DashboardOverview {
  shop_name: string;
  period: string;
  date_str: string;
  start_date: string;
  end_date: string;
  last_updated: string;
  sales: SalesSummary;
  period_expenses: number;
  payment_breakdown: PaymentBreakdown;
  hourly_velocity: HourlyVelocity[];
  top_products: TopProduct[];
  low_stock_count: number;
  low_stock_items: LowStockItem[];
  khata_outstanding: number;
}

export interface ReportSummary {
  total_bills?: number;
  total_gross?: number;
  total_discount?: number;
  total_tax?: number;
  total_net?: number;
  avg_daily_sales?: number;
  total_collected?: number;
  total_transactions?: number;
  total_categories?: number;
  total_revenue?: number;
  total_entries?: number;
  total_expense?: number;
  damaged_products_count?: number;
  total_damaged_units?: number;
  total_cost_loss?: number;
  critical_items_count?: number;
  total_suggested_units?: number;
}

export interface ReportResponse {
  report_type: 'SALES' | 'PAYMENTS' | 'CATEGORIES' | 'EXPENSES' | 'DAMAGED' | 'PLANNER';
  title: string;
  store_name: string;
  start_date: string;
  end_date: string;
  summary: ReportSummary;
  columns: string[];
  rows: any[];
}

export interface KhataCustomer {
  id: number;
  name: string;
  phone: string;
  clean_phone: string;
  balance: number;
  whatsapp_url?: string;
}

export interface KhataResponse {
  total_customers: number;
  total_outstanding: number;
  customers: KhataCustomer[];
}

export interface InventoryItem {
  id: number;
  name: string;
  barcode: string;
  category: string;
  category_id?: number;
  current_stock: number;
  selling_price: number;
  mrp: number;
  purchase_price: number;
  min_stock: number;
  is_low_stock: boolean;
}

export interface InventoryResponse {
  page: number;
  limit: number;
  total_count: number;
  has_more: boolean;
  products: InventoryItem[];
}

export interface CategoryItem {
  id: number;
  name: string;
}

export interface NetworkInfo {
  shop_name: string;
  tagline: string;
  local_ip: string;
  port: number;
  api_base_url: string;
  server_time: string;
  status: string;
  pairing_code?: string;
}

export interface UserProfile {
  id: number;
  username: string;
  role: string;
  full_name?: string;
}

export interface BusinessStore {
  id: string;
  name: string;
  token?: string;
  url?: string;
  hub_url?: string;
  tagline?: string;
  address?: string;
  is_active: boolean;
  is_pos_online?: boolean;
  last_synced?: string;
}

export interface DemandItem {
  id: number;
  item_description: string;
  category_name?: string;
  preferred_size?: string;
  preferred_color?: string;
  customer_name?: string;
  customer_phone?: string;
  request_count: number;
  urgency: 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'PENDING_PROCUREMENT' | 'ORDERED_WITH_VENDOR' | 'FULFILLED';
  notes?: string;
  created_at: string;
}

