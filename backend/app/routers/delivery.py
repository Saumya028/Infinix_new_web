"""
Delivery partner portal — new in the rebuild; the old site had no delivery
role or portal concept at all, just an admin marking orders "Shipped" by
hand. The new schema's Order.delivery_partner_id / assigned_at columns
exist specifically to support this.

Every route here requires require_delivery_partner (see core/deps.py), and
every query is scoped to `Order.delivery_partner_id == user.id` — a
delivery partner can only ever see or touch orders assigned to them,
same "scope the query" pattern used throughout cart.py and orders.py.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import require_delivery_partner
from app.models.commerce import Order, OrderStatus
from app.models.user import User
from app.schemas.orders import OrderOut, OrderStatusUpdate

router = APIRouter(dependencies=[Depends(require_delivery_partner)])

# A delivery partner can move an order FORWARD along a fixed path, and can
# report a failed/refused delivery as "returned" — they can't set arbitrary
# statuses (e.g. jump straight to "delivered" from "confirmed", or set
# "refunded", which is a finance/admin action). This is enforced below,
# unlike the admin's PATCH /admin/orders/{id}/status which trusts staff
# with any transition.
ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.confirmed: {OrderStatus.packed},
    OrderStatus.packed: {OrderStatus.out_for_delivery},
    OrderStatus.out_for_delivery: {OrderStatus.delivered, OrderStatus.return_requested},
}


@router.get("/delivery/orders/mine", response_model=list[OrderOut])
def my_assigned_orders(db: Session = Depends(get_db), user: User = Depends(require_delivery_partner)):
    return (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.delivery_partner_id == user.id)
        .filter(Order.status.in_([
            OrderStatus.confirmed, OrderStatus.packed, OrderStatus.out_for_delivery,
        ]))
        .order_by(Order.assigned_at.desc())
        .all()
    )


@router.patch("/delivery/orders/{order_id}/status", response_model=OrderOut)
def update_delivery_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_delivery_partner),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.id == order_id, Order.delivery_partner_id == user.id)
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found or not assigned to you")

    allowed = ALLOWED_TRANSITIONS.get(order.status, set())
    if payload.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move an order from '{order.status.value}' to '{payload.status.value}'",
        )

    order.status = payload.status
    if payload.status == OrderStatus.delivered:
        order.delivered_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)
    return order
