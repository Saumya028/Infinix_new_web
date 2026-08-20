"use client";

/**
 * Ported from the old site's AdminAnalytics.jsx — same set of cards
 * (summary stats, status breakdown, top products, daily trend), rewired
 * against GET /admin/analytics (see backend/app/routers/orders.py), which
 * computes all of this in SQL rather than the client aggregating raw
 * orders — same reasoning as the old backend's version of this endpoint.
 */
import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { useRequireRole } from "@/lib/useRequireRole";
import { clientFetch } from "@/lib/clientApi";
import { formatPaise } from "@/lib/format";
import type { Analytics, OrderStatus } from "@/lib/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Payment pending", confirmed: "Confirmed", packed: "Packed",
  out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled",
  return_requested: "Return requested", returned: "Returned", refunded: "Refunded",
};

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { isAuthorized, isLoading: authLoading } = useRequireRole(["admin", "ops", "support"]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthorized) return;
    clientFetch<Analytics>("/admin/analytics")
      .then(setAnalytics)
      .catch(() => setError("Unable to load analytics."));
  }, [isAuthorized]);

  if (authLoading || !isAuthorized) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
      <AdminNav />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!analytics ? (
        <p className="text-sm text-gray-500">Loading analytics...</p>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <SummaryCard label="Total Orders" value={String(analytics.summary.total_orders)} />
            <SummaryCard label="Revenue" value={formatPaise(analytics.summary.total_revenue_paise)} />
            <SummaryCard label="Avg. Order Value" value={formatPaise(analytics.summary.avg_order_value_paise)} />
            <SummaryCard label="Products" value={String(analytics.summary.total_products)} />
            <SummaryCard label="Customers" value={String(analytics.summary.total_customers)} />
          </div>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Orders by status
            </h2>
            <div className="flex flex-wrap gap-3">
              {analytics.status_counts.map((s) => (
                <div key={s.status} className="rounded-full border border-gray-200 px-4 py-1.5 text-sm">
                  <span className="text-gray-500">{STATUS_LABELS[s.status]}:</span>{" "}
                  <span className="font-semibold text-gray-900">{s.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Top products (by units sold)
            </h2>
            {analytics.top_products.length === 0 ? (
              <p className="text-sm text-gray-500">No sales yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Units sold</th>
                    <th className="pb-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analytics.top_products.map((p) => (
                    <tr key={p.product_name}>
                      <td className="py-2 text-gray-900">{p.product_name}</td>
                      <td className="py-2 text-gray-600">{p.units_sold}</td>
                      <td className="py-2 text-gray-600">{formatPaise(p.revenue_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Daily trend (last 30 days)
            </h2>
            {analytics.daily_trend.length === 0 ? (
              <p className="text-sm text-gray-500">No orders in this period.</p>
            ) : (
              <div className="space-y-1">
                {analytics.daily_trend.map((d) => {
                  const maxRevenue = Math.max(...analytics.daily_trend.map((x) => x.revenue_paise), 1);
                  const widthPct = Math.max(2, (d.revenue_paise / maxRevenue) * 100);
                  return (
                    <div key={d.day} className="flex items-center gap-3 text-xs">
                      <span className="w-24 flex-shrink-0 text-gray-500">{d.day}</span>
                      <div className="h-4 flex-1 rounded bg-gray-100">
                        <div
                          className="h-4 rounded bg-brand"
                          style={{ width: `${widthPct}%` }}
                          title={`${d.order_count} orders — ${formatPaise(d.revenue_paise)}`}
                        />
                      </div>
                      <span className="w-28 flex-shrink-0 text-right text-gray-600">
                        {formatPaise(d.revenue_paise)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
