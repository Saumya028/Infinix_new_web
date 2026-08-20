"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, ApiError } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { clientFetch } from "@/lib/clientApi";
import { loadRazorpayScript } from "@/lib/loadRazorpay";
import { formatPaise } from "@/lib/format";
import type { Order, RazorpayOrderResponse, ShippingAddress } from "@/lib/types";

type PaymentMethod = "cod" | "razorpay";

const emptyAddress: ShippingAddress = {
  contact_name: "", contact_phone: "", line1: "", line2: "",
  city: "", state: "", pincode: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { cart, isLoading: cartLoading, clearCart } = useCart();

  const [address, setAddress] = useState<ShippingAddress>(emptyAddress);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState("");

  // Checkout requires an account (the old site enforced this too — "Please
  // login first" — the difference is we redirect straight to /login with a
  // ?next= back here, instead of just showing an alert).
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/checkout");
    }
  }, [authLoading, user, router]);

  function updateField<K extends keyof ShippingAddress>(key: K, value: ShippingAddress[K]) {
    setAddress((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (address.contact_name.trim().length < 3) return "Please enter a valid full name.";
    if (!/^[6-9]\d{9}$/.test(address.contact_phone.trim())) return "Please enter a valid 10-digit mobile number.";
    if (address.line1.trim().length < 10) return "Address should be at least 10 characters.";
    if (!address.city.trim()) return "Please enter a city.";
    if (!address.state.trim()) return "Please enter a state.";
    if (!/^[1-9]\d{5}$/.test(address.pincode.trim())) return "Please enter a valid 6-digit pincode.";
    return null;
  }

  async function placeCodOrder() {
    const order = await clientFetch<Order>("/orders", {
      method: "POST",
      body: { shipping_address: address },
    });
    await clearCart(); // server cart is already empty post-order; this just re-syncs local state
    router.push(`/order-success/${order.id}`);
  }

  async function placeRazorpayOrder() {
    const razorpayOrder = await clientFetch<RazorpayOrderResponse>("/payment/razorpay/create-order", {
      method: "POST",
      body: { shipping_address: address },
    });

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError("Unable to load the payment gateway. Please check your connection and try again.");
      return;
    }

    const razorpay = new window.Razorpay!({
      key: razorpayOrder.key_id,
      amount: razorpayOrder.amount_paise,
      currency: razorpayOrder.currency,
      name: "Infinix",
      description: "Order payment",
      order_id: razorpayOrder.razorpay_order_id,
      prefill: {
        name: address.contact_name,
        contact: address.contact_phone,
      },
      theme: { color: "#0f766e" },
      handler: async (result: unknown) => {
        const payload = result as {
          razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string;
        };
        try {
          const verified = await clientFetch<RazorpayOrderResponse>("/payment/razorpay/verify", {
            method: "POST",
            body: {
              order_id: razorpayOrder.order_id,
              razorpay_order_id: payload.razorpay_order_id,
              razorpay_payment_id: payload.razorpay_payment_id,
              razorpay_signature: payload.razorpay_signature,
            },
          });
          await clearCart();
          router.push(`/order-success/${verified.order_id}`);
        } catch (err) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Payment verification failed. Please contact support if any amount was deducted.",
          );
        }
      },
      modal: {
        // Nothing to undo here on our side: the order row exists but stays
        // status=pending_payment (stock was already reserved when we
        // created it above) — see payment.py's note on abandoned payments.
        ondismiss: () => setError("Payment was not completed. You can try again whenever you're ready."),
      },
    });

    razorpay.on("payment.failed", () => {
      setError("Payment failed. Please try again or choose a different payment method.");
    });

    razorpay.open();
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsPlacing(true);
    try {
      if (paymentMethod === "razorpay") {
        await placeRazorpayOrder();
      } else {
        await placeCodOrder();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsPlacing(false);
    }
  }

  if (authLoading || cartLoading || !user) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading checkout...</p>;
  }

  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Your cart is empty</h1>
        <p className="mt-1 text-sm text-gray-500">Add something to your cart before checking out.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <form onSubmit={handlePlaceOrder} className="space-y-6 md:col-span-2">
        <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Delivery address
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Full name" required value={address.contact_name}
              onChange={(e) => updateField("contact_name", e.target.value)}
              className="col-span-2 rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <input
              placeholder="Mobile number" required value={address.contact_phone}
              onChange={(e) => updateField("contact_phone", e.target.value)}
              className="col-span-2 rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <textarea
              placeholder="Address (house no., street, area)" required value={address.line1}
              onChange={(e) => updateField("line1", e.target.value)}
              rows={2}
              className="col-span-2 rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <input
              placeholder="City" required value={address.city}
              onChange={(e) => updateField("city", e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <input
              placeholder="State" required value={address.state}
              onChange={(e) => updateField("state", e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <input
              placeholder="Pincode" required value={address.pincode}
              onChange={(e) => updateField("pincode", e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Payment method
          </h2>
          <div className="space-y-2">
            <label className="flex items-center gap-3 rounded border border-gray-300 p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
              <input
                type="radio" name="payment" checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
              />
              Cash on Delivery
            </label>
            <label className="flex items-center gap-3 rounded border border-gray-300 p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
              <input
                type="radio" name="payment" checked={paymentMethod === "razorpay"}
                onChange={() => setPaymentMethod("razorpay")}
              />
              Pay online (UPI / Card / Netbanking)
            </label>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPlacing}
          className="w-full rounded bg-brand py-3 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 md:w-auto md:px-10"
        >
          {isPlacing ? "Placing order..." : "Place Order"}
        </button>
      </form>

      <aside className="h-fit rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Order summary</h2>
        <ul className="space-y-2 text-sm">
          {cart.items.map((item) => (
            <li key={item.id} className="flex justify-between text-gray-600">
              <span>{item.product_name} × {item.quantity}</span>
              <span>{formatPaise(item.unit_price_paise * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-semibold text-gray-900">
          <span>Total</span>
          <span>{formatPaise(cart.subtotal_paise)}</span>
        </div>
      </aside>
    </div>
  );
}
