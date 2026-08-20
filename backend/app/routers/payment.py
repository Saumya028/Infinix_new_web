"""
Razorpay online payments.

Flow (ported from the old site's payment_routes.py — this sequence was
correct there and is unchanged in principle):

  1. POST /payment/razorpay/create-order
       - We compute the amount SERVER-SIDE from the user's actual cart
         (never trust an amount sent by the client — a modified request
         could otherwise pay ₹1 for a ₹5000 cart).
       - We create the real Order row right away, status=pending_payment
         (this is the one structural change from the old site: it used a
         separate `razorpay_orders` staging table because its orders table
         had no pending state. Ours does, so we skip the staging table
         entirely — see app/services/orders.py's docstring).
       - We temporarily stash the Razorpay order id in `payment_ref` so
         /verify below can cross-check it; verify() overwrites this field
         with the real payment id once payment is confirmed.

  2. Razorpay's Checkout.js runs in the browser (frontend/components/
     RazorpayCheckout.tsx), the user pays, Razorpay returns a payment id +
     signature to the frontend.

  3. POST /payment/razorpay/verify
       - Verifies the signature server-side with RAZORPAY_KEY_SECRET. This
         is the step that actually proves the payment is genuine — a client
         claiming "success" on its own proves nothing.
       - On success: decrements stock, marks the order confirmed, records
         the real payment id.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import razorpay

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.commerce import Order, OrderStatus
from app.models.user import User
from app.schemas.orders import RazorpayOrderOut, RazorpayOrderRequest, RazorpayVerifyRequest
from app.services.orders import create_order_from_cart

router = APIRouter()

_client: razorpay.Client | None = None


def _get_client() -> razorpay.Client:
    global _client
    if not (settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET):
        raise HTTPException(
            status_code=503,
            detail="Online payments aren't configured yet. Please use Cash on Delivery.",
        )
    if _client is None:
        _client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    return _client


@router.post("/payment/razorpay/create-order", response_model=RazorpayOrderOut)
def create_razorpay_order(
    payload: RazorpayOrderRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    client = _get_client()

    order = create_order_from_cart(
        db, user,
        shipping_address=payload.shipping_address,
        payment_method="razorpay",
        status=OrderStatus.pending_payment,
    )
    # create_order_from_cart already decrements stock and clears the cart.
    # We do this BEFORE the customer pays, not after, so two people can't
    # both "win" the last unit while one of them is mid-payment; if this
    # particular payment later fails or is abandoned, the stock is put back
    # by _release_pending_stock() below (called from an expiry job — see
    # note at the bottom of this file for what's still manual today).

    razorpay_order = client.order.create({
        "amount": order.total_paise,
        "currency": "INR",
        "payment_capture": 1,
        "receipt": order.order_number,
    })

    order.payment_ref = razorpay_order["id"]  # temporary; overwritten with the real payment id on verify
    db.commit()

    return RazorpayOrderOut(
        key_id=settings.RAZORPAY_KEY_ID,
        razorpay_order_id=razorpay_order["id"],
        amount_paise=order.total_paise,
        order_id=order.id,
    )


@router.post("/payment/razorpay/verify", response_model=RazorpayOrderOut)
def verify_razorpay_payment(
    payload: RazorpayVerifyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    client = _get_client()

    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == OrderStatus.confirmed:
        # Already verified (e.g. a duplicate callback from Razorpay, or the
        # user double-clicking) — respond success without processing twice.
        return RazorpayOrderOut(
            key_id=settings.RAZORPAY_KEY_ID, razorpay_order_id=payload.razorpay_order_id,
            amount_paise=order.total_paise, order_id=order.id,
        )

    # Cross-check: the razorpay_order_id being verified must match the one
    # we actually created this pending order for — stops someone from
    # verifying a genuine payment for order A against order B's row.
    if order.payment_ref != payload.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Payment/order mismatch")

    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature,
        })
    except razorpay.errors.SignatureVerificationError:
        order.status = OrderStatus.cancelled
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Payment verification failed. If any amount was deducted, it will be refunded.",
        )

    order.status = OrderStatus.confirmed
    order.payment_ref = payload.razorpay_payment_id
    db.commit()

    return RazorpayOrderOut(
        key_id=settings.RAZORPAY_KEY_ID, razorpay_order_id=payload.razorpay_order_id,
        amount_paise=order.total_paise, order_id=order.id,
    )

# NOTE on abandoned payments: if a customer closes the Razorpay widget
# without paying, their order sits at status=pending_payment with stock
# already deducted from inventory_batches. For Step 7 this is left as a
# manual admin cleanup case (cancel the order in the admin panel, which we
# have not yet wired to restock — see app/routers/orders.py's
# update_order_status). A production system would run a background job
# (Step 10, "background jobs" on your roadmap) that cancels and restocks
# any pending_payment order older than ~30 minutes.
