"use client";

/**
 * Ported from the old site's OrderSuccess.jsx. Kept as a client component
 * (rather than a Server Component fetching in lib/api.ts) because GET
 * /orders/{id} requires the user's auth token, which only exists in the
 * browser — same reasoning as checkout/cart.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { clientFetch, ApiError } from "@/lib/clientApi";
import { formatPaise } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrderSuccessPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { isLoading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    clientFetch<Order>(`/orders/${orderId}`)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this order."))
      .finally(() => setIsLoading(false));
  }, [orderId, authLoading]);

  if (authLoading || isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading your order...</p>;
  }

  if (error || !order) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900">We couldn&apos;t find that order</h1>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Link href="/account/orders" className="mt-6 inline-block text-sm font-medium text-brand hover:underline">
          View your orders
        </Link>
      </div>
    );
  }

  const isPending = order.status === "pending_payment";

  return (
    <div className="mx-auto max-w-lg text-center">
      <p className="text-5xl">{isPending ? "⏳" : "✅"}</p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">
        {isPending ? "Payment processing" : "Order placed!"}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {isPending
          ? "We're confirming your payment — this page will update once it's done."
          : "Thanks for shopping with Infinix. A confirmation has been recorded on your account."}
      </p>

      <div className="mt-8 rounded-lg border border-gray-200 p-6 text-left">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Order number</span>
          <span className="font-medium text-gray-900">{order.order_number}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-gray-500">Payment method</span>
          <span className="font-medium capitalize text-gray-900">
            {order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method}
          </span>
        </div>

        <ul className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-sm">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between text-gray-600">
              <span>{item.product_name} ({item.variant_name}) × {item.quantity}</span>
              <span>{formatPaise(item.unit_price_paise * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-semibold text-gray-900">
          <span>Total</span>
          <span>{formatPaise(order.total_paise)}</span>
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <Link href="/products" className="text-sm font-medium text-brand hover:underline">
          Continue shopping
        </Link>
        <Link href="/account/orders" className="text-sm font-medium text-brand hover:underline">
          View your orders
        </Link>
      </div>
    </div>
  );
}
