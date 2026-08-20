"use client";

/**
 * app/layout.tsx is a Server Component (it can't hold useState/useEffect
 * directly). This tiny wrapper is the standard Next.js App Router pattern
 * for bridging that: layout.tsx renders <Providers>{children}</Providers>,
 * and everything inside Providers can use the client-side auth/cart
 * context, while layout.tsx itself stays a (fast, server-rendered) shell.
 */
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}
