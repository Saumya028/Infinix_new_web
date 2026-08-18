import Link from "next/link";
import type { ProductCard as ProductCardType } from "@/lib/types";
import { formatPaise } from "@/lib/format";

/**
 * NOTE on images: we're using a plain <img> tag here, not next/image, on
 * purpose FOR NOW. next/image needs a known, allow-listed remote domain
 * (see next.config.mjs) to optimize images — since we're still using
 * placeholder URLs from arbitrary sources, next/image would either error
 * or do nothing useful. Step 6 swaps this to next/image once real product
 * images are served from our own CDN domain — that single change is what
 * actually fixes the slow image loading from the old site (resizing,
 * WebP conversion, lazy loading all become automatic at that point).
 */
export default function ProductCard({ product }: { product: ProductCardType }) {
  const priceLabel =
    product.min_price_paise === product.max_price_paise
      ? formatPaise(product.min_price_paise)
      : `${formatPaise(product.min_price_paise)} – ${formatPaise(product.max_price_paise)}`;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-gray-100">
        {product.primary_image_url ? (
          <img
            src={product.primary_image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
            No image
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs uppercase tracking-wide text-gray-400">{product.brand}</p>
        <h3 className="mt-1 truncate text-sm font-medium text-gray-900">{product.name}</h3>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">{priceLabel}</span>
          {!product.in_stock && (
            <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
              Out of stock
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
