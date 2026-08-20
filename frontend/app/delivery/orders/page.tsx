"use client";

/**
 * New in the rebuild — the old site had no delivery role or portal at all,
 * just an admin manually marking orders "Shipped". This is a real gap the
 * old site had; see backend/app/routers/delivery.py's docstring.
 *
 * Only lets a delivery partner move an order forward along the fixed path
 * the backend enforces (confirmed -> packed -> out_for_delivery ->
 * delivered, or -> return_requested from out_for_delivery). The button
 * shown is always just "the one valid next step" rather than a free-form
 * status picker — there's only ever one legal forward move at a time, so
 * offering a dropdown here would just be confusing.
 */
import { useEffect, useState } from "react";
import { useRequireRole } from "@/lib/useRequireRole";
import { clientFetch, ApiError } from "@/lib/clientApi";
import { formatPaise } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  confirmed: { status: "packed", label: "Mark as Packed" },
  packed: { status: "out_for_delivery", label: "Mark Out for Delivery" },
  out_for_delivery: { status: "delivered", label: "Mark as Delivered" },
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Payment pending", confirmed: "Confirmed", packed: "Packed",
  out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled",
  return_requested: "Return requested", returned: "Returned", refunded: "Refunded",
};

export default function DeliveryOrdersPage() {
  const { isAuthorized, isLoading: authLoading } = useRequireRole(["delivery_partner"]);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthorized) return;
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  function loadOrders() {
    clientFetch<Order[]>("/delivery/orders/mine")
      .then(setOrders)
      .catch(() => setMessage("Unable to load your assigned orders."));
  }

  async function advanceStatus(orderId: number, nextStatus: OrderStatus) {
    setUpdatingId(orderId);
    setMessage("");
    try {
      const updated = await clientFetch<Order>(`/delivery/orders/${orderId}/status`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      // "delivered" orders drop out of /delivery/orders/mine (that endpoint
      // only returns confirmed/packed/out_for_delivery — see delivery.py),
      // so once one lands there we just remove it from the list locally
      // instead of re-fetching the whole thing.
      setOrders((prev) =>
        prev
          ?.map((o) => (o.id === orderId ? updated : o))
          .filter((o) => o.status !== "delivered") ?? null,
      );
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Unable to update this order.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function reportFailedDelivery(orderId: number) {
    await advanceStatus(orderId, "return_requested");
  }

  if (authLoading || !isAuthorized) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">My Deliveries</h1>
      <p className="mt-1 text-sm text-gray-500">Orders assigned to you, in order of assignment.</p>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

      {orders === null ? (
        <p className="mt-6 text-sm text-gray-500">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No deliveries assigned to you right now.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => {
            const next = NEXT_STEP[order.status];
            const isUpdating = updatingId === order.id;
            return (
              <div key={order.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <strong className="text-gray-900">{order.order_number}</strong>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>

                <p className="mt-2 text-sm text-gray-600">
                  {order.shipping_address.contact_name} · {order.shipping_address.contact_phone}
                </p>
                <p className="text-sm text-gray-600">
                  {order.shipping_address.line1}, {order.shipping_address.city},{" "}
                  {order.shipping_address.state} - {order.shipping_address.pincode}
                </p>

                <ul className="mt-2 space-y-0.5 text-sm text-gray-500">
                  {order.items.map((item, i) => (
                    <li key={i}>{item.product_name} ({item.variant_name}) × {item.quantity}</li>
                  ))}
                </ul>

                <p className="mt-2 text-sm font-medium text-gray-900">
                  {order.payment_method === "cod" ? `Collect ${formatPaise(order.total_paise)} (COD)` : "Paid online"}
                </p>

                <div className="mt-4 flex gap-3">
                  {next && (
                    <button
                      onClick={() => advanceStatus(order.id, next.status)}
                      disabled={isUpdating}
                      className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                    >
                      {isUpdating ? "Updating..." : next.label}
                    </button>
                  )}
                  {order.status === "out_for_delivery" && (
                    <button
                      onClick={() => reportFailedDelivery(order.id)}
                      disabled={isUpdating}
                      className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Report failed delivery
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
