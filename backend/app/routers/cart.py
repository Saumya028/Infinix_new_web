"""
Server-side cart for logged-in users.

Every route here depends on get_current_user, so `request.current_user`-style
manual ownership checks (which the old Flask cart_routes.py needed on every
single route) simply don't exist as a concept — a user can only ever see or
touch the one cart row that belongs to their own id, because that's the only
cart these queries ever look up.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.catalog import Product, ProductImage, ProductVariant
from app.models.commerce import Cart, CartItem, InventoryBatch
from app.models.user import User
from app.schemas.cart import CartItemAdd, CartItemOut, CartItemUpdate, CartOut
from app.services.image_processing import BREAKPOINTS
from app.services.storage import public_url

router = APIRouter()


def _get_or_create_cart(db: Session, user: User) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user.id).first()
    if cart is None:
        cart = Cart(user_id=user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def _variant_stock(db: Session, variant_id: int) -> int:
    total = (
        db.query(func.coalesce(func.sum(InventoryBatch.quantity), 0))
        .filter(InventoryBatch.variant_id == variant_id)
        .scalar()
    )
    return int(total or 0)


def _serialize_cart(db: Session, cart: Cart) -> CartOut:
    """
    Builds the full cart response with everything the UI needs to render a
    line item (name, image, current price, stock) in one pass — the
    frontend never has to make a separate /products call per cart item.
    """
    items: list[CartItemOut] = []
    subtotal = 0

    for ci in cart.items:
        variant: ProductVariant = ci.variant
        product: Product = variant.product

        image = (
            db.query(ProductImage)
            .filter(ProductImage.product_id == product.id, ProductImage.is_primary.is_(True))
            .first()
        )
        image_url = None
        if image:
            if image.width is not None:
                # public_url(storage_path) is a KEY PREFIX, not a loadable
                # file — the real objects in storage are
                # "{prefix}-200.webp", "{prefix}-600.webp", "{prefix}-1200.webp"
                # (see services/image_processing.py's BREAKPOINTS). The
                # storefront's product cards/detail page go through
                # next/image with a custom loader that appends this suffix
                # automatically (frontend/lib/imageLoader.ts) — but the
                # cart is rendered with a plain <img> tag (small, fixed-size
                # thumbnails don't need next/image's responsive srcset
                # machinery), so we have to append the suffix ourselves
                # here instead. min(BREAKPOINTS) = smallest generated size,
                # which is all a cart thumbnail ever needs.
                image_url = f"{public_url(image.storage_path)}-{min(BREAKPOINTS)}.webp"
            else:
                # Legacy manually-pasted URL (Step 4's ProductImageCreate
                # route) — storage_path IS already a complete, ready-to-use
                # URL in this case, nothing to append.
                image_url = image.storage_path

        stock = _variant_stock(db, variant.id)
        line_total = variant.price_paise * ci.quantity
        subtotal += line_total

        items.append(CartItemOut(
            id=ci.id,
            variant_id=variant.id,
            quantity=ci.quantity,
            product_id=product.id,
            product_name=product.name,
            product_slug=product.slug,
            variant_name=variant.variant_name,
            unit_price_paise=variant.price_paise,
            compare_at_paise=variant.compare_at_paise,
            image_url=image_url,
            stock_quantity=stock,
        ))

    return CartOut(items=items, subtotal_paise=subtotal)


@router.get("/cart", response_model=CartOut)
def get_cart(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cart = _get_or_create_cart(db, user)
    return _serialize_cart(db, cart)


@router.post("/cart/items", response_model=CartOut)
def add_item(
    payload: CartItemAdd,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    variant = (
        db.query(ProductVariant)
        .filter(ProductVariant.id == payload.variant_id, ProductVariant.is_active.is_(True))
        .first()
    )
    if variant is None:
        raise HTTPException(status_code=404, detail="This item is no longer available")

    cart = _get_or_create_cart(db, user)
    existing = db.query(CartItem).filter(
        CartItem.cart_id == cart.id, CartItem.variant_id == payload.variant_id
    ).first()
    new_quantity = (existing.quantity if existing else 0) + payload.quantity

    stock = _variant_stock(db, variant.id)
    if new_quantity > stock:
        raise HTTPException(
            status_code=400,
            detail=f"Only {stock} left in stock" if stock > 0 else "This item is out of stock",
        )

    if existing:
        existing.quantity = new_quantity
    else:
        db.add(CartItem(cart_id=cart.id, variant_id=payload.variant_id, quantity=new_quantity))

    db.commit()
    db.refresh(cart)
    return _serialize_cart(db, cart)


@router.patch("/cart/items/{item_id}", response_model=CartOut)
def update_item(
    item_id: int,
    payload: CartItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cart = _get_or_create_cart(db, user)
    # Scoping the WHERE to cart_id == cart.id (not just item_id) is what
    # makes this "you can only edit your own cart's items" — a cart item id
    # belonging to a different user's cart simply won't match this query
    # and falls through to the 404 below, rather than needing a separate
    # ownership check.
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Cart item not found")

    stock = _variant_stock(db, item.variant_id)
    if payload.quantity > stock:
        raise HTTPException(status_code=400, detail=f"Only {stock} left in stock")

    item.quantity = payload.quantity
    db.commit()
    db.refresh(cart)
    return _serialize_cart(db, cart)


@router.delete("/cart/items/{item_id}", response_model=CartOut)
def remove_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cart = _get_or_create_cart(db, user)
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Cart item not found")

    db.delete(item)
    db.commit()
    db.refresh(cart)
    return _serialize_cart(db, cart)


@router.delete("/cart", response_model=CartOut)
def clear_cart(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cart = _get_or_create_cart(db, user)
    for item in list(cart.items):
        db.delete(item)
    db.commit()
    db.refresh(cart)
    return _serialize_cart(db, cart)
