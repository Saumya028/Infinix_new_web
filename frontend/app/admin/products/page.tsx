"use client";

/**
 * The missing piece: until now, the only way to create a product, add a
 * variant, or add stock was to call the backend API directly (curl/Postman)
 * — there was no admin UI for it at all, which is exactly the "I don't see
 * anything in the database" problem. This page is the whole product +
 * inventory management surface: create categories/products/variants,
 * upload images, and add stock batches, all from the browser.
 *
 * One deliberate design choice carried over from the backend (see
 * backend/app/routers/admin_catalog.py's add_inventory_batch docstring):
 * there is NO "set stock to X" control here, only "add N units as a new
 * batch". Stock is the sum of every batch ever added minus what's sold —
 * letting the UI overwrite that number directly would destroy the
 * batch/expiry history FEFO relies on (see backend/app/services/orders.py).
 * If stock is wrong, the fix is a correcting batch (positive or you simply
 * stop adding more), not an edit box.
 */
import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { useRequireRole } from "@/lib/useRequireRole";
import { clientFetch, clientUpload, ApiError } from "@/lib/clientApi";
import { toThumbnailUrl } from "@/lib/imageUrl";
import { formatPaise } from "@/lib/format";
import type {
  Category, AdminProductListItem, AdminProductDetail, InventoryBatch,
} from "@/lib/types";

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminProductsPage() {
  // Matches the backend: admin_catalog.py's router uses require_admin only
  // (not require_staff), so ops/support accounts would get 403 on every
  // call here even if we let them see the page — scoping this to admin
  // avoids showing a page that's broken for anyone but an admin.
  const { isAuthorized, isLoading: authLoading } = useRequireRole(["admin"]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminProductDetail | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (!isAuthorized) return;
    refreshLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      return;
    }
    clientFetch<AdminProductDetail>(`/admin/products/${selectedId}`).then(setDetail);
  }, [selectedId]);

  function refreshLists() {
    clientFetch<Category[]>("/admin/categories").then(setCategories);
    clientFetch<AdminProductListItem[]>("/admin/products").then(setProducts);
  }

  function refreshDetail() {
    if (selectedId !== null) {
      clientFetch<AdminProductDetail>(`/admin/products/${selectedId}`).then(setDetail);
    }
  }

  function showError(err: unknown, fallback: string) {
    setMessage({ type: "error", text: err instanceof ApiError ? err.message : fallback });
  }

  if (authLoading || !isAuthorized) {
    return <p className="py-12 text-center text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
      <AdminNav />

      {message && (
        <div
          className={`mb-4 rounded px-4 py-2 text-sm ${
            message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <CategorySection
            categories={categories}
            onCreated={() => {
              refreshLists();
              setMessage({ type: "success", text: "Category created." });
            }}
            onError={(e) => showError(e, "Couldn't create category.")}
          />
          <ProductListSection
            products={products}
            categories={categories}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreated={(newId) => {
              refreshLists();
              setSelectedId(newId);
              setMessage({ type: "success", text: "Product created — add a variant to make it purchasable." });
            }}
            onError={(e) => showError(e, "Couldn't create product.")}
          />
        </div>

        <div>
          {detail ? (
            <ProductDetailPanel
              product={detail}
              onChanged={() => {
                refreshDetail();
                refreshLists();
              }}
              onMessage={(text, type = "success") => setMessage({ type, text })}
              onError={(e, fallback) => showError(e, fallback)}
            />
          ) : (
            <p className="text-sm text-gray-500">Select a product on the left, or create a new one.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Category creation ----------

function CategorySection({
  categories, onCreated, onError,
}: {
  categories: Category[];
  onCreated: () => void;
  onError: (err: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await clientFetch("/admin/categories", {
        method: "POST",
        body: { name, slug: slugify(name) },
      });
      setName("");
      setOpen(false);
      onCreated();
    } catch (err) {
      onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
        <button onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-brand hover:underline">
          {open ? "Cancel" : "+ New"}
        </button>
      </div>

      <ul className="mt-2 space-y-0.5 text-sm text-gray-600">
        {categories.length === 0 && <li className="text-gray-400">No categories yet.</li>}
        {categories.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            required
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}

// ---------- Product list + create ----------

function ProductListSection({
  products, categories, selectedId, onSelect, onCreated, onError,
}: {
  products: AdminProductListItem[];
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreated: (id: number) => void;
  onError: (err: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (categoryId === "") return;
    setSubmitting(true);
    try {
      const res = await clientFetch<{ id: number }>("/admin/products", {
        method: "POST",
        body: { name, slug: slugify(name), category_id: categoryId },
      });
      setName("");
      setOpen(false);
      onCreated(res.id);
    } catch (err) {
      onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Products</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={categories.length === 0}
          className="text-xs font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          title={categories.length === 0 ? "Create a category first" : undefined}
        >
          {open ? "Cancel" : "+ New"}
        </button>
      </div>

      <ul className="mt-2 max-h-[60vh] space-y-0.5 overflow-y-auto text-sm">
        {products.length === 0 && <li className="text-gray-400">No products yet.</li>}
        {products.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p.id)}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition ${
                selectedId === p.id ? "bg-brand/10 text-brand" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{p.name}</span>
              {!p.is_active && <span className="text-xs text-gray-400">hidden</span>}
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product name"
            required
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            required
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Choose a category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Create product
          </button>
        </form>
      )}
    </div>
  );
}

// ---------- Product detail: variants, images, inventory ----------

function ProductDetailPanel({
  product, onChanged, onMessage, onError,
}: {
  product: AdminProductDetail;
  onChanged: () => void;
  onMessage: (text: string, type?: "success" | "error") => void;
  onError: (err: unknown, fallback: string) => void;
}) {
  async function toggleActive() {
    try {
      await clientFetch(`/admin/products/${product.id}`, {
        method: "PATCH",
        body: { is_active: !product.is_active },
      });
      onChanged();
      onMessage(product.is_active ? "Product hidden from the storefront." : "Product is now visible.");
    } catch (err) {
      onError(err, "Couldn't update this product.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
          <p className="text-sm text-gray-500">/{product.slug}</p>
        </div>
        <button
          onClick={toggleActive}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            product.is_active
              ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
              : "bg-brand text-white hover:bg-brand-dark"
          }`}
        >
          {product.is_active ? "Hide from storefront" : "Show on storefront"}
        </button>
      </div>

      <ImagesSection product={product} onChanged={onChanged} onError={onError} />
      <VariantsSection product={product} onChanged={onChanged} onMessage={onMessage} onError={onError} />
    </div>
  );
}

function ImagesSection({
  product, onChanged, onError,
}: {
  product: AdminProductDetail;
  onChanged: () => void;
  onError: (err: unknown, fallback: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isPrimary, setIsPrimary] = useState(product.images.length === 0);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("is_primary", String(isPrimary));
      await clientUpload(`/admin/products/${product.id}/upload-image`, formData);
      setFile(null);
      onChanged();
    } catch (err) {
      onError(err, "Couldn't upload this image. Use a JPEG, PNG, or WebP file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900">Images</h3>

      <div className="mt-3 flex flex-wrap gap-3">
        {product.images.map((img) => (
          // eslint-disable-next-line @next/next/no-img-element -- admin
          // tool thumbnail, not the storefront; the Next.js image pipeline
          // is what customer-facing pages use (see frontend/lib/imageLoader.ts).
          <img
            key={img.id}
            src={toThumbnailUrl(img.image_url, img.is_processed)}
            alt={img.alt_text}
            className={`h-20 w-20 rounded border object-cover ${img.is_primary ? "border-brand" : "border-gray-200"}`}
            title={img.is_primary ? "Primary image" : undefined}
          />
        ))}
        {product.images.length === 0 && <p className="text-sm text-gray-400">No images yet.</p>}
      </div>

      <form onSubmit={handleUpload} className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Set as primary
        </label>
        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>
    </div>
  );
}

function VariantsSection({
  product, onChanged, onMessage, onError,
}: {
  product: AdminProductDetail;
  onChanged: () => void;
  onMessage: (text: string) => void;
  onError: (err: unknown, fallback: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Variants & Stock</h3>
        <button onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-brand hover:underline">
          {open ? "Cancel" : "+ New variant"}
        </button>
      </div>

      {open && (
        <NewVariantForm
          productId={product.id}
          onCreated={() => {
            setOpen(false);
            onChanged();
            onMessage("Variant created. Add stock below to make it orderable.");
          }}
          onError={(err) => onError(err, "Couldn't create this variant — is the SKU already in use?")}
        />
      )}

      <div className="mt-4 space-y-3">
        {product.variants.length === 0 && (
          <p className="text-sm text-gray-400">No variants yet — a product needs at least one before it can be sold.</p>
        )}
        {product.variants.map((v) => (
          <VariantRow key={v.id} variant={v} onChanged={onChanged} onError={onError} />
        ))}
      </div>
    </div>
  );
}

function NewVariantForm({
  productId, onCreated, onError,
}: {
  productId: number;
  onCreated: () => void;
  onError: (err: unknown) => void;
}) {
  const [sku, setSku] = useState("");
  const [variantName, setVariantName] = useState("");
  const [priceRupees, setPriceRupees] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await clientFetch(`/admin/products/${productId}/variants`, {
        method: "POST",
        body: {
          sku,
          variant_name: variantName,
          price_paise: Math.round(parseFloat(priceRupees) * 100),
        },
      });
      onCreated();
    } catch (err) {
      onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-2 gap-2 rounded bg-gray-50 p-3">
      <input
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        placeholder="SKU (e.g. OB-150)"
        required
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
      <input
        value={variantName}
        onChange={(e) => setVariantName(e.target.value)}
        placeholder="Variant name (e.g. 150ml)"
        required
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
      <input
        value={priceRupees}
        onChange={(e) => setPriceRupees(e.target.value)}
        placeholder="Price (₹)"
        type="number"
        step="0.01"
        min="0"
        required
        className="rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Add variant
      </button>
    </form>
  );
}

function VariantRow({
  variant, onChanged, onError,
}: {
  variant: AdminProductDetail["variants"][number];
  onChanged: () => void;
  onError: (err: unknown, fallback: string) => void;
}) {
  const [showBatches, setShowBatches] = useState(false);
  const [batches, setBatches] = useState<InventoryBatch[] | null>(null);
  const [addingStock, setAddingStock] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadBatches() {
    const data = await clientFetch<InventoryBatch[]>(`/admin/variants/${variant.id}/inventory`);
    setBatches(data);
  }

  async function toggleBatches() {
    const next = !showBatches;
    setShowBatches(next);
    if (next && batches === null) await loadBatches();
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await clientFetch(`/admin/variants/${variant.id}/inventory`, {
        method: "POST",
        body: {
          batch_code: batchCode || `BATCH-${Date.now()}`,
          quantity: parseInt(quantity, 10),
          expires_on: expiresOn || null,
        },
      });
      setQuantity("");
      setBatchCode("");
      setExpiresOn("");
      setAddingStock(false);
      setBatches(null);
      if (showBatches) await loadBatches();
      onChanged();
    } catch (err) {
      onError(err, "Couldn't add stock — check the quantity is a whole number.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {variant.variant_name} <span className="text-gray-400">· {variant.sku}</span>
          </p>
          <p className="text-sm text-gray-600">{formatPaise(variant.price_paise)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              variant.stock_quantity > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {variant.stock_quantity > 0 ? `${variant.stock_quantity} in stock` : "Out of stock"}
          </span>
          <button onClick={toggleBatches} className="text-xs font-medium text-brand hover:underline">
            {showBatches ? "Hide batches" : "View batches"}
          </button>
          <button
            onClick={() => setAddingStock((v) => !v)}
            className="rounded border border-brand px-2 py-1 text-xs font-medium text-brand hover:bg-brand/5"
          >
            + Add stock
          </button>
        </div>
      </div>

      {showBatches && (
        <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
          {batches === null ? (
            "Loading..."
          ) : batches.length === 0 ? (
            "No stock has ever been added for this variant — that's why it shows out of stock."
          ) : (
            <ul className="space-y-0.5">
              {batches.map((b) => (
                <li key={b.id}>
                  {b.batch_code}: {b.quantity} units
                  {b.expires_on && ` · expires ${b.expires_on}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {addingStock && (
        <form onSubmit={handleAddStock} className="mt-3 grid grid-cols-3 gap-2 rounded bg-gray-50 p-3">
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantity"
            type="number"
            min="1"
            required
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            value={batchCode}
            onChange={(e) => setBatchCode(e.target.value)}
            placeholder="Batch code (optional)"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            type="date"
            title="Expiry date (optional)"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="col-span-3 rounded bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add to stock"}
          </button>
        </form>
      )}
    </div>
  );
}
