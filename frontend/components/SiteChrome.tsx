"use client";

/**
 * The homepage uses a full-bleed, transparent-over-hero navbar (built into
 * HomeClient) instead of the site's normal boxed header — so this wrapper
 * decides, per route, whether to render the standard sticky <Header> +
 * padded <main>, or hand full control of the viewport to the page itself.
 * Every other route (products, cart, checkout, admin, account, etc.) is
 * completely unaffected.
 */
import { usePathname } from "next/navigation";
import Header from "./Header";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
