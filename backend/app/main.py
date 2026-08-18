from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import admin_catalog, auth, products

app = FastAPI(title="Infinix API", version="1.0.0")

# The frontend (Next.js, running on a different origin) needs explicit
# permission to call this API from the browser. In production, set
# FRONTEND_ORIGIN to your real domain — never use allow_origins=["*"]
# once you add cookies/auth, since browsers block credentialed requests
# to a wildcard origin anyway, and it's an unnecessary attack surface.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Used by uptime monitors / load balancers to confirm the API is alive."""
    return {"status": "ok", "environment": settings.ENVIRONMENT}


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(products.router, tags=["catalog (public)"])
app.include_router(admin_catalog.router, prefix="/admin", tags=["catalog (admin)"])

# Next routers (cart, orders, delivery) get included here in later steps, e.g.:
# from app.routers import cart
# app.include_router(cart.router, prefix="/cart", tags=["cart"])
