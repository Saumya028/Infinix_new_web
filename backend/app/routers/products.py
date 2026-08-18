"""
Public, unauthenticated catalog routes — anyone can call these (customers
browsing, or even search engine crawlers hitting Next.js pages that call
this API server-side for SSR).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.catalog import Category, Product, ProductImage, ProductVariant
from app.models.commerce import InventoryBatch
from app.schemas.catalog import (
    CategoryOut, ProductCardOut, ProductDetailOut, ProductListOut,
    ProductImageOut, ProductVariantOut,
)

router = APIRouter()


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return (
        db.query(Category)
        .filter(Category.is_active.is_(True))
        .order_by(Category.display_order)
        .all()
    )


def _stock_subquery(db: Session):
    """One row per variant_id -> total stock across all its batches.
    Built once, reused by both listing and detail queries below."""
    return (
        db.query(
            InventoryBatch.variant_id.label("variant_id"),
            func.sum(InventoryBatch.quantity).label("stock"),
        )
        .group_by(InventoryBatch.variant_id)
        .subquery()
    )


@router.get("/products", response_model=ProductListOut)
def list_products(
    db: Session = Depends(get_db),
    category: str | None = Query(default=None, description="Category slug"),
    brand: str | None = Query(default=None),
    min_price: float | None = Query(default=None, ge=0, description="Rupees"),
    max_price: float | None = Query(default=None, ge=0, description="Rupees"),
    in_stock: bool | None = Query(default=None),
    search: str | None = Query(default=None, description="Search in product name"),
    sort: str = Query(default="newest", pattern="^(newest|price_asc|price_desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
):
    """
    The core listing query. Design note on the two-step aggregation below:
    a product has MULTIPLE variants, each with its own price and stock, but
    a product listing card shows ONE price range and ONE stock flag. So we
    first aggregate at the variant level per product (min/max price, total
    stock across variants), THEN filter/sort products using those aggregates.
    Doing this as a single flat query would either miscount (if you filter
    variants before aggregating, you can undercount stock) or require the
    subquery approach we use here — this is the standard pattern for
    "list parent rows, aggregated over their children" queries.
    """
    stock_subq = _stock_subquery(db)

    variant_agg_q = (
        db.query(
            ProductVariant.product_id.label("product_id"),
            func.min(ProductVariant.price_paise).label("min_price"),
            func.max(ProductVariant.price_paise).label("max_price"),
            func.coalesce(func.sum(stock_subq.c.stock), 0).label("total_stock"),
        )
        .outerjoin(stock_subq, stock_subq.c.variant_id == ProductVariant.id)
        .filter(ProductVariant.is_active.is_(True))
    )
    if min_price is not None:
        variant_agg_q = variant_agg_q.filter(ProductVariant.price_paise >= int(min_price * 100))
    if max_price is not None:
        variant_agg_q = variant_agg_q.filter(ProductVariant.price_paise <= int(max_price * 100))
    variant_agg = variant_agg_q.group_by(ProductVariant.product_id).subquery()

    query = (
        db.query(Product, variant_agg.c.min_price, variant_agg.c.max_price, variant_agg.c.total_stock)
        # INNER join to variant_agg: a product with zero variants matching
        # the price filter (or zero variants at all) correctly disappears
        # from listings instead of showing a broken "no price" card.
        .join(variant_agg, variant_agg.c.product_id == Product.id)
        .filter(Product.is_active.is_(True))
    )
    if category:
        query = query.join(Category, Category.id == Product.category_id).filter(Category.slug == category)
    if brand:
        query = query.filter(Product.brand == brand)
    if in_stock is True:
        query = query.filter(variant_agg.c.total_stock > 0)
    if in_stock is False:
        query = query.filter(variant_agg.c.total_stock <= 0)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    total_items = query.count()
    total_pages = max(1, (total_items + page_size - 1) // page_size)

    if sort == "price_asc":
        query = query.order_by(variant_agg.c.min_price.asc())
    elif sort == "price_desc":
        query = query.order_by(variant_agg.c.max_price.desc())
    else:
        query = query.order_by(Product.created_at.desc())

    rows = query.offset((page - 1) * page_size).limit(page_size).all()

    # Batch-fetch primary images for exactly the products on this page
    # (one extra query total, NOT one query per product — avoiding the
    # classic "N+1 query" performance bug).
    product_ids = [p.id for p, _, _, _ in rows]
    primary_images: dict[int, str] = {}
    if product_ids:
        img_rows = (
            db.query(ProductImage.product_id, ProductImage.storage_path)
            .filter(ProductImage.product_id.in_(product_ids), ProductImage.is_primary.is_(True))
            .all()
        )
        primary_images = {pid: path for pid, path in img_rows}

    items = [
        ProductCardOut(
            id=p.id,
            name=p.name,
            slug=p.slug,
            brand=p.brand,
            category_id=p.category_id,
            primary_image_url=primary_images.get(p.id),
            min_price_paise=min_price_paise,
            max_price_paise=max_price_paise,
            in_stock=total_stock > 0,
        )
        for p, min_price_paise, max_price_paise, total_stock in rows
    ]

    return ProductListOut(items=items, page=page, page_size=page_size, total_items=total_items, total_pages=total_pages)


@router.get("/products/{slug}", response_model=ProductDetailOut)
def get_product_detail(slug: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.slug == slug, Product.is_active.is_(True)).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    stock_subq = _stock_subquery(db)
    variant_rows = (
        db.query(ProductVariant, func.coalesce(stock_subq.c.stock, 0).label("stock"))
        .outerjoin(stock_subq, stock_subq.c.variant_id == ProductVariant.id)
        .filter(ProductVariant.product_id == product.id, ProductVariant.is_active.is_(True))
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
            id=img.id, variant_id=img.variant_id, image_url=img.storage_path,
            alt_text=img.alt_text, display_order=img.display_order, is_primary=img.is_primary,
        )
        for img in image_rows
    ]

    return ProductDetailOut(
        id=product.id, name=product.name, slug=product.slug, description=product.description,
        brand=product.brand, category_id=product.category_id, variants=variants, images=images,
    )
