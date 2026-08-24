import { getCategories, getProducts } from "@/lib/api";
import type { Category, ProductCard } from "@/lib/types";
import HomeClient from "@/components/home/HomeClient";

// Forces this page to render fresh on every request instead of being
// statically generated at build time — category/product data changes and
// should never be baked into a stale build artifact (also: there's no
// live backend to call at build time in most deploy setups).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Graceful degradation: if the backend is unreachable, the page still
  // renders (nav, hero, static marketing sections) instead of crashing to
  // Next.js's generic error screen. The real error is still logged
  // server-side for whoever's debugging.
  let categories: Category[] = [];
  let products: ProductCard[] = [];
  let loadError = false;

  try {
    categories = await getCategories();
  } catch (err) {
    console.error("HomePage: failed to load categories:", err);
    loadError = true;
  }

  try {
    const listing = await getProducts({ page: "1" });
    products = listing.items;
  } catch (err) {
    console.error("HomePage: failed to load products:", err);
  }

  return <HomeClient categories={categories} products={products} loadError={loadError} />;
}
