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
