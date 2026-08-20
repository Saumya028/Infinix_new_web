/**
 * Ported near-verbatim from the old site's utils/loadRazorpay.js — this
 * logic (load on demand, reuse the same promise on repeat calls, only add
 * the script tag once) was already correct there.
 */
const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loadPromise: Promise<boolean> | null = null;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => {
      loadPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
