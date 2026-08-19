import Link from "next/link";
import Image from "next/image";
import type { ProductCard as ProductCardType } from "@/lib/types";
import { formatPaise } from "@/lib/format";

/**
 * THIS is the file that actually fixes the slow-image problem you started
 * this whole project to solve. Compare to how this looked before Step 6:
 *   - Processed images (uploaded via the pipeline) now use next/image,
 *     which automatically: generates a `srcset` so mobile devices download
 *     the 200px variant instead of the 1200px one, lazy-loads anything
 *     below the fold, and shows the tiny blurred LQIP instantly instead of
 *     a blank box while the real image loads in.
 *   - Legacy manually-pasted URLs (no processed variants exist for them)
 *     still fall back to a plain <img> — there's nothing to optimize
 *     without real generated sizes behind them.
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
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        {product.primary_image_url && product.primary_image_is_processed ? (
          <Image
            src={product.primary_image_url}
            alt={product.name}
            fill
            // Tells the browser roughly how big this image will actually
            // render at different viewport widths, so it picks the right
            // candidate from the srcset instead of guessing. Matches the
            // grid's responsive column counts (see app/products/page.tsx:
            // 2 cols on mobile, 3 on sm, 4 on md+).
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            className="object-cover transition group-hover:scale-105"
            placeholder={product.primary_image_blur ? "blur" : "empty"}
            blurDataURL={product.primary_image_blur ?? undefined}
          />
        ) : product.primary_image_url ? (
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
