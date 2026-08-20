"""
Cart request/response shapes.

Design note: the cart in this API always belongs to whoever is authenticated
(their user_id comes from the JWT, via get_current_user — never from the
request body). There's deliberately no "user_id" field anywhere in these
schemas, unlike the old Flask API's /add-cart, which took user_id in the
JSON body and then had to separately check it matched the caller. Removing
the field removes the whole class of bug.

Guests (not logged in) never touch this API at all — their cart lives
entirely in the browser's localStorage (see frontend/context/CartContext.tsx)
until they log in, at which point the frontend calls POST /cart/items once
per guest item to merge it into their real server-side cart.
"""
from pydantic import BaseModel, Field


class CartItemAdd(BaseModel):
    variant_id: int
    quantity: int = Field(default=1, ge=1)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1)


class CartItemOut(BaseModel):
    id: int  # cart_item id (used for update/delete)
    variant_id: int
    quantity: int
    product_id: int
    product_name: str
    product_slug: str
    variant_name: str
    unit_price_paise: int
    compare_at_paise: int | None
    image_url: str | None
    stock_quantity: int  # lets the UI warn "only 3 left" / disable + button at the limit

    class Config:
        from_attributes = True


class CartOut(BaseModel):
    items: list[CartItemOut]
    subtotal_paise: int
