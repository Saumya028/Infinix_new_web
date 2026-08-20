/**
 * lib/api.ts (server-only) handles data Next.js fetches while RENDERING a
 * page — categories, product listings, etc. This file is its counterpart
 * for data that only exists once the user is DOING something in the
 * browser: logging in, adding to cart, checking out. Those all need an
 * Authorization header carrying the user's token, which only exists on the
 * client, and they should never be cached the way lib/api.ts's fetches are.
 *
 * NEXT_PUBLIC_ prefix is required here (unlike API_BASE_URL in lib/api.ts)
 * because this code runs in the browser bundle, not just on the server —
 * Next.js only exposes env vars with that prefix to client-side code.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export async function clientFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    // FastAPI's HTTPException bodies always look like {"detail": "..."}.
    // Falling back to a generic message covers network-level failures
    // (e.g. the API being down) where res.json() itself would throw.
    const message = await res
      .json()
      .then((data) => data.detail ?? `Request failed (${res.status})`)
      .catch(() => `Request failed (${res.status})`);
    throw new ApiError(message, res.status);
  }

  // 204 No Content etc. — nothing to parse.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Multipart file upload — used only by the admin "add product image"
 * route (POST /admin/products/{id}/upload-image), which needs a real
 * file in the request body, not JSON.
 *
 * Deliberately does NOT set a Content-Type header: the browser sets
 * "multipart/form-data; boundary=..." itself from the FormData object,
 * with a boundary string it generates. Setting Content-Type manually here
 * would omit that boundary and the backend couldn't parse the body at all.
 */
export async function clientUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { method: "POST", headers, body: formData });

  if (!res.ok) {
    const message = await res
      .json()
      .then((data) => data.detail ?? `Request failed (${res.status})`)
      .catch(() => `Request failed (${res.status})`);
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}
