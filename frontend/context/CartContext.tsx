"use client";

/**
 * Ported from the old site's context/CartContext.jsx. Same core behavior,
 * rewritten against the new server-side cart API instead of Flask's:
 *   - Not logged in: cart lives entirely in localStorage ("guest_cart").
 *   - Logged in: cart lives server-side (GET/POST/PATCH/DELETE /cart...),
 *     scoped to the user by their JWT — see backend/app/routers/cart.py.
 *   - On login: any items sitting in the guest cart get POSTed to the
 *     server cart one by one, then localStorage is cleared. This is the
 *     exact merge-on-login behavior and reasoning the old CartContext had
 *     ("previously these were silently discarded... anything a guest
 *     added before logging in just vanished").
 *
 * One deliberate difference from the old version: adding/updating a
 * logged-in user's cart now goes through the server, which enforces real
 * stock limits (see cart.py) — so those calls can fail with a message like
 * "Only 3 left in stock". The guest-cart path can't enforce this (no DB to
 * check against without an API call per keystroke), so it trusts the
 * `stock_quantity` snapshot passed in at add-to-cart time as a best
 * effort; the real check always happens again server-side at checkout,
 * since checkout requires being logged in anyway.
 */
import {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { clientFetch } from "@/lib/clientApi";
import type { CartItem, CartState } from "@/lib/types";

const GUEST_CART_KEY = "guest_cart";
const EMPTY_CART: CartState = { items: [], subtotal_paise: 0 };

function computeSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unit_price_paise * item.quantity, 0);
}

function readGuestCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeGuestCart(items: CartItem[]) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

/** What VariantSelector/ProductCard pass in when the user clicks "Add to Cart" —
 * everything needed to render a guest cart line item without another API call. */
export interface AddToCartInput {
  variant_id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  variant_name: string;
  unit_price_paise: number;
  compare_at_paise: number | null;
  image_url: string | null;
  stock_quantity: number;
}

interface CartContextValue {
  cart: CartState;
  isLoading: boolean;
  addToCart: (item: AddToCartInput, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCart({ items: readGuestCart(), subtotal_paise: computeSubtotal(readGuestCart()) });
      setIsLoading(false);
      return;
    }

    (async () => {
      const guestItems = readGuestCart();
      if (guestItems.length > 0) {
        await Promise.all(
          guestItems.map((item) =>
            clientFetch("/cart/items", {
              method: "POST",
              body: { variant_id: item.variant_id, quantity: item.quantity },
            }).catch((err) => console.error("Cart merge error:", err))),
        );
        localStorage.removeItem(GUEST_CART_KEY);
      }
      try {
        const serverCart = await clientFetch<CartState>("/cart");
        setCart(serverCart);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user, authLoading]);

  const addToCart = useCallback(async (input: AddToCartInput, quantity = 1) => {
    if (user) {
      const updated = await clientFetch<CartState>("/cart/items", {
        method: "POST",
        body: { variant_id: input.variant_id, quantity },
      });
      setCart(updated);
      return;
    }

    setCart((prev) => {
      const existing = prev.items.find((i) => i.variant_id === input.variant_id);
      const nextItems = existing
        ? prev.items.map((i) =>
            i.variant_id === input.variant_id
              ? { ...i, quantity: Math.min(i.quantity + quantity, input.stock_quantity) }
              : i)
        : [...prev.items, {
            id: input.variant_id, // synthetic — no server row exists yet for a guest
            variant_id: input.variant_id,
            quantity: Math.min(quantity, input.stock_quantity),
            product_id: input.product_id,
            product_name: input.product_name,
            product_slug: input.product_slug,
            variant_name: input.variant_name,
            unit_price_paise: input.unit_price_paise,
            compare_at_paise: input.compare_at_paise,
            image_url: input.image_url,
            stock_quantity: input.stock_quantity,
          }];
      writeGuestCart(nextItems);
      return { items: nextItems, subtotal_paise: computeSubtotal(nextItems) };
    });
  }, [user]);

  const updateQuantity = useCallback(async (itemId: number, quantity: number) => {
    if (user) {
      const updated = await clientFetch<CartState>(`/cart/items/${itemId}`, {
        method: "PATCH", body: { quantity },
      });
      setCart(updated);
      return;
    }
    setCart((prev) => {
      const nextItems = prev.items.map((i) => (i.id === itemId ? { ...i, quantity } : i));
      writeGuestCart(nextItems);
      return { items: nextItems, subtotal_paise: computeSubtotal(nextItems) };
    });
  }, [user]);

  const removeItem = useCallback(async (itemId: number) => {
    if (user) {
      const updated = await clientFetch<CartState>(`/cart/items/${itemId}`, { method: "DELETE" });
      setCart(updated);
      return;
    }
    setCart((prev) => {
      const nextItems = prev.items.filter((i) => i.id !== itemId);
      writeGuestCart(nextItems);
      return { items: nextItems, subtotal_paise: computeSubtotal(nextItems) };
    });
  }, [user]);

  const clearCart = useCallback(async () => {
    if (user) {
      const updated = await clientFetch<CartState>("/cart", { method: "DELETE" });
      setCart(updated);
      return;
    }
    localStorage.removeItem(GUEST_CART_KEY);
    setCart(EMPTY_CART);
  }, [user]);

  const value = useMemo(
    () => ({ cart, isLoading, addToCart, updateQuantity, removeItem, clearCart }),
    [cart, isLoading, addToCart, updateQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
