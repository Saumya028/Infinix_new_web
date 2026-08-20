"use client";

/**
 * Client-side route protection for role-restricted pages (admin, delivery
 * portal). This mirrors the old site's <AdminRoute> wrapper, but as a hook
 * so each page controls exactly where the loading/redirect happens instead
 * of an extra wrapper component in the tree.
 *
 * IMPORTANT: this is UX only, not the real security boundary — a person
 * could disable JS and never see this redirect. The actual enforcement is
 * server-side: every admin/delivery endpoint requires require_staff /
 * require_delivery_partner (see backend/app/core/deps.py), which reject
 * the request before any data is returned, regardless of what the
 * frontend does. This hook just keeps someone without the right role from
 * seeing a broken/empty admin page instead of being redirected somewhere useful.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/lib/types";

export function useRequireRole(allowedRoles: User["role"][]) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      router.replace("/");
    }
    // allowedRoles is a fresh array each render on purpose — callers pass a
    // literal like ["admin", "ops"], and re-running this check every render
    // is cheap and correct; we intentionally don't memoize it upstream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, router]);

  const isAuthorized = !isLoading && !!user && allowedRoles.includes(user.role);
  return { user, isLoading, isAuthorized };
}
