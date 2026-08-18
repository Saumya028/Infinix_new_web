/**
 * The backend always works in paise (integers) — see backend/db/schema.sql
 * for why. This is the ONE place that converts to a rupee display string,
 * so every component formats money identically instead of each writing
 * its own `(price / 100).toFixed(2)` and risking inconsistency.
 */
export function formatPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
