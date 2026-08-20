"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatPaise } from "@/lib/format";

export default function CartPage() {
  const { cart, isLoading, updateQuantity, removeItem } = useCart();

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading your cart...</p>;
  }

  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Your cart is empty</h1>
        <p className="mt-1 text-sm text-gray-500">Fill it up with something you'll love.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Your Cart</h1>

      <div className="divide-y divide-gray-200 border-y border-gray-200">
        {cart.items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 py-4">
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-gray-100">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No image</div>
              )}
            </div>

            <div className="flex-1">
              <Link href={`/products/${item.product_slug}`} className="font-medium text-gray-900 hover:text-brand">
                {item.product_name}
              </Link>
              <p className="text-sm text-gray-500">{item.variant_name}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{formatPaise(item.unit_price_paise)}</p>
              {item.quantity >= item.stock_quantity && (
                <p className="mt-1 text-xs text-amber-600">Only {item.stock_quantity} left in stock</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                className="h-8 w-8 rounded border border-gray-300 text-gray-600 hover:border-brand hover:text-brand"
              >
                −
              </button>
              <span className="w-6 text-center text-sm">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                disabled={item.quantity >= item.stock_quantity}
                className="h-8 w-8 rounded border border-gray-300 text-gray-600 hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-30"
              >
                +
              </button>
            </div>

            <button
              onClick={() => removeItem(item.id)}
              className="ml-2 text-sm text-gray-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Link href="/products" className="text-sm font-medium text-brand hover:underline">
          ← Continue shopping
        </Link>

        <div className="text-right">
          <p className="text-sm text-gray-500">Subtotal</p>
          <p className="text-xl font-bold text-gray-900">{formatPaise(cart.subtotal_paise)}</p>
          <Link
            href="/checkout"
            className="mt-3 inline-block rounded bg-brand px-8 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
