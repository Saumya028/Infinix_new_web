from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, ForeignKey, Integer,
    JSON, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    # BIGINT on Postgres, INTEGER on SQLite (see app/models/user.py for why)
    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True)
    parent_id = Column(BigInteger, ForeignKey("categories.id"), nullable=True)
    image_url = Column(String)
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    category_id = Column(BigInteger, ForeignKey("categories.id"), nullable=False)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True)
    description = Column(Text)
    brand = Column(String, nullable=False, default="Infinix")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("Category", back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    product_id = Column(BigInteger, ForeignKey("products.id"), nullable=False)
    sku = Column(String, nullable=False, unique=True)
    variant_name = Column(String, nullable=False)
    attributes = Column(JSONB().with_variant(JSON, "sqlite"), nullable=False, default=dict)  # {"fragrance": "Ocean Breeze", "size_ml": 150}
    price_paise = Column(BigInteger, nullable=False)
    compare_at_paise = Column(BigInteger, nullable=True)
    weight_grams = Column(Integer)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="variants")
    batches = relationship("InventoryBatch", back_populates="variant")

    @property
    def price_rupees(self) -> float:
        """Convenience for API responses — DB and business logic always use
        price_paise (integers) to avoid float rounding bugs; we only convert
        to rupees at the very edge, for display."""
        return self.price_paise / 100


class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    product_id = Column(BigInteger, ForeignKey("products.id"), nullable=False)
    variant_id = Column(BigInteger, ForeignKey("product_variants.id"), nullable=True)
    storage_path = Column(String, nullable=False)
    alt_text = Column(String, nullable=False, default="")
    display_order = Column(Integer, nullable=False, default=0)
    is_primary = Column(Boolean, nullable=False, default=False)

    product = relationship("Product", back_populates="images")
