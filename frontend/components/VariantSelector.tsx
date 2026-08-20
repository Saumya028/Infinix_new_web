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
  const { cart, addToCart, updateQuantity, removeItem } = useCart();
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  if (!selected) {
    return <p className="text-sm text-gray-500">This product has no purchasable variants yet.</p>;
  }

  // The whole point of this: once an item is in the cart, the button
  // should PERSISTENTLY reflect that (a "- 2 +" stepper), not flash
  // "Added ✓" for a second and quietly revert back to "Add to Cart" as if
  // nothing happened. cart.items is the single source of truth for this —
  // no separate "was this just added" state needed.
  const cartItem = cart.items.find((i) => i.variant_id === selected.id);
  const quantityInCart = cartItem?.quantity ?? 0;

  async function handleAddToCart() {
    setIsBusy(true);
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add this to your cart. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStep(delta: number) {
    if (!cartItem) return;
    const next = cartItem.quantity + delta;
    setIsBusy(true);
    setError("");
    try {
      if (next <= 0) {
        // updateQuantity requires quantity >= 1 (see cart.py's
        // CartItemUpdate schema) — going to zero means removing the line
        // entirely, which is a different call.
        await removeItem(cartItem.id);
      } else {
        await updateQuantity(cartItem.id, next);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the quantity.");
    } finally {
      setIsBusy(false);
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
              setError("");
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

      {quantityInCart > 0 ? (
        <div className="mt-6 flex items-center justify-between rounded border border-brand">
          <button
            onClick={() => handleStep(-1)}
            disabled={isBusy}
            aria-label="Decrease quantity"
            className="px-5 py-3 text-lg font-medium text-brand hover:bg-brand/5 disabled:opacity-40"
          >
            −
          </button>
          <span className="text-sm font-semibold text-gray-900">{quantityInCart} in cart</span>
          <button
            onClick={() => handleStep(1)}
            disabled={isBusy || quantityInCart >= selected.stock_quantity}
            aria-label="Increase quantity"
            className="px-5 py-3 text-lg font-medium text-brand hover:bg-brand/5 disabled:opacity-40"
          >
            +
          </button>
        </div>
      ) : (
        <button
          onClick={handleAddToCart}
          disabled={selected.stock_quantity <= 0 || isBusy}
          className="mt-6 w-full rounded bg-brand py-3 text-sm font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isBusy ? "Adding..." : "Add to Cart"}
        </button>
      )}

      {quantityInCart > 0 && (
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
