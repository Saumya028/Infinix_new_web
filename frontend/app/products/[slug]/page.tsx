import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/api";
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
      <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
        {primaryImage ? (
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
          <VariantSelector variants={product.variants} />
        </div>
      </div>
    </div>
  );
}
