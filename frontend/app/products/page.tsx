import { getCategories, getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import Filters from "@/components/Filters";
import Link from "next/link";
import type { Category, ProductFilters, ProductListResponse } from "@/lib/types";

export const dynamic = "force-dynamic"; // see app/page.tsx for why

// Next.js's App Router gives every page access to the current URL's query
// string as `searchParams` automatically — no manual URL parsing needed.
// Because this is a Server Component, the filtering/sorting/pagination
// query in lib/api.ts runs on the SERVER before any HTML reaches the
// browser, which is what makes filtered product pages SSR-friendly and
// crawlable (a search engine bot sees the actual filtered results, not an
// empty shell waiting for client-side JS — unlike the old CRA site).
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductFilters>;
}) {
  const resolvedSearchParams = await searchParams;

  // Same graceful-degradation reasoning as app/page.tsx: don't let a
  // backend hiccup crash the whole shop page.
  let categories: Category[] = [];
  let productList: ProductListResponse = { items: [], page: 1, page_size: 0, total_items: 0, total_pages: 0 };
  let loadError = false;
  try {
    [categories, productList] = await Promise.all([
      getCategories(),
      getProducts(resolvedSearchParams),
    ]);
  } catch (err) {
    console.error("ProductsPage: failed to load categories/products:", err);
    loadError = true;
  }

  const currentPage = Number(resolvedSearchParams.page ?? "1");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Shop</h1>

      {loadError ? (
        <p className="py-12 text-center text-red-600">
          We couldn&apos;t load products right now. Please refresh in a moment.
        </p>
      ) : (
        <>
          <Filters categories={categories} />

          <p className="my-4 text-sm text-gray-500">
            {productList.total_items} product{productList.total_items === 1 ? "" : "s"}
          </p>

          {productList.items.length === 0 ? (
            <p className="py-12 text-center text-gray-500">
              No products match these filters.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {productList.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {productList.total_pages > 1 && (
            <nav className="mt-8 flex justify-center gap-2">
              {Array.from({ length: productList.total_pages }, (_, i) => i + 1).map((pageNum) => {
                const params = new URLSearchParams(resolvedSearchParams as Record<string, string>);
                params.set("page", String(pageNum));
                return (
                  <Link
                    key={pageNum}
                    href={`/products?${params.toString()}`}
                    className={`rounded px-3 py-1 text-sm ${
                      pageNum === currentPage
                        ? "bg-brand text-white"
                        : "border border-gray-300 text-gray-700 hover:border-brand"
                    }`}
                  >
                    {pageNum}
                  </Link>
                );
              })}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
