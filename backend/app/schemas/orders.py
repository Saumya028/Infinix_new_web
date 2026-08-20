from pydantic import BaseModel, Field

from app.models.commerce import OrderStatus


class ShippingAddress(BaseModel):
    """
    Snapshotted verbatim into orders.shipping_address (JSONB) at order time —
    see db/schema.sql's comment on that column: an order must always show
    the address it was actually shipped to, even if the user edits or
    deletes their saved address afterwards.
    """
    contact_name: str = Field(min_length=1, max_length=200)
    contact_phone: str = Field(min_length=6, max_length=20)
    line1: str = Field(min_length=1)
    line2: str | None = None
    city: str = Field(min_length=1)
    state: str = Field(min_length=1)
    pincode: str = Field(min_length=4, max_length=10)
    save_address: bool = False  # if true, also persisted as a reusable Address row
    label: str = "Home"


class PlaceOrderRequest(BaseModel):
    """Used for the Cash on Delivery flow — POST /orders."""
    shipping_address: ShippingAddress


class OrderItemOut(BaseModel):
    product_name: str
    variant_name: str
    unit_price_paise: int
    quantity: int

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    order_number: str
    status: OrderStatus
    shipping_address: dict
    subtotal_paise: int
    discount_paise: int
    shipping_paise: int
    total_paise: int
    payment_method: str
    items: list[OrderItemOut]

    class Config:
        from_attributes = True


class OrderSummaryOut(BaseModel):
    """Slim shape for admin order-list tables — no need to ship every line
    item when rendering a row per order."""
    id: int
    order_number: str
    status: OrderStatus
    total_paise: int
    payment_method: str
    customer_name: str

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class AssignDeliveryPartnerRequest(BaseModel):
    delivery_partner_id: int


class DeliveryPartnerOut(BaseModel):
    id: int
    full_name: str
    phone: str | None

    class Config:
        from_attributes = True


class AdminOrderDetailOut(OrderOut):
    """Same shape as OrderOut (what a customer sees) plus the fields only
    staff should see: who placed it and who's delivering it."""
    customer_name: str
    customer_email: str | None
    customer_phone: str | None
    delivery_partner_id: int | None
    delivery_partner_name: str | None


# ---------- Analytics ----------

class StatusCount(BaseModel):
    status: OrderStatus
    count: int


class TopProduct(BaseModel):
    product_name: str
    units_sold: int
    revenue_paise: int


class DailyTrendPoint(BaseModel):
    day: str  # ISO date
    order_count: int
    revenue_paise: int


class AnalyticsSummary(BaseModel):
    total_orders: int
    total_revenue_paise: int
    avg_order_value_paise: int
    total_products: int
    total_customers: int


class AnalyticsOut(BaseModel):
    summary: AnalyticsSummary
    status_counts: list[StatusCount]
    top_products: list[TopProduct]
    daily_trend: list[DailyTrendPoint]


# ---------- Razorpay ----------

class RazorpayOrderRequest(BaseModel):
    shipping_address: ShippingAddress


class RazorpayOrderOut(BaseModel):
    key_id: str
    razorpay_order_id: str
    amount_paise: int
    currency: str = "INR"
    order_id: int  # our internal order id, status=pending_payment until verified


class RazorpayVerifyRequest(BaseModel):
    order_id: int  # our internal order id returned by create-order above
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
