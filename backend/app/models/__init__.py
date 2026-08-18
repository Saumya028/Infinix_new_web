"""
Import every model module here. Alembic's autogenerate (Step 2e) inspects
`Base.metadata`, which only knows about a model class once its module has
been imported somewhere. Without this file, Alembic would silently miss
tables and generate an empty/incorrect migration.
"""
from app.models.user import User, UserRole  # noqa: F401
from app.models.catalog import Category, Product, ProductVariant, ProductImage  # noqa: F401
from app.models.commerce import (  # noqa: F401
    Address, InventoryBatch, Cart, CartItem, Order, OrderItem, OrderStatus,
)
