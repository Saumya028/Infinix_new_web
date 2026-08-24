"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

export default function Header() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <header className="sticky top-0 z-10 border-b border-ink/10 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-lg font-bold tracking-wide text-ink">
          INFINIX
        </Link>

        <nav className="flex items-center gap-6 text-sm text-ink/70">
          <Link href="/products" className="transition-colors hover:text-coral">Shop</Link>

          <Link href="/cart" className="relative transition-colors hover:text-coral" aria-label="Cart">
            <span>Cart</span>
            {itemCount > 0 && (
              <span className="absolute -right-3 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-coral text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-4">
              {["admin", "ops", "support"].includes(user.role) && (
                <Link href="/admin/orders" className="transition-colors hover:text-coral">Admin</Link>
              )}
              {user.role === "delivery_partner" && (
                <Link href="/delivery/orders" className="transition-colors hover:text-coral">Deliveries</Link>
              )}
              <Link href="/account/orders" className="transition-colors hover:text-coral">
                {user.full_name.split(" ")[0]}
              </Link>
              <button onClick={logout} className="text-ink/40 transition-colors hover:text-coral">
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-ink px-4 py-1.5 text-white transition-colors hover:bg-coral"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
