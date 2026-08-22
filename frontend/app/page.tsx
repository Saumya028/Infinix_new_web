import Link from "next/link";
import { getCategories } from "@/lib/api";
import type { Category } from "@/lib/types";

// Forces this page to render fresh on every request instead of being
// statically generated at build time. Necessary here because build time
// has no live backend to call — but also the RIGHT choice for a commerce
// site regardless: category/product data changes and should never be
// baked into a stale build artifact.
export const dynamic = "force-dynamic";

// This page IS server-rendered at request time (default App Router
// behavior) and hits the backend via getCategories() — no client-side
// loading spinner needed, the HTML arrives with content already in it.
export default async function HomePage() {
  // Graceful degradation: if the backend is unreachable (misconfigured
  // API_BASE_URL, backend cold-starting on a free host, a transient
  // network blip), the whole homepage shouldn't crash to Next.js's
  // generic "Application error" screen — the header/layout should still
  // render, with a clear inline message instead of a blank page. The
  // actual error is still logged server-side (visible in Vercel's
  // Function logs) via console.error, so this doesn't hide real problems
  // from whoever's debugging — it just stops one flaky fetch from taking
  // the entire page down for every visitor.
  let categories: Category[] = [];
  let loadError = false;
  try {
    categories = await getCategories();
  } catch (err) {
    console.error("HomePage: failed to load categories:", err);
    loadError = true;
  }

  return (
    <div>
      <section className="rounded-lg bg-brand/10 p-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Infinix</h1>
        <p className="mt-2 text-gray-600">Body sprays, powders, nail paints, and more.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded bg-brand px-6 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Shop all products
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Shop by category</h2>
        {loadError ? (
          <p className="text-sm text-red-600">
            We couldn&apos;t load categories right now. Please refresh in a moment.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                className="rounded-lg border border-gray-200 bg-white p-4 text-center text-sm font-medium text-gray-700 hover:border-brand hover:text-brand"
              >
                {c.name}
              </Link>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-gray-500">No categories yet — add some from the admin panel.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
