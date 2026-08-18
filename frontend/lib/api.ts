/**
 * Single place that knows how to reach the FastAPI backend. Every page
 * imports from here instead of calling fetch() directly — so if the API
 * base URL, error handling, or auth header logic ever changes, it changes
 * in ONE file, not scattered across every page.
 *
 * This file runs on the SERVER (Next.js Server Components fetch data
 * during rendering, before HTML reaches the browser) — this is what makes
 * product pages fast and SEO-crawlable, unlike the old CRA site where the
 * browser had to load JS first, then fetch data, then render.
 */
import type {
  Category, ProductDetail, ProductFilters, ProductListResponse,
} from "./types";

// Server-side env var (no NEXT_PUBLIC_ prefix) — this URL is only ever
// called from the Next.js server, never shipped to the browser bundle.
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, revalidateSeconds: number): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    // Next.js's extended fetch: cache the response and automatically
    // re-fetch it in the background after `revalidateSeconds` (ISR —
    // Incremental Static Regeneration). Product listings don't need to be
    // millisecond-fresh, so this avoids hitting the DB on every single
    // page view while still staying reasonably current.
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API request failed: ${path} -> ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/categories", 300); // 5 min — categories rarely change
}

export function getProducts(filters: ProductFilters): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, value);
  });
  const query = params.toString();
  // Short revalidate window — price/stock changes should show up reasonably
  // fast, but we still don't want to hit the DB on literally every request.
  return apiFetch<ProductListResponse>(`/products${query ? `?${query}` : ""}`, 30);
}

export function getProductBySlug(slug: string): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/products/${slug}`, 30);
}
