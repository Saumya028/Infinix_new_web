"""
Every route in this file requires Depends(require_admin) — proven working
in Step 3. A customer or delivery partner token gets 403 on all of these.
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.catalog import Category, Product, ProductImage, ProductVariant
from app.models.commerce import InventoryBatch
from app.models.user import User
from app.schemas.catalog import (
    AdminProductDetailOut, CategoryCreate, CategoryOut, CategoryUpdate,
    InventoryBatchCreate, InventoryBatchOut, ProductCreate, ProductImageCreate,
    ProductImageOut, ProductUpdate, ProductVariantCreate, ProductVariantOut,
    ProductVariantUpdate,
)
from app.services.image_processing import BREAKPOINTS, InvalidImageError, process_image
from app.services.storage import delete_object, public_url, upload_bytes

router = APIRouter(dependencies=[Depends(require_admin)])
# Passing the dependency at the ROUTER level (not on every single function)
# means every route defined below automatically requires an admin — you
# can't forget to protect a new endpoint you add later in this file.


def _commit_or_400(db: Session, error_detail: str = "This operation violates a data constraint"):
    """
    Wraps db.commit() so a database-level constraint violation (foreign
    key pointing at a non-existent row, unique constraint clash, etc.)
    becomes a clean 400 response instead of an uncaught 500 crash.

    Why catch this here instead of preventing every possible bad value in
    Python first? Because the database is the ultimate source of truth for
    data integrity (see schema.sql) — we WANT invalid references rejected
    even if application code has a bug that lets one slip through. This
    just makes the rejection user-friendly instead of a raw stack trace.
    """
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()  # required: the session is unusable until rolled back after a failed commit
        raise HTTPException(status_code=400, detail=error_detail) from e


# ---------- Categories ----------

@router.get("/categories", response_model=list[CategoryOut])
def list_all_categories_for_admin(db: Session = Depends(get_db)):
    """
    Admin-only category listing (unlike the public GET /categories, this
    includes inactive ones too) — used to populate the category dropdown
    when creating/editing a product. Without this, there was previously no
    way for the admin UI to know which category ids exist at all.
    """
    return db.query(Category).order_by(Category.display_order).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    if db.query(Category).filter(Category.slug == payload.slug).first():
        raise HTTPException(status_code=400, detail="A category with this slug already exists")
    category = Category(**payload.model_dump())
    db.add(category)
    _commit_or_400(db, "Invalid parent_id — no category exists with that id")
    db.refresh(category)
    return category


@router.patch("/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    # exclude_unset: only fields the admin actually sent get applied — a
    # PATCH with just {"name": "New Name"} won't null out every other field.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    _commit_or_400(db, "Invalid parent_id — no category exists with that id")
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    if db.query(Product).filter(Product.category_id == category_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete a category that still has products")
    db.delete(category)
    db.commit()


# ---------- Products ----------

@router.get("/products", response_model=list[dict])
def list_all_products_for_admin(db: Session = Depends(get_db)):
    """
    Admin-only listing that (unlike the public GET /products in
    routers/products.py) shows EVERY product including soft-deleted
    (is_active=False) ones, with no pagination/filtering — this is a
    lookup/management tool, not a storefront. Exists specifically so you
    don't have to open Supabase's table editor just to find a product's id.
    """
    products = db.query(Product).order_by(Product.id).all()
    return [
        {"id": p.id, "name": p.name, "slug": p.slug, "category_id": p.category_id, "is_active": p.is_active}
        for p in products
    ]


@router.get("/products/{product_id}", response_model=AdminProductDetailOut)
def get_product_for_admin(product_id: int, db: Session = Depends(get_db)):
    """
    Full detail for the admin edit screen — unlike the public GET
    /products/{slug}, this does NOT filter out inactive variants/images,
    and works by numeric id (which is what the admin product list links
    use) rather than slug.
    """
    from sqlalchemy import func

    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    stock_subq = (
        db.query(
            InventoryBatch.variant_id.label("variant_id"),
            func.sum(InventoryBatch.quantity).label("stock"),
        )
        .group_by(InventoryBatch.variant_id)
        .subquery()
    )
    variant_rows = (
        db.query(ProductVariant, func.coalesce(stock_subq.c.stock, 0).label("stock"))
        .outerjoin(stock_subq, stock_subq.c.variant_id == ProductVariant.id)
        .filter(ProductVariant.product_id == product.id)  # no is_active filter — admin sees everything
        .order_by(ProductVariant.id)
        .all()
    )
    variants = [
        ProductVariantOut(
            id=v.id, sku=v.sku, variant_name=v.variant_name, attributes=v.attributes,
            price_paise=v.price_paise, compare_at_paise=v.compare_at_paise,
            weight_grams=v.weight_grams, is_active=v.is_active, stock_quantity=stock,
        )
        for v, stock in variant_rows
    ]

    image_rows = (
        db.query(ProductImage)
        .filter(ProductImage.product_id == product.id)
        .order_by(ProductImage.display_order)
        .all()
    )
    images = [
        ProductImageOut(
            id=img.id, variant_id=img.variant_id,
            image_url=public_url(img.storage_path) if img.width is not None else img.storage_path,
            is_processed=img.width is not None,
            width=img.width, height=img.height, blur_data_url=img.blur_data_url,
            alt_text=img.alt_text, display_order=img.display_order, is_primary=img.is_primary,
        )
        for img in image_rows
    ]

    return AdminProductDetailOut(
        id=product.id, name=product.name, slug=product.slug, description=product.description,
        brand=product.brand, category_id=product.category_id, is_active=product.is_active,
        variants=variants, images=images,
    )


@router.post("/products", response_model=dict, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    if not db.query(Category).filter(Category.id == payload.category_id).first():
        raise HTTPException(status_code=400, detail="category_id does not exist")
    if db.query(Product).filter(Product.slug == payload.slug).first():
        raise HTTPException(status_code=400, detail="A product with this slug already exists")
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"id": product.id, "slug": product.slug, "message": "Product created. Add at least one variant next."}


@router.patch("/products/{product_id}", response_model=dict)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    return {"id": product.id, "message": "Product updated"}


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """
    Soft delete, not a real DELETE FROM — matches the schema comment in
    schema.sql: products may be referenced by historical order_items, so
    hard-deleting would corrupt past orders' data integrity (or force us to
    ON DELETE CASCADE orders away, which is much worse). is_active=False
    just hides it from the public /products listing (see products.py,
    which always filters Product.is_active.is_(True)).
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()


# ---------- Variants ----------

@router.post("/products/{product_id}/variants", response_model=ProductVariantOut, status_code=201)
def create_variant(product_id: int, payload: ProductVariantCreate, db: Session = Depends(get_db)):
    if not db.query(Product).filter(Product.id == product_id).first():
        raise HTTPException(status_code=404, detail="Product not found")
    if db.query(ProductVariant).filter(ProductVariant.sku == payload.sku).first():
        raise HTTPException(status_code=400, detail="A variant with this SKU already exists")

    variant = ProductVariant(product_id=product_id, **payload.model_dump())
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return ProductVariantOut(
        id=variant.id, sku=variant.sku, variant_name=variant.variant_name,
        attributes=variant.attributes, price_paise=variant.price_paise,
        compare_at_paise=variant.compare_at_paise, weight_grams=variant.weight_grams,
        is_active=variant.is_active, stock_quantity=0,  # brand new variant, no batches yet
    )


@router.patch("/variants/{variant_id}", response_model=dict)
def update_variant(variant_id: int, payload: ProductVariantUpdate, db: Session = Depends(get_db)):
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant_id).first()
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(variant, field, value)
    db.commit()
    return {"id": variant.id, "message": "Variant updated"}


# ---------- Inventory ----------

@router.get("/variants/{variant_id}/inventory", response_model=list[InventoryBatchOut])
def list_inventory_batches(variant_id: int, db: Session = Depends(get_db)):
    """Shows every batch for a variant, most recently added first — this is
    what actually answers 'why does this show 0 stock?': either this list
    is empty (nothing was ever added) or every batch's quantity is 0
    (everything sold, or was manually zeroed)."""
    if not db.query(ProductVariant).filter(ProductVariant.id == variant_id).first():
        raise HTTPException(status_code=404, detail="Variant not found")

    batches = (
        db.query(InventoryBatch)
        .filter(InventoryBatch.variant_id == variant_id)
        .order_by(InventoryBatch.id.desc())
        .all()
    )
    return [
        InventoryBatchOut(
            id=b.id, batch_code=b.batch_code, quantity=b.quantity,
            manufactured_on=b.manufactured_on.isoformat() if b.manufactured_on else None,
            expires_on=b.expires_on.isoformat() if b.expires_on else None,
            warehouse_code=b.warehouse_code,
        )
        for b in batches
    ]


@router.post("/variants/{variant_id}/inventory", status_code=201)
def add_inventory_batch(variant_id: int, payload: InventoryBatchCreate, db: Session = Depends(get_db)):
    """
    Adds STOCK, never overwrites it — this is intentionally additive
    (a new delivery from the warehouse is a new batch row), which is what
    makes FEFO/expiry tracking possible later. There is deliberately no
    'set stock to X' endpoint — that would destroy batch/expiry history.
    """
    if not db.query(ProductVariant).filter(ProductVariant.id == variant_id).first():
        raise HTTPException(status_code=404, detail="Variant not found")

    batch = InventoryBatch(
        variant_id=variant_id,
        batch_code=payload.batch_code,
        quantity=payload.quantity,
        manufactured_on=date.fromisoformat(payload.manufactured_on) if payload.manufactured_on else None,
        expires_on=date.fromisoformat(payload.expires_on) if payload.expires_on else None,
        warehouse_code=payload.warehouse_code,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return {"id": batch.id, "message": f"Added {payload.quantity} units to stock"}


# ---------- Images ----------

@router.post("/products/{product_id}/upload-image", response_model=ProductImageOut, status_code=201)
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    variant_id: int | None = Form(default=None),
    alt_text: str = Form(default=""),
    is_primary: bool = Form(default=False),
    db: Session = Depends(get_db),
):
    """
    THE core route for Step 6. Accepts a real image file (multipart/
    form-data, not JSON — files can't go in a JSON body), runs it through
    our resize/WebP/blur pipeline, uploads every generated size to Supabase
    Storage, and saves one ProductImage row referencing all of them via a
    shared key prefix.

    Why multipart form fields (Form(...)) instead of a JSON body for the
    non-file fields: an HTTP request can only have ONE body, and a file
    upload's body IS the multipart form — so variant_id/alt_text/is_primary
    have to ride along as form fields, not JSON, in the same request.
    """
    if not db.query(Product).filter(Product.id == product_id).first():
        raise HTTPException(status_code=404, detail="Product not found")

    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP files are accepted")

    raw_bytes = await file.read()

    try:
        result = process_image(raw_bytes)
    except InvalidImageError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # A random key prefix (not the filename!) avoids two problems: filename
    # collisions between different admins uploading "photo.jpg", and
    # anyone guessing/enumerating other products' image URLs.
    key_prefix = f"products/{product_id}/{uuid.uuid4().hex}"
    for width, webp_bytes in result["variants"].items():
        upload_bytes(f"{key_prefix}-{width}.webp", webp_bytes, "image/webp")

    # A product's FIRST image is always primary, regardless of the
    # checkbox the admin ticked (or forgot to tick). A product with images
    # but none flagged primary is a broken state — the shop listing page
    # (GET /products) looks up the primary image directly with no
    # fallback, so it would silently show "No image" even though a
    # perfectly good photo exists (only the product detail page has a
    # fallback to "any image"). Forcing this here means that inconsistency
    # can never occur for a newly-uploaded first image again.
    is_first_image = not db.query(ProductImage).filter(ProductImage.product_id == product_id).first()
    is_primary = is_primary or is_first_image

    if is_primary:
        db.query(ProductImage).filter(
            ProductImage.product_id == product_id, ProductImage.is_primary.is_(True)
        ).update({"is_primary": False})

    image = ProductImage(
        product_id=product_id,
        variant_id=variant_id,
        storage_path=key_prefix,  # a KEY PREFIX, not a full URL — see model comment
        alt_text=alt_text,
        is_primary=is_primary,
        width=result["width"],
        height=result["height"],
        blur_data_url=result["blur_data_url"],
    )
    db.add(image)
    _commit_or_400(db, "Invalid variant_id for this product")
    db.refresh(image)

    return ProductImageOut(
        id=image.id, variant_id=image.variant_id,
        image_url=public_url(image.storage_path), is_processed=True,
        width=image.width, height=image.height, blur_data_url=image.blur_data_url,
        alt_text=image.alt_text, display_order=image.display_order, is_primary=image.is_primary,
    )


@router.post("/products/{product_id}/images", response_model=ProductImageOut, status_code=201)
def add_product_image_by_url(product_id: int, payload: ProductImageCreate, db: Session = Depends(get_db)):
    """
    LEGACY / convenience route from Step 4 — paste any existing image URL
    directly (e.g. a placeholder, or a URL you uploaded some other way).
    Kept intentionally: useful for quick testing without a real file on
    hand. Real product photography should go through the /upload-image
    route above so it gets resized/optimized — this route stores the URL
    exactly as given, unprocessed.
    """
    if not db.query(Product).filter(Product.id == product_id).first():
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.is_primary:
        db.query(ProductImage).filter(
            ProductImage.product_id == product_id, ProductImage.is_primary.is_(True)
        ).update({"is_primary": False})

    image = ProductImage(product_id=product_id, **payload.model_dump())
    db.add(image)
    _commit_or_400(db, "Invalid variant_id for this product")
    db.refresh(image)
    return ProductImageOut(
        id=image.id, variant_id=image.variant_id, image_url=image.storage_path, is_processed=False,
        width=None, height=None, blur_data_url=None,
        alt_text=image.alt_text, display_order=image.display_order, is_primary=image.is_primary,
    )


@router.delete("/images/{image_id}", status_code=204)
def delete_product_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(ProductImage).filter(ProductImage.id == image_id).first()
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")

    if image.width is not None:
        # Processed image: also delete the actual files from storage, not
        # just the DB row — otherwise orphaned objects accumulate in the
        # bucket forever with no reference pointing at them.
        for w in BREAKPOINTS:
            delete_object(f"{image.storage_path}-{w}.webp")

    db.delete(image)
    db.commit()
