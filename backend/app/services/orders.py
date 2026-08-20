"""
Order creation, shared by both checkout paths:
  - routers/orders.py's POST /orders          (Cash on Delivery)
  - routers/payment.py's POST /payment/.../verify  (Razorpay, after the
    signature is confirmed genuine)

Keeping this in one place means stock decrement, order numbering, and cart
clearing can never drift between the two payment methods — the old Flask
app had this logic duplicated almost verbatim across place_order() in
order_routes.py and verify_razorpay_payment() in payment_routes.py.
"""
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.commerce import (
    Address, Cart, CartItem, InventoryBatch, Order, OrderItem, OrderStatus,
)
from app.models.user import User
from app.schemas.orders import ShippingAddress


def _decrement_stock_fefo(db: Session, variant_id: int, quantity_needed: int) -> list[tuple[int, int]]:
    """
    FEFO = First-Expiry-First-Out: sell from the batch that expires soonest
    first. This is standard FMCG warehousing practice (and the old site had
    no batch/expiry concept at all to do this with).

    Returns [(batch_id, quantity_taken), ...] — one entry per batch this
    order draws from, so the caller can create one OrderItem row per batch
    (order_items.batch_id is what lets you trace a delivered unit back to
    exactly which manufactured batch it came from — important for recalls).

    Raises if total available stock across all batches is insufficient.
    """
    batches = (
        db.query(InventoryBatch)
        .filter(InventoryBatch.variant_id == variant_id, InventoryBatch.quantity > 0)
        .order_by(InventoryBatch.expires_on.asc().nulls_last())
        .with_for_update()  # locks these rows until the transaction commits,
        # so two customers checking out the same last unit at the same
        # instant can't both succeed — the second one blocks here until the
        # first commits, then re-reads the now-decremented quantity.
        .all()
    )

    remaining = quantity_needed
    draws: list[tuple[int, int]] = []
    for batch in batches:
        if remaining <= 0:
            break
        take = min(batch.quantity, remaining)
        batch.quantity -= take
        draws.append((batch.id, take))
        remaining -= take

    if remaining > 0:
        raise HTTPException(status_code=409, detail="One or more items in your cart just sold out")

    return draws


def create_order_from_cart(
    db: Session,
    user: User,
    shipping_address: ShippingAddress,
    payment_method: str,
    status: OrderStatus,
) -> Order:
    """
    Reads the user's SERVER-SIDE cart (never trusting a cart/total the
    client might send) as the source of truth for what's being purchased,
    exactly like the old site's "re-pull the cart, don't trust anything
    cached earlier in the flow" comment in payment_routes.py — that
    principle was correct and is kept here.
    """
    cart = db.query(Cart).filter(Cart.user_id == user.id).first()
    if cart is None or not cart.items:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    subtotal = sum(ci.variant.price_paise * ci.quantity for ci in cart.items)

    if shipping_address.save_address:
        db.add(Address(
            user_id=user.id,
            label=shipping_address.label,
            contact_name=shipping_address.contact_name,
            contact_phone=shipping_address.contact_phone,
            line1=shipping_address.line1,
            line2=shipping_address.line2,
            city=shipping_address.city,
            state=shipping_address.state,
            pincode=shipping_address.pincode,
        ))

    # Generated up front (not from order.id) so we don't need a placeholder
    # value + a second update after insert — two orders created in the same
    # instant would otherwise both try to insert the same placeholder into
    # a UNIQUE column and one would fail. Date prefix keeps it human-
    # readable/sortable; the random suffix makes collisions astronomically
    # unlikely without needing a DB round-trip to check.
    order_number = f"INF-{datetime.now(timezone.utc):%Y%m%d}-{uuid4().hex[:6].upper()}"

    order = Order(
        order_number=order_number,
        user_id=user.id,
        status=status,
        shipping_address=shipping_address.model_dump(exclude={"save_address"}),
        subtotal_paise=subtotal,
        discount_paise=0,
        shipping_paise=0,
        total_paise=subtotal,
        payment_method=payment_method,
    )
    db.add(order)
    db.flush()  # assigns order.id without committing yet, so OrderItem rows below can reference it

    for cart_item in cart.items:
        variant = cart_item.variant
        draws = _decrement_stock_fefo(db, variant.id, cart_item.quantity)
        for batch_id, qty in draws:
            db.add(OrderItem(
                order_id=order.id,
                variant_id=variant.id,
                product_name=variant.product.name,
                variant_name=variant.variant_name,
                unit_price_paise=variant.price_paise,
                quantity=qty,
                batch_id=batch_id,
            ))

    for item in list(cart.items):
        db.delete(item)

    db.commit()
    db.refresh(order)
    return order
