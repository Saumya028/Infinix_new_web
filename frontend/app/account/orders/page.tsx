"use client";

/**
 * Ported from the old site's Dashboard.jsx (the order-history half of it —
 * profile editing isn't part of Step 7's scope). Client component for the
 * same reason as order-success: GET /orders/mine needs the browser's
 * stored auth token.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { clientFetch } from "@/lib/clientApi";
import { formatPaise } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  packed: "bg-indigo-50 text-indigo-700",
  out_for_delivery: "bg-teal-50 text-teal-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
  return_requested: "bg-orange-50 text-orange-700",
  returned: "bg-orange-50 text-orange-700",
  refunded: "bg-gray-100 text-gray-700",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Payment pending",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  return_requested: "Return requested",
  returned: "Returned",
  refunded: "Refunded",
};

export default function MyOrdersPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?next=/account/orders");
      return;
    }
    clientFetch<Order[]>("/orders/mine")
      .then(setOrders)
      .catch(() => setError("Couldn't load your orders. Please try again."));
  }, [user, authLoading, router]);

  if (authLoading || (!orders && !error)) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading your orders...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
      {user && <p className="mt-1 text-sm text-gray-500">{user.full_name} · {user.email}</p>}

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {orders && orders.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-gray-500">You haven&apos;t placed any orders yet.</p>
          <Link href="/products" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
            Start shopping
          </Link>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/order-success/${order.id}`}
              className="block rounded-lg border border-gray-200 p-4 transition hover:border-brand"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{order.order_number}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {order.items.length} item{order.items.length === 1 ? "" : "s"} · {formatPaise(order.total_paise)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
