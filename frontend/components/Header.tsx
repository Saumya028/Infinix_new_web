"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

export default function Header() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold text-brand">Infinix</Link>

        <nav className="flex items-center gap-6 text-sm text-gray-600">
          <Link href="/products" className="hover:text-brand">Shop</Link>

          <Link href="/cart" className="relative hover:text-brand" aria-label="Cart">
            <span>Cart</span>
            {itemCount > 0 && (
              <span className="absolute -right-3 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
                {itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-4">
              {["admin", "ops", "support"].includes(user.role) && (
                <Link href="/admin/orders" className="hover:text-brand">Admin</Link>
              )}
              {user.role === "delivery_partner" && (
                <Link href="/delivery/orders" className="hover:text-brand">Deliveries</Link>
              )}
              <Link href="/account/orders" className="hover:text-brand">
                {user.full_name.split(" ")[0]}
              </Link>
              <button onClick={logout} className="text-gray-400 hover:text-brand">
                Log out
              </button>
            </div>
          ) : (
            <Link href="/login" className="rounded bg-brand px-3 py-1.5 text-white hover:bg-brand-dark">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
