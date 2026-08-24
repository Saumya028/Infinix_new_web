"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { formatPaise } from "@/lib/format";
import type { Category, ProductCard as ProductCardType } from "@/lib/types";
import Ph from "./Ph";
import Reveal from "./Reveal";

/**
 * Product photos come from the backend's image pipeline, not from /public
 * — they need the same handling as components/ProductCard.tsx:
 *   - processed: next/image + the custom loader (lib/imageLoader.ts), which
 *     appends "-{width}.webp" to the base key. This is why a processed
 *     product's raw `primary_image_url` 404s if you load it directly with
 *     a plain <img> — there's no file at that exact URL, only at
 *     "<url>-200.webp" / "-600.webp" / "-1200.webp".
 *   - legacy / unprocessed: the stored URL IS the real file, so a plain
 *     <img> works directly.
 *   - none: the same branded placeholder used everywhere else on the page.
 */
function ProductPhoto({
  product,
  className,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 400px",
}: {
  product: ProductCardType;
  className: string;
  sizes?: string;
}) {
  if (product.primary_image_url && product.primary_image_is_processed) {
    return (
      <Image
        src={product.primary_image_url}
        alt={product.name}
        fill
        sizes={sizes}
        className={className}
      />
    );
  }
  if (product.primary_image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={product.primary_image_url} alt={product.name} loading="lazy" className={`absolute inset-0 h-full w-full ${className}`} />;
  }
  return <Ph src="" alt={product.name} label={product.name} className={`absolute inset-0 h-full w-full ${className}`} />;
}

// ─── Static marketing content (safe to edit freely — none of this comes
// from the backend) ─────────────────────────────────────────────────────
const TESTIMONIALS = [
  { quote: "Smells incredible and lasts all day. I get compliments everywhere I go.", name: "Priya S.", location: "Mumbai" },
  { quote: "Finally a beauty brand that feels truly luxurious. The packaging alone is stunning.", name: "Aisha K.", location: "Delhi" },
  { quote: "The nail colors are so rich and pigmented. Worth every rupee.", name: "Ritu M.", location: "Bengaluru" },
  { quote: "My go-to body spray now. Pure confidence in a bottle.", name: "Sanya T.", location: "Pune" },
];

const MOODS = ["EVERYDAY", "DATE NIGHT", "PARTY", "FRESH", "BOLD", "SOFT", "OUTDOORS", "WORK"];

function moodSlug(mood: string) {
  return mood.toLowerCase().replace(/\s+/g, "-");
}

function StarRow({ size = "sm" }: { size?: "sm" | "md" }) {
  return <span className={`${size === "sm" ? "text-xs" : "text-sm"} tracking-widest text-gold`}>★★★★★</span>;
}

// ─── Hooks ──────────────────────────────────────────────────────────────
function useScrolled(threshold = 60) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);
  return scrolled;
}

// ─── Nav ────────────────────────────────────────────────────────────────
function MegaMenu({ categories }: { categories: Category[] }) {
  const shown = categories.slice(0, 6);
  return (
    <div className="absolute left-1/2 top-full z-50 mt-2 w-[640px] -translate-x-1/2 animate-menu-open rounded-2xl border border-blush bg-cream/95 p-8 shadow-2xl backdrop-blur-xl">
      <div className="grid grid-cols-3 gap-8">
        <div>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-sand">Categories</p>
          {shown.length > 0 ? (
            shown.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                className="block py-1.5 text-sm text-ink transition-all duration-200 hover:translate-x-1 hover:text-coral"
              >
                {c.name}
              </Link>
            ))
          ) : (
            <p className="text-sm text-sand">Add categories from the admin panel.</p>
          )}
        </div>
        <div>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-sand">Featured</p>
          <div className="space-y-3">
            {["New Arrivals", "Best Sellers", "Limited Edition", "Gift Sets"].map((f) => (
              <Link key={f} href="/products" className="block text-sm text-ink transition-colors hover:text-coral">
                {f}
              </Link>
            ))}
          </div>
        </div>
        <div className="relative h-48 overflow-hidden rounded-xl">
          <Ph src="/images/mega-menu-feature.webp" alt="Featured product" label="Featured product" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex flex-col justify-end bg-ink/40 p-4">
            <p className="text-[10px] tracking-widest text-blush">FEATURED</p>
            <p className="font-display text-sm text-white">This week&apos;s pick</p>
            <Link href="/products" className="mt-1 text-xs text-coral hover:underline">Shop Now →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Nav({ categories }: { categories: Category[] }) {
  const scrolled = useScrolled(80);
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const textColor = scrolled ? "text-ink" : "text-white";

  return (
    <>
      <nav
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
          scrolled ? "bg-cream/90 py-3 shadow-sm backdrop-blur-xl" : "bg-transparent py-6"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link href="/" className={`font-display text-2xl font-bold tracking-[0.1em] transition-colors duration-500 ${textColor}`}>
            INFINIX
          </Link>

          <div className="relative hidden items-center gap-8 md:flex">
            <Link href="/products" className={`text-[13px] font-medium tracking-wide transition-colors duration-300 hover:text-coral ${textColor}`}>
              New Arrivals
            </Link>
            <Link href="/products" className={`text-[13px] font-medium tracking-wide transition-colors duration-300 hover:text-coral ${textColor}`}>
              Best Sellers
            </Link>
            <div className="relative" onMouseEnter={() => setMegaOpen(true)} onMouseLeave={() => setMegaOpen(false)}>
              <span className={`cursor-pointer text-[13px] font-medium tracking-wide transition-colors duration-300 hover:text-coral ${textColor}`}>
                Shop
              </span>
              {megaOpen && <MegaMenu categories={categories} />}
            </div>
          </div>

          <div className="flex items-center gap-5">
            {user ? (
              <Link
                href="/account/orders"
                className={`hidden text-[13px] font-medium tracking-wide transition-colors duration-300 hover:text-coral sm:block ${textColor}`}
              >
                {user.full_name.split(" ")[0]}
              </Link>
            ) : (
              <Link
                href="/login"
                className={`hidden text-[13px] font-medium tracking-wide transition-colors duration-300 hover:text-coral sm:block ${textColor}`}
              >
                Log In
              </Link>
            )}

            <Link href="/cart" aria-label="Cart" className={`relative transition-colors duration-300 hover:text-coral ${textColor}`}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 animate-pulse-dot items-center justify-center rounded-full bg-coral text-[9px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>

            <button className={`transition-colors duration-300 md:hidden ${textColor}`} onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-ink p-8">
          <div className="mb-12 flex items-center justify-between">
            <span className="font-display text-2xl tracking-widest text-cream">INFINIX</span>
            <button className="text-cream" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="space-y-6">
            {[
              { label: "Shop", href: "/products" },
              { label: "New Arrivals", href: "/products" },
              { label: "Best Sellers", href: "/products" },
              { label: "Cart", href: "/cart" },
              { label: user ? "My Account" : "Log In", href: user ? "/account/orders" : "/login" },
            ].map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block animate-fade-up font-display text-4xl text-cream"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {item.label}
              </Link>
            ))}
            {user && (
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="animate-fade-up font-display text-4xl text-sand"
                style={{ animationDelay: "0.4s" }}
              >
                Log Out
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-ink">
      <div className="absolute inset-0">
        <Ph src="/images/hero-bg.webp" alt="" label="Hero background photo" className="h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/20" />
      </div>

      <div className="pointer-events-none absolute right-1/4 top-1/4 h-96 w-96 animate-float-slow rounded-full bg-coral/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/3 left-1/3 h-64 w-64 animate-float rounded-full bg-gold/10 blur-2xl" />

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-16 px-6 pb-20 pt-32 lg:grid-cols-2">
        <div>
          <div className="mb-8 inline-flex animate-fade-up items-center gap-2">
            <span className="h-px w-8 bg-coral" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-coral">New Collection 2026</span>
          </div>

          <h1 className="font-display text-[clamp(3.5rem,10vw,8rem)] font-bold leading-[0.9] text-cream">
            <span className="block animate-fade-up" style={{ animationDelay: "0.1s" }}>MAKE</span>
            <span className="block animate-fade-up" style={{ animationDelay: "0.25s" }}>AN</span>
            <span className="block animate-fade-up italic text-coral" style={{ animationDelay: "0.4s" }}>ENTRANCE.</span>
          </h1>

          <p className="mt-8 max-w-sm animate-fade-up text-lg leading-relaxed text-sand" style={{ animationDelay: "0.55s" }}>
            Luxury fragrances, bold nail colors, and skin-loving body care. Crafted for those who dare to be unforgettable.
          </p>

          <div className="mt-10 flex flex-wrap animate-fade-up gap-4" style={{ animationDelay: "0.7s" }}>
            <Link
              href="/products"
              className="group relative rounded-full bg-coral px-8 py-4 text-sm font-semibold tracking-[0.15em] text-white transition-all duration-300 hover:scale-[1.03] hover:bg-coral-dark hover:shadow-lg hover:shadow-coral/30"
            >
              SHOP COLLECTION
              <span className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/products"
              className="rounded-full border border-cream/30 px-8 py-4 text-sm font-semibold tracking-[0.15em] text-cream transition-all duration-300 hover:bg-cream/10"
            >
              EXPLORE
            </Link>
          </div>

          <div className="mt-14 flex animate-fade-up items-center gap-8" style={{ animationDelay: "0.7s" }}>
            {[["500+", "Products"], ["4.9★", "Avg Rating"], ["50k+", "Happy Customers"]].map(([val, label]) => (
              <div key={label}>
                <p className="font-display text-2xl font-bold text-cream">{val}</p>
                <p className="mt-0.5 text-xs tracking-wider text-sand">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative hidden items-center justify-center lg:flex">
          <div className="relative animate-float">
            <Ph
              src="/images/hero-product.webp"
              alt="Featured product"
              label="Hero product shot"
              className="h-[520px] w-80 rounded-[2.5rem] object-cover shadow-2xl"
            />
            <div className="absolute -right-6 -top-6 flex h-24 w-24 rotate-12 flex-col items-center justify-center rounded-full bg-coral shadow-lg">
              <span className="text-[9px] font-bold tracking-widest text-white">BESTSELLER</span>
              <span className="mt-0.5 text-xs text-white">★ 4.8</span>
            </div>
            <div className="absolute -bottom-4 -left-6 rounded-2xl bg-cream/90 p-4 shadow-xl backdrop-blur-md">
              <p className="text-[10px] tracking-wider text-sand">FEATURED</p>
              <p className="font-display text-sm font-semibold text-ink">Velvet Noir Mist</p>
              <p className="mt-1 text-sm font-semibold text-coral">₹899</p>
            </div>
          </div>
          <div className="absolute left-0 top-8 h-16 w-16 animate-float-slow rounded-full border-2 border-coral/40" />
          <div className="absolute bottom-16 right-0 h-10 w-10 animate-float rounded-full bg-gold/60" style={{ animationDelay: "2s" }} />
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 opacity-60">
        <span className="text-[10px] uppercase tracking-widest text-sand">Scroll</span>
        <div className="h-12 w-px bg-gradient-to-b from-sand to-transparent" />
      </div>
    </section>
  );
}

// ─── Marquee ────────────────────────────────────────────────────────────
function Marquee() {
  const items = ["BODY CARE", "✦", "BEAUTY", "✦", "CONFIDENCE", "✦", "EVERYDAY LUXURY", "✦", "FRAGRANCES", "✦", "NAIL COLORS", "✦"];
  const doubled = items.concat(items);
  return (
    <div className="overflow-hidden bg-coral py-5">
      <div className="flex animate-marquee items-center gap-12 whitespace-nowrap">
        {doubled.concat(doubled).map((item, i) => (
          <span key={i} className={`flex-shrink-0 font-display font-bold tracking-[0.15em] ${item === "✦" ? "text-lg text-cream/60" : "text-2xl text-cream"}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Featured collections (real categories) ────────────────────────────
function FeaturedCollections({ categories }: { categories: Category[] }) {
  const spans = ["col-span-1 row-span-2", "col-span-2 row-span-1", "col-span-1 row-span-1", "col-span-1 row-span-1"];
  const shown = categories.slice(0, 4);

  return (
    <section className="bg-cream px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 flex items-end justify-between">
          <Reveal>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-sand">Explore</p>
            <h2 className="font-display text-5xl font-bold leading-tight text-ink md:text-6xl">
              Our<br /><span className="italic text-coral">Collections.</span>
            </h2>
          </Reveal>
          <Reveal delay={150} className="hidden md:block">
            <Link href="/products" className="group flex items-center gap-2 text-sm font-semibold tracking-widest text-ink transition-colors hover:text-coral">
              SHOP ALL
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
        </div>

        {shown.length > 0 ? (
          <div className="grid h-[600px] grid-cols-3 grid-rows-2 gap-4">
            {shown.map((cat, i) => (
              <Reveal key={cat.id} delay={i * 100} className={`${spans[i] ?? "col-span-1 row-span-1"} group relative cursor-pointer overflow-hidden rounded-2xl`}>
                <Link href={`/products?category=${cat.slug}`} className="block h-full w-full">
                  <Ph
                    src={`/images/collections/${cat.slug}.webp`}
                    alt={cat.name}
                    label={cat.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 translate-y-4 p-6 transition-transform duration-400 group-hover:translate-y-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-coral">{cat.name}</p>
                    <p className="mt-3 flex items-center gap-2 text-sm text-blush opacity-0 transition-opacity duration-400 group-hover:opacity-100">
                      Explore Collection <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="text-sm text-sand">No categories yet — add some from the admin panel.</p>
        )}
      </div>
    </section>
  );
}

// ─── Best sellers (real products) ──────────────────────────────────────
function StoreProductCard({ product, delay = 0 }: { product: ProductCardType; delay?: number }) {
  const [wishlisted, setWishlisted] = useState(false);
  const priceLabel =
    product.min_price_paise === product.max_price_paise
      ? formatPaise(product.min_price_paise)
      : `${formatPaise(product.min_price_paise)} – ${formatPaise(product.max_price_paise)}`;

  return (
    <Reveal delay={delay} className="w-72 flex-shrink-0 md:w-80">
      <Link href={`/products/${product.slug}`} className="group block cursor-pointer">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-blush">
          <ProductPhoto
            product={product}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />

          {!product.in_stock && (
            <div className="absolute left-4 top-4 rounded-full bg-ink px-3 py-1 text-[10px] font-semibold tracking-widest text-cream">
              OUT OF STOCK
            </div>
          )}

          <button
            onClick={(e) => { e.preventDefault(); setWishlisted(!wishlisted); }}
            className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 ${
              wishlisted ? "scale-110 bg-coral text-white" : "bg-white/80 text-ink backdrop-blur-sm"
            }`}
            aria-label="Wishlist"
          >
            <svg className="h-4 w-4" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          <div className="absolute bottom-0 left-0 right-0 translate-y-full p-4 opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="block w-full rounded-xl bg-ink py-3 text-center text-sm font-semibold tracking-wider text-cream transition-colors duration-300 group-hover:bg-coral">
              VIEW PRODUCT
            </span>
          </div>
        </div>

        <div className="mt-4 px-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sand">{product.brand}</p>
          <h3 className="mt-1 font-display text-lg leading-tight text-ink transition-colors duration-300 group-hover:text-coral">{product.name}</h3>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-semibold text-ink">{priceLabel}</span>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}

function BestSellers({ products }: { products: ProductCardType[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "right" ? 340 : -340, behavior: "smooth" });
  };

  return (
    <section className="overflow-hidden bg-ink py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 flex items-end justify-between">
          <Reveal>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-coral">Trending Now</p>
            <h2 className="font-display text-5xl font-bold leading-tight text-cream md:text-6xl">
              Best<br /><span className="italic">Sellers.</span>
            </h2>
          </Reveal>
          {products.length > 0 && (
            <div className="flex gap-3">
              <button onClick={() => scroll("left")} aria-label="Scroll left" className="flex h-12 w-12 items-center justify-center rounded-full border border-cream/20 text-cream transition-all duration-300 hover:border-coral hover:bg-coral">
                ←
              </button>
              <button onClick={() => scroll("right")} aria-label="Scroll right" className="flex h-12 w-12 items-center justify-center rounded-full border border-cream/20 text-cream transition-all duration-300 hover:border-coral hover:bg-coral">
                →
              </button>
            </div>
          )}
        </div>

        {products.length > 0 ? (
          <div ref={scrollRef} className="no-scrollbar flex gap-6 overflow-x-auto pb-4">
            {products.map((p, i) => (
              <StoreProductCard key={p.id} product={p} delay={(i % 4) * 100} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-sand">No products yet — add some from the admin panel and they&apos;ll show up here automatically.</p>
        )}
      </div>
    </section>
  );
}

// ─── Find Your Signature (mood picker) ─────────────────────────────────
function FindYourSignature() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="bg-cream px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-16 text-center">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-sand">Personalize</p>
          <h2 className="font-display text-5xl font-bold leading-tight text-ink md:text-6xl">
            Find Your<br /><span className="italic text-coral">Signature.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sand">Select your mood and discover the perfect product for every moment.</p>
        </Reveal>

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-wrap gap-3">
            {MOODS.map((mood, i) => (
              <Reveal key={mood} delay={(i % 5) * 80} as="span">
                <button
                  onMouseEnter={() => setActive(mood)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => setActive(active === mood ? null : mood)}
                  className={`rounded-full border px-6 py-3 text-sm font-semibold tracking-[0.15em] transition-all duration-300 ${
                    active === mood
                      ? "scale-105 border-ink bg-ink text-cream shadow-lg"
                      : "border-ink/30 bg-transparent text-ink hover:border-coral hover:text-coral"
                  }`}
                >
                  {mood}
                </button>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200} className="relative h-80 overflow-hidden rounded-2xl bg-blush">
            {active ? (
              <>
                <Ph
                  key={active}
                  src={`/images/moods/${moodSlug(active)}.webp`}
                  alt={active}
                  label={active}
                  className="h-full w-full animate-scale-in object-cover"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-ink/60 to-transparent p-6">
                  <div>
                    <p className="text-[10px] tracking-widest text-blush">SHOP FOR</p>
                    <p className="font-display text-2xl text-white">{active}</p>
                    <Link href="/products" className="mt-2 inline-block text-sm text-coral hover:underline">Explore →</Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="font-display text-3xl italic text-sand">Your vibe here.</p>
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── Brand story ────────────────────────────────────────────────────────
function BrandStory() {
  return (
    <section className="relative overflow-hidden py-36">
      <Ph src="/images/brand-story-bg.webp" alt="Brand story" label="Brand story photo" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-ink/75" />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <Reveal>
          <p className="mb-8 text-[11px] font-semibold uppercase tracking-[0.4em] text-coral">Our Philosophy</p>
          <h2 className="font-display text-[clamp(2.5rem,7vw,6rem)] font-bold leading-[0.95] text-cream">
            &quot;BEAUTY SHOULD<br /><span className="italic text-coral">FEEL LIKE YOU.&quot;</span>
          </h2>
          <p className="mx-auto mt-10 max-w-xl text-lg leading-relaxed text-sand">
            We believe luxury isn&apos;t a price tag — it&apos;s a feeling. Every Infinix product is crafted to celebrate the real you: bold, soft, complex, and completely unforgettable.
          </p>
          <Link
            href="/products"
            className="group mt-10 inline-flex items-center gap-3 rounded-full border border-cream/40 px-8 py-4 text-sm font-semibold tracking-widest text-cream transition-all duration-300 hover:bg-cream/10"
          >
            DISCOVER OUR STORY
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Product spotlight ──────────────────────────────────────────────────
function ProductSpotlight({ product }: { product?: ProductCardType }) {
  if (!product) return null;

  const priceLabel =
    product.min_price_paise === product.max_price_paise
      ? formatPaise(product.min_price_paise)
      : `${formatPaise(product.min_price_paise)} – ${formatPaise(product.max_price_paise)}`;

  return (
    <section className="bg-blush py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <Reveal className="flex justify-center">
            <div className="relative w-full max-w-md animate-float">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2.5rem] bg-cream shadow-2xl">
                {product.primary_image_url ? (
                  <ProductPhoto product={product} className="object-cover" sizes="(max-width: 768px) 90vw, 448px" />
                ) : (
                  <Ph src="/images/spotlight-product.webp" alt={product.name} label={product.name} className="absolute inset-0 h-full w-full object-cover" />
                )}
              </div>
              <div className="pointer-events-none absolute -inset-3 -z-10 rounded-[2.5rem] border-2 border-coral/30" />
            </div>
          </Reveal>

          <Reveal delay={150}>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-coral">Product Spotlight</p>
            <h2 className="font-display text-4xl font-bold leading-tight text-ink md:text-5xl">
              {product.name}
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <StarRow size="md" />
            </div>
            <p className="mt-6 max-w-sm leading-relaxed text-ink/60">
              A signature pick built to be unforgettable — the piece that finishes every look.
            </p>
            <div className="mt-6">
              <span className="font-display text-4xl font-bold text-ink">{priceLabel}</span>
            </div>

            <div className="mt-8">
              <Link
                href={`/products/${product.slug}`}
                className="inline-block rounded-2xl bg-ink px-10 py-4 text-sm font-semibold tracking-wider text-cream transition-all duration-300 hover:bg-coral"
              >
                VIEW & CHOOSE OPTIONS →
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {["Free Shipping", "Authentic", "Easy Returns"].map((tag) => (
                <span key={tag} className="rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-[10px] font-semibold tracking-wider text-ink/60">
                  {tag}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── Promo banner ────────────────────────────────────────────────────────
function PromoBanner() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-ink via-ink-soft to-[#2A1F1C] py-24">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-coral/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 lg:flex-row">
        <Reveal className="flex-1">
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.3em] text-coral">Limited Time</p>
          <h2 className="font-display text-[clamp(2.5rem,8vw,6rem)] font-bold leading-[0.95] text-cream">
            YOUR EVERYDAY<br /><span className="italic text-coral">DOSE OF</span><br />CONFIDENCE.
          </h2>
          <p className="mt-6 max-w-md text-lg text-sand">Up to 40% off our most-loved collections. Limited stock, unlimited confidence.</p>
          <Link
            href="/products"
            className="mt-8 inline-block rounded-full bg-coral px-10 py-5 text-sm font-bold tracking-[0.15em] text-white transition-all duration-300 hover:scale-105 hover:bg-coral-dark hover:shadow-xl hover:shadow-coral/30"
          >
            SHOP NOW →
          </Link>
        </Reveal>

        <Reveal delay={200} className="flex gap-4">
          {[["40", "%", "Max Discount"], ["48", "h", "Sale Ends In"], ["200", "+", "Products On Sale"]].map(([val, unit, label]) => (
            <div key={label} className="rounded-2xl border border-cream/10 bg-cream/5 px-6 py-6 text-center backdrop-blur-sm">
              <p className="font-display text-4xl font-bold text-cream">{val}<span className="text-coral">{unit}</span></p>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-sand">{label}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ─── Testimonials ────────────────────────────────────────────────────────
function Testimonials() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % TESTIMONIALS.length), 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="bg-cream px-6 py-28">
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-sand">What They Say</p>
          <h2 className="mb-16 font-display text-4xl font-bold text-ink">Loved by <span className="italic text-coral">thousands.</span></h2>
        </Reveal>

        <Reveal delay={150} className="relative min-h-[200px]">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className={`absolute inset-0 transition-all duration-600 ${i === active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>
              <p className="font-display text-3xl italic leading-tight text-ink md:text-4xl">&quot;{t.quote}&quot;</p>
              <div className="mt-8 flex flex-col items-center gap-2">
                <StarRow size="md" />
                <p className="text-sm font-semibold tracking-wider text-ink">{t.name}</p>
                <p className="text-xs text-sand">{t.location}</p>
              </div>
            </div>
          ))}
        </Reveal>

        <div className="mt-8 flex justify-center gap-2">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Show testimonial ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${i === active ? "h-2 w-8 bg-coral" : "h-2 w-2 bg-blush"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Social gallery ──────────────────────────────────────────────────────
function SocialGallery() {
  const cells = Array.from({ length: 8 }, (_, i) => i + 1);
  return (
    <section className="overflow-hidden bg-cream-dark px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-12 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-sand">Community</p>
          <h2 className="font-display text-4xl font-bold text-ink">Follow <span className="italic text-coral">@INFINIX</span></h2>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cells.map((n, i) => (
            <Reveal
              key={n}
              delay={(i % 5) * 80}
              className={`group relative cursor-pointer overflow-hidden rounded-2xl bg-blush ${i === 1 || i === 4 ? "row-span-2" : ""}`}
            >
              <div style={{ height: i === 1 || i === 4 ? "360px" : "180px" }}>
                <Ph src={`/images/social/${n}.webp`} alt="" label={`Social photo ${n}`} className="h-full w-full object-cover transition-all duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 flex items-center justify-center bg-ink/0 transition-all duration-400 group-hover:bg-ink/30">
                  <svg className="h-8 w-8 text-white opacity-0 transition-opacity duration-400 group-hover:opacity-100" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Newsletter ──────────────────────────────────────────────────────────
function Newsletter() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <section className="relative overflow-hidden bg-ink px-6 py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-0 h-96 w-96 animate-float-slow rounded-full bg-coral/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 animate-float rounded-full bg-gold/10 blur-2xl" />
      </div>

      <Reveal className="relative mx-auto max-w-2xl text-center">
        <h2 className="font-display text-[clamp(2.5rem,8vw,5.5rem)] font-bold leading-[0.9] text-cream">
          STAY<br />IN THE<br /><span className="italic text-coral">LOOP.</span>
        </h2>
        <p className="mt-8 text-lg text-sand">Early access to launches, exclusive offers, and beauty secrets delivered to your inbox.</p>

        {joined ? (
          <div className="mt-10 animate-fade-up">
            <p className="font-display text-2xl text-coral">Welcome to the family ✦</p>
            <p className="mt-2 text-sand">You&apos;re on the list. Get ready for something beautiful.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); if (email) setJoined(true); }}
            className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 rounded-2xl border border-cream/20 bg-cream/10 px-6 py-4 text-sm text-cream placeholder-sand transition-colors duration-300 focus:border-coral focus:outline-none"
            />
            <button
              type="submit"
              className="whitespace-nowrap rounded-2xl bg-coral px-6 py-4 text-sm font-semibold tracking-wider text-white transition-all duration-300 hover:scale-[1.02] hover:bg-coral-dark"
            >
              JOIN THE COMMUNITY →
            </button>
          </form>
        )}
        <p className="mt-4 text-[10px] tracking-wider text-sand/60">No spam. Unsubscribe anytime.</p>
      </Reveal>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────
function HomeFooter() {
  const cols = [
    { title: "SHOP", links: [{ label: "New Arrivals", href: "/products" }, { label: "Best Sellers", href: "/products" }, { label: "All Products", href: "/products" }] },
    { title: "ABOUT", links: [{ label: "Our Story", href: "/" }, { label: "Contact", href: "/" }, { label: "FAQ", href: "/" }] },
    { title: "ACCOUNT", links: [{ label: "My Account", href: "/account/orders" }, { label: "My Orders", href: "/account/orders" }, { label: "Cart", href: "/cart" }] },
    { title: "SOCIAL", links: [{ label: "Instagram", href: "#" }, { label: "Facebook", href: "#" }, { label: "YouTube", href: "#" }] },
  ];

  return (
    <footer className="border-t border-blush bg-cream px-6 pb-8 pt-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 grid grid-cols-2 gap-12 md:grid-cols-4">
          {cols.map((col) => (
            <div key={col.title}>
              <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.3em] text-sand">{col.title}</p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-ink transition-colors duration-200 hover:text-coral">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mb-8 border-b border-t border-blush py-12 text-center">
          <p className="select-none font-display text-[clamp(3rem,15vw,10rem)] font-black leading-none tracking-[0.2em] text-ink/10">
            INFINIX
          </p>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 text-xs text-sand md:flex-row">
          <p>© {new Date().getFullYear()} Infinix Beauty. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="transition-colors hover:text-coral">Privacy Policy</Link>
            <Link href="#" className="transition-colors hover:text-coral">Terms of Use</Link>
            <Link href="#" className="transition-colors hover:text-coral">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page assembly ────────────────────────────────────────────────────────
export default function HomeClient({
  categories,
  products,
  loadError,
}: {
  categories: Category[];
  products: ProductCardType[];
  loadError: boolean;
}) {
  return (
    <div className="min-h-screen font-body">
      <Nav categories={categories} />
      <Hero />
      <Marquee />
      {loadError ? (
        <p className="bg-cream px-6 py-10 text-center text-sm text-red-500">
          We couldn&apos;t load the catalog right now. Please refresh in a moment.
        </p>
      ) : (
        <FeaturedCollections categories={categories} />
      )}
      <BestSellers products={products} />
      <FindYourSignature />
      <BrandStory />
      <ProductSpotlight product={products[0]} />
      <PromoBanner />
      <Testimonials />
      <SocialGallery />
      <Newsletter />
      <HomeFooter />
    </div>
  );
}
