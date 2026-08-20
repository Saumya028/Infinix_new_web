"use client";

/**
 * Ported from the old site's AdminOrders.jsx — same core UX (expandable
 * list, inline status dropdown), rewritten against the new API and with
 * one new capability the old site never had: assigning a delivery
 * partner (see AdminOrderDetail / /admin/orders/{id}/assign in the
 * backend).
 *
 * List view uses the slim OrderSummary shape (GET /admin/orders); the full
 * AdminOrderDetail (customer contact, delivery assignment) is only fetched
 * lazily when a row is expanded, via GET /admin/orders/{id} — no need to
 * ship every order's full shipping address and line items just to render
 * a list of rows.
 */
import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { useRequireRole } from "@/lib/useRequireRole";
import { clientFetch, ApiError } from "@/lib/clientApi";
import { formatPaise } from "@/lib/format";
import type { AdminOrderDetail, DeliveryPartner, OrderStatus, OrderSummary } from "@/lib/types";

const ALL_STATUSES: OrderStatus[] = [
  "pending_payment", "confirmed", "packed", "out_for_delivery",
  "delivered", "cancelled", "return_requested", "returned", "refunded",
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending_payment: "#b58900", confirmed: "#268bd2", packed: "#6c71c4",
  out_for_delivery: "#2aa198", delivered: "#2e7d32", cancelled: "#c0392b",
  return_requested: "#cb4b16", returned: "#cb4b16", refunded: "#657b83",
};

export default function AdminOrdersPage() {
  const { isAuthorized, isLoading: authLoading } = useRequireRole(["admin", "ops", "support"]);

  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "All">("All");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [partners, setPartners] = useState<DeliveryPartner[] | null>(null);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthorized) return;
    clientFetch<OrderSummary[]>("/admin/orders")
      .then(setOrders)
      .catch(() => setMessage("Unable to load orders."));
    clientFetch<DeliveryPartner[]>("/admin/delivery-partners")
      .then(setPartners)
      .catch(() => {}); // non-fatal — assignment dropdown just won't populate
  }, [isAuthorized]);

  async function toggleExpand(orderId: number) {
    if (expandedId === orderId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(orderId);
    try {
      const d = await clientFetch<AdminOrderDetail>(`/admin/orders/${orderId}`);
      setDetail(d);
    } catch {
      setMessage("Unable to load order detail.");
    }
  }

  async function handleStatusChange(orderId: number, status: OrderStatus) {
    setUpdatingId(orderId);
    try {
      await clientFetch(`/admin/orders/${orderId}/status`, { method: "PATCH", body: { status } });
      setOrders((prev) => prev?.map((o) => (o.id === orderId ? { ...o, status } : o)) ?? null);
      if (detail?.id === orderId) setDetail({ ...detail, status });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Unable to update order status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleAssign(orderId: number, deliveryPartnerId: number) {
    setUpdatingId(orderId);
    try {
      const updated = await clientFetch<AdminOrderDetail>(`/admin/orders/${orderId}/assign`, {
        method: "PATCH", body: { delivery_partner_id: deliveryPartnerId },
      });
      setDetail(updated);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Unable to assign delivery partner.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (authLoading || !isAuthorized) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading...</p>;
  }

  const visibleOrders = orders?.filter((o) => statusFilter === "All" || o.status === statusFilter) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
      <AdminNav />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">All Customer Orders</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "All")}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="All">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {message && <p className="mb-4 text-sm text-red-600">{message}</p>}

      {orders === null ? (
        <p className="text-sm text-gray-500">Loading orders...</p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-sm text-gray-500">No orders found.</p>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order) => {
            const isExpanded = expandedId === order.id;
            return (
              <div key={order.id} className="rounded-lg border border-gray-200">
                <button
                  onClick={() => toggleExpand(order.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm">
                    <strong className="text-gray-900">{order.order_number}</strong>
                    <span className="text-gray-500"> — {order.customer_name} — {formatPaise(order.total_paise)}</span>
                  </span>
                  <span className="text-sm font-semibold" style={{ color: STATUS_COLORS[order.status] }}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 px-4 py-3">
                    {!detail || detail.id !== order.id ? (
                      <p className="text-sm text-gray-500">Loading detail...</p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600">
                          <strong>Contact:</strong> {detail.customer_email} {detail.customer_phone ? `· ${detail.customer_phone}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          <strong>Delivering to:</strong> {detail.shipping_address.contact_name}, {detail.shipping_address.line1},{" "}
                          {detail.shipping_address.city}, {detail.shipping_address.state} - {detail.shipping_address.pincode}{" "}
                          ({detail.shipping_address.contact_phone})
                        </p>

                        <ul className="mt-3 space-y-1 text-sm text-gray-600">
                          {detail.items.map((item, i) => (
                            <li key={i}>
                              {item.product_name} ({item.variant_name}) × {item.quantity} — {formatPaise(item.unit_price_paise)} each
                            </li>
                          ))}
                        </ul>

                        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3">
                          <label className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-700">Status:</span>
                            <select
                              value={detail.status}
                              disabled={updatingId === order.id}
                              onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                              className="rounded border border-gray-300 px-2 py-1 text-sm"
                            >
                              {ALL_STATUSES.map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                              ))}
                            </select>
                          </label>

                          <label className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-700">Delivery partner:</span>
                            <select
                              value={detail.delivery_partner_id ?? ""}
                              disabled={updatingId === order.id}
                              onChange={(e) => e.target.value && handleAssign(order.id, Number(e.target.value))}
                              className="rounded border border-gray-300 px-2 py-1 text-sm"
                            >
                              <option value="" disabled>
                                {partners === null ? "Loading..." : "Unassigned"}
                              </option>
                              {partners?.map((p) => (
                                <option key={p.id} value={p.id}>{p.full_name}</option>
                              ))}
                            </select>
                          </label>

                          {updatingId === order.id && <span className="text-xs text-gray-400">Saving...</span>}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
