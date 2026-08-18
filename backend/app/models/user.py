import enum

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    customer = "customer"
    admin = "admin"
    ops = "ops"
    delivery_partner = "delivery_partner"
    support = "support"


class User(Base):
    __tablename__ = "users"

    # with_variant: use BIGINT on Postgres (production/Supabase) but fall
    # back to plain INTEGER on SQLite. This only matters for running quick
    # local tests against SQLite instead of Supabase — it has zero effect
    # on the real Postgres schema/migrations.
    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True)
    phone = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False, default=UserRole.customer)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    addresses = relationship("Address", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", foreign_keys="Order.user_id")
