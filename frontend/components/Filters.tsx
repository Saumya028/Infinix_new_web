"use client";

/**
 * "use client" above is required here — this component uses browser-only
 * hooks (useRouter, form onChange handlers) that can't run on the server.
 * Everything else we've built so far (pages, ProductCard, the API client)
 * is a Server Component by default in the Next.js App Router — this file
 * is the deliberate exception, kept as small as possible.
 *
 * How this works: changing a filter doesn't call an API directly from the
 * browser. It updates the URL's query string (e.g. /products?category=
 * body-sprays&sort=price_asc), and the URL change triggers Next.js to
 * re-run the Server Component in app/products/page.tsx, which re-fetches
 * from the backend with the new filters. This keeps ALL data-fetching
 * logic in one server-side place (lib/api.ts) — this component only ever
 * manipulates the URL, never calls the API itself.
 */
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/types";

export default function Filters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // any filter change resets pagination to page 1
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 border-b border-gray-200 pb-4">
      {/*
        suppressHydrationWarning on every form control below: the error
        you're seeing ("fdprocessedid" attributes appearing on select/input
        elements) is a signature of a browser extension (commonly a
        password manager or form-autofill tool) tagging form fields AFTER
        React hydrates the page — React's own hydration-mismatch docs list
        this exact scenario ("the client has a browser extension installed
        which messes with the HTML before React loaded"). It's cosmetic: the
        extension adds an attribute React doesn't know about, doesn't change
        any value or behavior. To confirm for yourself, open this same page
        in an Incognito window with extensions disabled — the warning won't
        appear. suppressHydrationWarning only ignores attribute-level
        mismatches on THIS element; it would NOT hide a real bug (wrong
        text/children mismatches still warn normally).
      */}
      <select
        className="rounded border border-gray-300 px-3 py-2 text-sm"
        value={searchParams.get("category") ?? ""}
        onChange={(e) => updateParam("category", e.target.value)}
        suppressHydrationWarning
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>{c.name}</option>
        ))}
      </select>

      <input
        type="number"
        placeholder="Min ₹"
        className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
        defaultValue={searchParams.get("min_price") ?? ""}
        onBlur={(e) => updateParam("min_price", e.target.value)}
        suppressHydrationWarning
      />
      <input
        type="number"
        placeholder="Max ₹"
        className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
        defaultValue={searchParams.get("max_price") ?? ""}
        onBlur={(e) => updateParam("max_price", e.target.value)}
        suppressHydrationWarning
      />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={searchParams.get("in_stock") === "true"}
          onChange={(e) => updateParam("in_stock", e.target.checked ? "true" : "")}
          suppressHydrationWarning
        />
        In stock only
      </label>

      <select
        className="ml-auto rounded border border-gray-300 px-3 py-2 text-sm"
        value={searchParams.get("sort") ?? "newest"}
        onChange={(e) => updateParam("sort", e.target.value)}
        suppressHydrationWarning
      >
        <option value="newest">Newest</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
      </select>
    </div>
  );
}
