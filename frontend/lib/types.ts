/**
 * These types are hand-mirrored from backend/app/schemas/catalog.py.
 * Keeping them in sync manually is fine at this scale — if the API grows
 * a lot, generating these from FastAPI's OpenAPI schema (openapi-typescript)
 * is worth doing later, but isn't needed yet.
 */

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  image_url: string | null;
  display_order: number;
}

export interface ProductCard {
  id: number;
  name: string;
  slug: string;
  brand: string;
  category_id: number;
  primary_image_url: string | null;
  primary_image_is_processed: boolean;
  primary_image_blur: string | null;
  min_price_paise: number;
  max_price_paise: number;
  in_stock: boolean;
}

export interface ProductListResponse {
  items: ProductCard[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ProductVariant {
  id: number;
  sku: string;
  variant_name: string;
  attributes: Record<string, string | number>;
  price_paise: number;
  compare_at_paise: number | null;
  weight_grams: number | null;
  is_active: boolean;
  stock_quantity: number;
}

export interface ProductImage {
  id: number;
  variant_id: number | null;
  image_url: string;
  is_processed: boolean;
  width: number | null;
  height: number | null;
  blur_data_url: string | null;
  alt_text: string;
  display_order: number;
  is_primary: boolean;
}

export interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string;
  category_id: number;
  variants: ProductVariant[];
  images: ProductImage[];
}

/** Everything the product listing page can filter/sort/paginate by —
 * mirrors the query params accepted by GET /products in the backend. */
export interface ProductFilters {
  category?: string;
  brand?: string;
  min_price?: string;
  max_price?: string;
  in_stock?: string;
  search?: string;
  sort?: string;
  page?: string;
}

// ---------- Auth (mirrors backend/app/schemas/auth.py) ----------

export interface User {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: "customer" | "admin" | "ops" | "delivery_partner" | "support";
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ---------- Cart (mirrors backend/app/schemas/cart.py) ----------

export interface CartItem {
  id: number;
  variant_id: number;
  quantity: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  variant_name: string;
  unit_price_paise: number;
  compare_at_paise: number | null;
  image_url: string | null;
  stock_quantity: number;
}

export interface CartState {
  items: CartItem[];
  subtotal_paise: number;
}

// ---------- Orders (mirrors backend/app/schemas/orders.py) ----------

export interface ShippingAddress {
  contact_name: string;
  contact_phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  save_address?: boolean;
  label?: string;
}

export type OrderStatus =
  | "pending_payment" | "confirmed" | "packed" | "out_for_delivery"
  | "delivered" | "cancelled" | "return_requested" | "returned" | "refunded";

export interface OrderItemDetail {
  product_name: string;
  variant_name: string;
  unit_price_paise: number;
  quantity: number;
}

export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  shipping_address: ShippingAddress;
  subtotal_paise: number;
  discount_paise: number;
  shipping_paise: number;
  total_paise: number;
  payment_method: string;
  items: OrderItemDetail[];
}

export interface RazorpayOrderResponse {
  key_id: string;
  razorpay_order_id: string;
  amount_paise: number;
  currency: string;
  order_id: number;
}

// ---------- Admin catalog & inventory management ----------

export interface AdminProductListItem {
  id: number;
  name: string;
  slug: string;
  category_id: number;
  is_active: boolean;
}

export interface AdminProductDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string;
  category_id: number;
  is_active: boolean;
  variants: ProductVariant[];
  images: ProductImage[];
}

export interface InventoryBatch {
  id: number;
  batch_code: string;
  quantity: number;
  manufactured_on: string | null;
  expires_on: string | null;
  warehouse_code: string;
}

// ---------- Admin order management (Step 8) ----------

export interface OrderSummary {
  id: number;
  order_number: string;
  status: OrderStatus;
  total_paise: number;
  payment_method: string;
  customer_name: string;
}

export interface AdminOrderDetail extends Order {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_partner_id: number | null;
  delivery_partner_name: string | null;
}

export interface DeliveryPartner {
  id: number;
  full_name: string;
  phone: string | null;
}

export interface AnalyticsSummary {
  total_orders: number;
  total_revenue_paise: number;
  avg_order_value_paise: number;
  total_products: number;
  total_customers: number;
}

export interface StatusCount {
  status: OrderStatus;
  count: number;
}

export interface TopProduct {
  product_name: string;
  units_sold: number;
  revenue_paise: number;
}

export interface DailyTrendPoint {
  day: string;
  order_count: number;
  revenue_paise: number;
}

export interface Analytics {
  summary: AnalyticsSummary;
  status_counts: StatusCount[];
  top_products: TopProduct[];
  daily_trend: DailyTrendPoint[];
}
