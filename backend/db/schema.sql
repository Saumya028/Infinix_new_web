-- ============================================================================
-- Infinix D2C Platform — Core Schema (v1)
-- ============================================================================
-- Design principles for this schema:
--   1. Products vs Variants are SEPARATE tables. A "product" is the concept
--      (e.g. "Infinix Body Spray"), a "variant" is what's actually sold and
--      has its own price/stock/SKU (e.g. "Body Spray - Ocean Breeze - 150ml").
--      The old site had no variant concept — this is the single most
--      important fix for an FMCG catalog (fragrance/size/shade all vary).
--   2. Inventory is tracked in BATCHES with expiry dates, not just a single
--      stock number. This is non-negotiable for FMCG (sanitizers, nail
--      paints etc. expire) and lets you do FEFO (first-expiry-first-out)
--      picking later.
--   3. Money is stored in the smallest currency unit (paise, i.e. integer
--      cents) — never as float/decimal-of-rupees. Prevents rounding bugs.
--   4. Every table has created_at/updated_at for auditability.
--   5. Soft-delete via is_active flags where a row might be referenced by
--      historical orders (products, variants) — never hard-delete these.
-- ============================================================================

-- ---------- USERS & ROLES ----------------------------------------------------
-- One users table, one role column. Simple and sufficient until you have
-- genuinely complex permission needs — don't build a full RBAC system yet.
CREATE TYPE user_role AS ENUM ('customer', 'admin', 'ops', 'delivery_partner', 'support');

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    full_name       TEXT NOT NULL,
    email           CITEXT UNIQUE,              -- CITEXT = case-insensitive text (extension enabled below)
    phone           TEXT UNIQUE,
    password_hash   TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'customer',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label           TEXT DEFAULT 'Home',        -- Home / Work / Other
    contact_name    TEXT NOT NULL,
    contact_phone   TEXT NOT NULL,
    line1           TEXT NOT NULL,
    line2           TEXT,
    city            TEXT NOT NULL,
    state           TEXT NOT NULL,
    pincode         TEXT NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- CATALOG -----------------------------------------------------------
CREATE TABLE categories (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,        -- used in URLs: /shop/personal-care
    parent_id       BIGINT REFERENCES categories(id),  -- allows subcategories
    image_url       TEXT,
    display_order   INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE products (
    id              BIGSERIAL PRIMARY KEY,
    category_id     BIGINT NOT NULL REFERENCES categories(id),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    brand           TEXT NOT NULL DEFAULT 'Infinix',
    is_active       BOOLEAN NOT NULL DEFAULT true,  -- soft delete
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The actual purchasable unit. "Ocean Breeze, 150ml" is a variant of the
-- "Body Spray" product. Every variant has its own SKU, price and stock.
CREATE TABLE product_variants (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku             TEXT NOT NULL UNIQUE,
    variant_name    TEXT NOT NULL,               -- e.g. "Ocean Breeze - 150ml"
    attributes      JSONB NOT NULL DEFAULT '{}',  -- {"fragrance": "Ocean Breeze", "size_ml": 150}
    price_paise     BIGINT NOT NULL CHECK (price_paise >= 0),
    compare_at_paise BIGINT CHECK (compare_at_paise >= 0), -- "MRP" struck-through price, nullable
    weight_grams    INT,                          -- needed for shipping calc later
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_images (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id      BIGINT REFERENCES product_variants(id) ON DELETE CASCADE, -- null = shared across all variants
    storage_path    TEXT NOT NULL,      -- path in S3/R2, e.g. products/123/original.jpg
    alt_text        TEXT NOT NULL DEFAULT '',
    display_order   INT NOT NULL DEFAULT 0,
    is_primary      BOOLEAN NOT NULL DEFAULT false
);
-- NOTE: we never store width/height-specific URLs here. The CDN image
-- transform layer (Step 6) generates sized/format variants on the fly from
-- storage_path. Storing one canonical original per image keeps this simple.

-- ---------- INVENTORY (batch + expiry aware) -----------------------------------
CREATE TABLE inventory_batches (
    id              BIGSERIAL PRIMARY KEY,
    variant_id      BIGINT NOT NULL REFERENCES product_variants(id),
    batch_code      TEXT NOT NULL,
    quantity        INT NOT NULL CHECK (quantity >= 0),
    manufactured_on DATE,
    expires_on      DATE,                         -- critical for FMCG
    warehouse_code  TEXT NOT NULL DEFAULT 'MAIN',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (variant_id, batch_code, warehouse_code)
);
-- Total sellable stock for a variant = SUM(quantity) across its batches
-- (minus any reserved-but-unpaid amounts — handled at the application layer
-- via short-lived reservations during checkout, not in this table).
CREATE INDEX idx_inventory_variant ON inventory_batches (variant_id);
CREATE INDEX idx_inventory_expiry ON inventory_batches (expires_on);

-- ---------- CART ---------------------------------------------------------------
CREATE TABLE carts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE, -- null for guest carts (session-based)
    session_token   TEXT,                          -- used for guest carts, merged into user cart on login
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
    id              BIGSERIAL PRIMARY KEY,
    cart_id         BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id      BIGINT NOT NULL REFERENCES product_variants(id),
    quantity        INT NOT NULL CHECK (quantity > 0),
    UNIQUE (cart_id, variant_id)
);

-- ---------- ORDERS --------------------------------------------------------------
CREATE TYPE order_status AS ENUM (
    'pending_payment', 'confirmed', 'packed', 'out_for_delivery',
    'delivered', 'cancelled', 'return_requested', 'returned', 'refunded'
);

CREATE TABLE orders (
    id                  BIGSERIAL PRIMARY KEY,
    order_number        TEXT NOT NULL UNIQUE,        -- human-facing, e.g. INF-2026-000123
    user_id             BIGINT NOT NULL REFERENCES users(id),
    status              order_status NOT NULL DEFAULT 'pending_payment',
    shipping_address    JSONB NOT NULL,               -- snapshot at order time (address may change later)
    subtotal_paise      BIGINT NOT NULL,
    discount_paise      BIGINT NOT NULL DEFAULT 0,
    shipping_paise      BIGINT NOT NULL DEFAULT 0,
    total_paise         BIGINT NOT NULL,
    payment_method      TEXT NOT NULL,                -- 'razorpay' | 'cod'
    payment_ref         TEXT,                         -- razorpay payment id
    delivery_partner_id BIGINT REFERENCES users(id),
    assigned_at         TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Line items snapshot product/variant details at time of purchase — never
-- join back to products/product_variants for historical orders, since
-- price/name can change later.
CREATE TABLE order_items (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    variant_id      BIGINT NOT NULL REFERENCES product_variants(id),
    product_name    TEXT NOT NULL,
    variant_name    TEXT NOT NULL,
    unit_price_paise BIGINT NOT NULL,
    quantity        INT NOT NULL CHECK (quantity > 0),
    batch_id        BIGINT REFERENCES inventory_batches(id) -- which batch this was fulfilled from
);

-- ---------- REVIEWS --------------------------------------------------------------
CREATE TABLE reviews (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    order_item_id   BIGINT REFERENCES order_items(id),  -- proof of purchase, nullable
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- INDEXES for common query patterns -------------------------------
CREATE INDEX idx_products_category ON products (category_id) WHERE is_active;
CREATE INDEX idx_variants_product ON product_variants (product_id) WHERE is_active;
CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_reviews_product ON reviews (product_id);

-- Needed for the CITEXT type used on users.email above
CREATE EXTENSION IF NOT EXISTS citext;
