"""
Every route in this file requires Depends(require_admin) — proven working
in Step 3. A customer or delivery partner token gets 403 on all of these.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.catalog import Category, Product, ProductImage, ProductVariant
from app.models.commerce import InventoryBatch
from app.models.user import User
from app.schemas.catalog import (
    CategoryCreate, CategoryOut, CategoryUpdate,
    InventoryBatchCreate, ProductCreate, ProductImageCreate, ProductImageOut,
    ProductUpdate, ProductVariantCreate, ProductVariantOut, ProductVariantUpdate,
)

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


# ---------- Images (placeholder storage — real upload pipeline in Step 6) ----------

@router.post("/products/{product_id}/images", response_model=ProductImageOut, status_code=201)
def add_product_image(product_id: int, payload: ProductImageCreate, db: Session = Depends(get_db)):
    """
    For now, `storage_path` is just any image URL you paste in (e.g. a
    placeholder from placehold.co, or a manually-uploaded Supabase Storage
    link). Step 6 replaces manual URL entry with a real upload endpoint +
    CDN transform pipeline — this schema/field won't need to change, only
    how storage_path gets populated.
    """
    if not db.query(Product).filter(Product.id == product_id).first():
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.is_primary:
        # Only one primary image per product — unset any existing one first.
        db.query(ProductImage).filter(
            ProductImage.product_id == product_id, ProductImage.is_primary.is_(True)
        ).update({"is_primary": False})

    image = ProductImage(product_id=product_id, **payload.model_dump())
    db.add(image)
    db.commit()
    db.refresh(image)
    return ProductImageOut(
        id=image.id, variant_id=image.variant_id, image_url=image.storage_path,
        alt_text=image.alt_text, display_order=image.display_order, is_primary=image.is_primary,
    )


@router.delete("/images/{image_id}", status_code=204)
def delete_product_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(ProductImage).filter(ProductImage.id == image_id).first()
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    db.delete(image)
    db.commit()