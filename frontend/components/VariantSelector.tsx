"use client";

/**
 * "use client" needed here because this component holds interactive state
 * (useState for the selected variant, quantity, add-to-cart feedback) —
 * the surrounding product page stays a Server Component, only this piece
 * is interactive.
 */
import { useState } from "react";
import Link from "next/link";
import type { ProductVariant } from "@/lib/types";
import { formatPaise } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { ApiError } from "@/lib/clientApi";

interface ProductSummary {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
}

export default function VariantSelector({
  variants,
  product,
}: {
  variants: ProductVariant[];
  product: ProductSummary;
}) {
  const { addToCart } = useCart();
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");
  const [error, setError] = useState("");

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  if (!selected) {
    return <p className="text-sm text-gray-500">This product has no purchasable variants yet.</p>;
  }

  async function handleAddToCart() {
    setStatus("adding");
    setError("");
    try {
      await addToCart({
        variant_id: selected.id,
        product_id: product.id,
        product_name: product.name,
        product_slug: product.slug,
        variant_name: selected.variant_name,
        unit_price_paise: selected.price_paise,
        compare_at_paise: selected.compare_at_paise,
        image_url: product.image_url,
        stock_quantity: selected.stock_quantity,
      });
      setStatus("added");
      // Reverts the button back to "Add to Cart" after a moment, so adding
      // a second unit (or a different variant) doesn't feel stuck.
      setTimeout(() => setStatus("idle"), 1500);
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Couldn't add this to your cart. Please try again.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => (
          <button
            key={v.id}
            onClick={() => {
              setSelectedId(v.id);
              setStatus("idle");
            }}
            disabled={v.stock_quantity <= 0}
            className={`rounded border px-3 py-2 text-sm transition ${
              v.id === selectedId
                ? "border-brand bg-brand/10 text-brand"
                : "border-gray-300 text-gray-700 hover:border-brand"
            } ${v.stock_quantity <= 0 ? "cursor-not-allowed opacity-40" : ""}`}
          >
            {v.variant_name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-2xl font-bold text-gray-900">{formatPaise(selected.price_paise)}</span>
        {selected.compare_at_paise && selected.compare_at_paise > selected.price_paise && (
          <span className="text-sm text-gray-400 line-through">
            {formatPaise(selected.compare_at_paise)}
          </span>
        )}
      </div>

      <p className={`mt-1 text-sm ${selected.stock_quantity > 0 ? "text-green-600" : "text-red-600"}`}>
        {selected.stock_quantity > 0 ? "In stock" : "Out of stock"}
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleAddToCart}
        disabled={selected.stock_quantity <= 0 || status === "adding"}
        className="mt-6 w-full rounded bg-brand py-3 text-sm font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "adding" ? "Adding..." : status === "added" ? "Added ✓" : "Add to Cart"}
      </button>

      {status === "added" && (
        <p className="mt-2 text-center text-sm text-gray-500">
          <Link href="/cart" className="font-medium text-brand hover:underline">
            View cart
          </Link>{" "}
          to check out.
        </p>
      )}
    </div>
  );
}
