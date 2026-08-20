import { notFound } from "next/navigation";
import Image from "next/image";
import { getProductBySlug } from "@/lib/api";
import { toThumbnailUrl } from "@/lib/imageUrl";
import VariantSelector from "@/components/VariantSelector";

export const dynamic = "force-dynamic"; // see app/page.tsx for why

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product;
  try {
    product = await getProductBySlug(slug);
  } catch {
    // A 404 from the backend (product not found / inactive) should render
    // Next.js's built-in not-found page, not crash with an unhandled error.
    notFound();
  }

  const primaryImage = product.images.find((img) => img.is_primary) ?? product.images[0];

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
        {primaryImage && primaryImage.is_processed ? (
          <Image
            src={primaryImage.image_url}
            alt={primaryImage.alt_text || product.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            placeholder={primaryImage.blur_data_url ? "blur" : "empty"}
            blurDataURL={primaryImage.blur_data_url ?? undefined}
            // priority: this is the single largest, most prominent image on
            // the page (the PDP hero shot) — loading it eagerly instead of
            // lazily is correct here, unlike grid thumbnails which SHOULD
            // lazy-load. Also skips the blur-up transition on first paint,
            // which is the right call for an above-the-fold hero image.
            priority
          />
        ) : primaryImage ? (
          <img
            src={primaryImage.image_url}
            alt={primaryImage.alt_text || product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">No image</div>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">{product.brand}</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{product.name}</h1>
        {product.description && (
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{product.description}</p>
        )}

        <div className="mt-6">
          <VariantSelector
            variants={product.variants}
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              // Cart items (both the guest localStorage cart and the
              // logged-in server cart — see backend/app/routers/cart.py)
              // are rendered with a plain <img>, not next/image, so this
              // needs to already be a complete, directly-loadable URL —
              // not the bare base key primaryImage.image_url normally is.
              image_url: primaryImage
                ? toThumbnailUrl(primaryImage.image_url, primaryImage.is_processed)
                : null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
