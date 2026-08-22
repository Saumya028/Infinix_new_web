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

/**
 * Thrown for a genuine HTTP-level failure (4xx/5xx) — as opposed to a
 * network-level failure (DNS, connection refused, timeout), which stays a
 * plain Error. This distinction matters to callers: app/products/[slug]/
 * page.tsx needs to tell "the backend said 404, this product really
 * doesn't exist" apart from "the backend is unreachable" — those need
 * completely different pages (Not Found vs. a "try again" message).
 */
export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Server-side env var (no NEXT_PUBLIC_ prefix) — this URL is only ever
// called from the Next.js server, never shipped to the browser bundle.
//
// Deliberately NO silent fallback to localhost here. On Vercel (or any
// real deployment) there is no localhost:8000 — a silent fallback would
// mean every server-rendered page throws an opaque "ECONNREFUSED", which
// Next.js turns into the generic, undiagnosable "Application error: a
// server-side exception has occurred" page with nothing but a digest
// number. Throwing HERE, at module load, with an explicit message means
// the real problem ("API_BASE_URL is not set") is what actually shows up
// in Vercel's function logs instead of a dead end.
const API_BASE_URL = process.env.API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "API_BASE_URL environment variable is not set. In Vercel: Project " +
    "Settings -> Environment Variables -> add API_BASE_URL pointing at " +
    "your deployed backend, e.g. https://your-backend.onrender.com " +
    "(no trailing slash), then redeploy.",
  );
}

async function apiFetch<T>(path: string, revalidateSeconds: number): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      // Next.js's extended fetch: cache the response and automatically
      // re-fetch it in the background after `revalidateSeconds` (ISR —
      // Incremental Static Regeneration). Product listings don't need to be
      // millisecond-fresh, so this avoids hitting the DB on every single
      // page view while still staying reasonably current.
      next: { revalidate: revalidateSeconds },
    });
  } catch (err) {
    // Network-level failure (DNS, connection refused, TLS, timeout) — most
    // likely cause is API_BASE_URL pointing at the wrong host, or the
    // backend being asleep/down (common on free-tier hosts that spin down
    // on inactivity). Re-thrown with the URL attached so it's visible in
    // server logs, not swallowed into a generic message.
    throw new Error(
      `Could not reach the backend at ${API_BASE_URL}${path}. Is API_BASE_URL ` +
      `correct and is the backend running? Original error: ${err instanceof Error ? err.message : err}`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiRequestError(`API request failed: ${path} -> ${res.status} ${body}`, res.status);
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
