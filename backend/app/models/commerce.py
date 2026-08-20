import enum

from sqlalchemy import (
    BigInteger, Boolean, Column, Date, DateTime, Enum, ForeignKey,
    Integer, JSON, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class Address(Base):
    __tablename__ = "addresses"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    label = Column(String, default="Home")
    contact_name = Column(String, nullable=False)
    contact_phone = Column(String, nullable=False)
    line1 = Column(String, nullable=False)
    line2 = Column(String)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    pincode = Column(String, nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="addresses")


class InventoryBatch(Base):
    __tablename__ = "inventory_batches"
    __table_args__ = (UniqueConstraint("variant_id", "batch_code", "warehouse_code"),)

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    variant_id = Column(BigInteger, ForeignKey("product_variants.id"), nullable=False)
    batch_code = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    manufactured_on = Column(Date)
    expires_on = Column(Date)
    warehouse_code = Column(String, nullable=False, default="MAIN")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    variant = relationship("ProductVariant", back_populates="batches")


class Cart(Base):
    __tablename__ = "carts"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    session_token = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("cart_id", "variant_id"),)

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    cart_id = Column(BigInteger, ForeignKey("carts.id"), nullable=False)
    variant_id = Column(BigInteger, ForeignKey("product_variants.id"), nullable=False)
    quantity = Column(Integer, nullable=False)

    cart = relationship("Cart", back_populates="items")
    variant = relationship("ProductVariant")


class OrderStatus(str, enum.Enum):
    pending_payment = "pending_payment"
    confirmed = "confirmed"
    packed = "packed"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    cancelled = "cancelled"
    return_requested = "return_requested"
    returned = "returned"
    refunded = "refunded"


class Order(Base):
    __tablename__ = "orders"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    order_number = Column(String, nullable=False, unique=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(OrderStatus, name="order_status"), nullable=False, default=OrderStatus.pending_payment)
    # with_variant: same reasoning as catalog.py's ProductVariant.attributes
    # — real Postgres/Supabase gets true JSONB, local SQLite testing falls
    # back to plain JSON so `Base.metadata.create_all()` works without a
    # live Postgres instance.
    shipping_address = Column(JSONB().with_variant(JSON, "sqlite"), nullable=False)
    subtotal_paise = Column(BigInteger, nullable=False)
    discount_paise = Column(BigInteger, nullable=False, default=0)
    shipping_paise = Column(BigInteger, nullable=False, default=0)
    total_paise = Column(BigInteger, nullable=False)
    payment_method = Column(String, nullable=False)
    payment_ref = Column(String)
    delivery_partner_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime(timezone=True))
    delivered_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="orders", foreign_keys=[user_id])
    delivery_partner = relationship("User", foreign_keys=[delivery_partner_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    order_id = Column(BigInteger, ForeignKey("orders.id"), nullable=False)
    variant_id = Column(BigInteger, ForeignKey("product_variants.id"), nullable=False)
    product_name = Column(String, nullable=False)
    variant_name = Column(String, nullable=False)
    unit_price_paise = Column(BigInteger, nullable=False)
    quantity = Column(Integer, nullable=False)
    batch_id = Column(BigInteger, ForeignKey("inventory_batches.id"), nullable=True)

    order = relationship("Order", back_populates="items")
