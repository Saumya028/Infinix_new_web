"""
Two kinds of schemas here, matching two different jobs:
  - *Out  schemas: shape of data we SEND to any client (public or admin)
  - *In / *Create / *Update schemas: shape of data admin routes ACCEPT

Notice none of the create/update schemas let the caller set `id`,
`created_at`, or computed fields — those are the server's job, never the
client's. This is a deliberate security boundary, same principle as
`role` being forced server-side during registration.
"""
from pydantic import BaseModel, Field


# ---------- Categories ----------

class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    parent_id: int | None
    image_url: str | None
    display_order: int

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    parent_id: int | None = Field(default=None, description="Leave null for a top-level category")
    image_url: str | None = None
    display_order: int = 0


class CategoryUpdate(BaseModel):
    # Every field optional: admin sends only what's changing (PATCH semantics).
    name: str | None = None
    slug: str | None = None
    parent_id: int | None = None
    image_url: str | None = None
    display_order: int | None = None
    is_active: bool | None = None


# ---------- Images ----------

class ProductImageOut(BaseModel):
    id: int
    variant_id: int | None
    # NOTE: this is the raw storage_path for now (e.g. a placeholder URL you
    # type in manually). Step 6 replaces this with real CDN-transformed URLs
    # (resized/WebP) — the field name `image_url` won't need to change on
    # the frontend when that happens, only what populates it here.
    image_url: str
    alt_text: str
    display_order: int
    is_primary: bool

    class Config:
        from_attributes = True


class ProductImageCreate(BaseModel):
    variant_id: int | None = None
    storage_path: str = Field(min_length=1)  # for now: paste any image URL
    alt_text: str = ""
    display_order: int = 0
    is_primary: bool = False


# ---------- Variants ----------

class ProductVariantOut(BaseModel):
    id: int
    sku: str
    variant_name: str
    attributes: dict
    price_paise: int
    compare_at_paise: int | None
    weight_grams: int | None
    is_active: bool
    stock_quantity: int  # computed: sum of inventory_batches, not a stored column

    class Config:
        from_attributes = True


class ProductVariantCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    variant_name: str = Field(min_length=1, max_length=200)
    attributes: dict = Field(default_factory=dict)
    price_paise: int = Field(ge=0)
    compare_at_paise: int | None = Field(default=None, ge=0)
    weight_grams: int | None = None


class ProductVariantUpdate(BaseModel):
    variant_name: str | None = None
    attributes: dict | None = None
    price_paise: int | None = Field(default=None, ge=0)
    compare_at_paise: int | None = Field(default=None, ge=0)
    weight_grams: int | None = None
    is_active: bool | None = None


class InventoryBatchCreate(BaseModel):
    batch_code: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=0)
    manufactured_on: str | None = None  # ISO date string "2026-01-15"
    expires_on: str | None = None
    warehouse_code: str = "MAIN"


# ---------- Products ----------

class ProductCardOut(BaseModel):
    """Slim shape for listing pages (GET /products) — no need to ship every
    variant's full detail when rendering a grid of product cards."""
    id: int
    name: str
    slug: str
    brand: str
    category_id: int
    primary_image_url: str | None
    min_price_paise: int
    max_price_paise: int
    in_stock: bool


class ProductListOut(BaseModel):
    items: list[ProductCardOut]
    page: int
    page_size: int
    total_items: int
    total_pages: int


class ProductDetailOut(BaseModel):
    """Full shape for a single product page (GET /products/{slug}) — includes
    every variant and image, since the PDP needs to let the user switch
    between fragrance/size options without another API call."""
    id: int
    name: str
    slug: str
    description: str | None
    brand: str
    category_id: int
    variants: list[ProductVariantOut]
    images: list[ProductImageOut]

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    category_id: int
    name: str = Field(min_length=1, max_length=300)
    slug: str = Field(min_length=1, max_length=300)
    description: str | None = None
    brand: str = "Infinix"


class ProductUpdate(BaseModel):
    category_id: int | None = None
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    brand: str | None = None
    is_active: bool | None = None
