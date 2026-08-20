from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, require_staff
from app.models.catalog import Product
from app.models.commerce import Order, OrderItem, OrderStatus
from app.models.user import User, UserRole
from app.schemas.orders import (
    AdminOrderDetailOut, AnalyticsOut, AnalyticsSummary, AssignDeliveryPartnerRequest,
    DailyTrendPoint, DeliveryPartnerOut, OrderOut, OrderStatusUpdate, OrderSummaryOut,
    PlaceOrderRequest, StatusCount, TopProduct,
)
from app.services.orders import create_order_from_cart

router = APIRouter()


@router.post("/orders", response_model=OrderOut, status_code=201)
def place_cod_order(
    payload: PlaceOrderRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cash on Delivery — the simple path with no external payment gateway
    involved, so the order can go straight to 'confirmed'."""
    order = create_order_from_cart(
        db, user,
        shipping_address=payload.shipping_address,
        payment_method="cod",
        status=OrderStatus.confirmed,
    )
    return order


@router.get("/orders/mine", response_model=list[OrderOut])
def my_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
        .all()
    )


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    order = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.id == order_id)
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    # A customer can only view their own order; staff can view any — same
    # "scope the query, don't bolt on a check" pattern as cart.py.
    if order.user_id != user.id and user.role.value not in ("admin", "ops", "support"):
        raise HTTPException(status_code=403, detail="Access denied")
    return order


# ---------- Admin ----------

@router.get("/admin/orders", response_model=list[OrderSummaryOut])
def list_all_orders(db: Session = Depends(get_db), _staff: User = Depends(require_staff)):
    orders = (
        db.query(Order)
        .options(joinedload(Order.user))
        .order_by(Order.created_at.desc())
        .all()
    )
    return [
        OrderSummaryOut(
            id=o.id, order_number=o.order_number, status=o.status,
            total_paise=o.total_paise, payment_method=o.payment_method,
            customer_name=o.user.full_name,
        )
        for o in orders
    ]


@router.patch("/admin/orders/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    _staff: User = Depends(require_staff),
):
    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = payload.status
    if payload.status == OrderStatus.delivered:
        from datetime import datetime, timezone
        order.delivered_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)
    return order


def _to_admin_detail(order: Order) -> AdminOrderDetailOut:
    return AdminOrderDetailOut(
        **OrderOut.model_validate(order).model_dump(),
        customer_name=order.user.full_name,
        customer_email=order.user.email,
        customer_phone=order.user.phone,
        delivery_partner_id=order.delivery_partner_id,
        delivery_partner_name=order.delivery_partner.full_name if order.delivery_partner else None,
    )


@router.get("/admin/orders/{order_id}", response_model=AdminOrderDetailOut)
def get_order_admin(
    order_id: int,
    db: Session = Depends(get_db),
    _staff: User = Depends(require_staff),
):
    """
    Staff-only detail view — same order data as GET /orders/{id}, plus the
    customer's contact info and delivery-partner assignment, which a
    customer's own order view never needs to see about themselves.
    """
    order = (
        db.query(Order)
        .options(joinedload(Order.items), joinedload(Order.user), joinedload(Order.delivery_partner))
        .filter(Order.id == order_id)
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return _to_admin_detail(order)


@router.get("/admin/delivery-partners", response_model=list[DeliveryPartnerOut])
def list_delivery_partners(db: Session = Depends(get_db), _staff: User = Depends(require_staff)):
    return (
        db.query(User)
        .filter(User.role == UserRole.delivery_partner, User.is_active.is_(True))
        .order_by(User.full_name)
        .all()
    )


@router.patch("/admin/orders/{order_id}/assign", response_model=AdminOrderDetailOut)
def assign_delivery_partner(
    order_id: int,
    payload: AssignDeliveryPartnerRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),  # assignment is admin-only, not ops/support
):
    order = (
        db.query(Order)
        .options(joinedload(Order.items), joinedload(Order.user), joinedload(Order.delivery_partner))
        .filter(Order.id == order_id)
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    partner = db.query(User).filter(
        User.id == payload.delivery_partner_id, User.role == UserRole.delivery_partner,
    ).first()
    if partner is None:
        raise HTTPException(status_code=400, detail="That user is not a delivery partner")

    from datetime import datetime, timezone
    order.delivery_partner_id = partner.id
    order.assigned_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    return _to_admin_detail(order)


@router.get("/admin/analytics", response_model=AnalyticsOut)
def admin_analytics(db: Session = Depends(get_db), _staff: User = Depends(require_staff)):
    """
    Ported from the old site's /admin/analytics — same shape and same
    reasoning ("computed in SQL... stays accurate and fast even as the
    orders table grows"), rewritten against the new order_status enum and
    paise-based money columns.
    """
    non_cancelled = Order.status != OrderStatus.cancelled

    total_orders, total_revenue, avg_order_value = (
        db.query(
            func.count(Order.id),
            func.coalesce(func.sum(Order.total_paise), 0),
            func.coalesce(func.avg(Order.total_paise), 0),
        )
        .filter(non_cancelled)
        .one()
    )

    status_rows = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    status_counts = [StatusCount(status=s, count=c) for s, c in status_rows]

    top_product_rows = (
        db.query(
            OrderItem.product_name,
            func.sum(OrderItem.quantity).label("units_sold"),
            func.sum(OrderItem.quantity * OrderItem.unit_price_paise).label("revenue_paise"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .filter(non_cancelled)
        .group_by(OrderItem.product_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
        .all()
    )
    top_products = [
        TopProduct(product_name=name, units_sold=int(units), revenue_paise=int(revenue))
        for name, units, revenue in top_product_rows
    ]

    daily_rows = (
        db.query(
            func.date(Order.created_at).label("day"),
            func.count(Order.id),
            func.coalesce(func.sum(Order.total_paise), 0),
        )
        .filter(non_cancelled)
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
        .all()
    )
    daily_trend = [
        DailyTrendPoint(day=str(day), order_count=count, revenue_paise=int(revenue))
        for day, count, revenue in daily_rows
    ]

    total_products = db.query(func.count(Product.id)).scalar()
    total_customers = db.query(func.count(User.id)).filter(User.role == UserRole.customer).scalar()

    return AnalyticsOut(
        summary=AnalyticsSummary(
            total_orders=total_orders,
            total_revenue_paise=int(total_revenue),
            avg_order_value_paise=int(avg_order_value),
            total_products=total_products,
            total_customers=total_customers,
        ),
        status_counts=status_counts,
        top_products=top_products,
        daily_trend=daily_trend,
    )
