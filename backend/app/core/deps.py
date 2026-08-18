"""
This file is where authorization actually gets enforced. Read this one
carefully — it's the piece that answers "how do users/admin/delivery
partners each only get their own access."

The pattern:
  1. get_current_user  -> "who is making this request?" (any logged-in user)
  2. require_role(...)  -> "is this user ALLOWED to be here?" (role check)

Every protected route in the app just declares which of these it needs as a
FastAPI `Depends(...)` parameter. FastAPI runs the dependency before your
route function, and if the dependency raises an HTTPException, your route
code never runs at all — the request is rejected at the door.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole

# HTTPBearer just tells FastAPI/Swagger "expect an Authorization: Bearer
# <token> header." Unlike OAuth2PasswordBearer, it does NOT assume a
# form-based login flow — in /docs, this shows a simple "paste your token
# here" field instead of a username/password form, which matches how our
# JSON-based /auth/login actually works.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Runs on every route that depends on it. Extracts the Bearer token,
    verifies its signature via decode_token(), and loads the matching user
    from the DB. Raises 401 Unauthorized at any failure point — no token,
    invalid/expired token, or a token for a user that no longer exists/was
    deactivated.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise unauthorized

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise unauthorized

    return user


def require_role(*allowed_roles: UserRole):
    """
    A "dependency factory" — a function that RETURNS a dependency, so we can
    parameterize which roles are allowed per-route.

    Usage on a route:
        @router.get("/admin/orders")
        def list_all_orders(user: User = Depends(require_role(UserRole.admin))):
            ...

    Here's the flow: FastAPI first resolves get_current_user (proving the
    request has a valid, logged-in user), THEN checks that user's role is in
    the allowed set. If not, 403 Forbidden — deliberately different from 401:
    401 means "we don't know who you are," 403 means "we know who you are,
    and you're not allowed to do this." That distinction matters for
    debugging and for the frontend (403 -> show "not authorized" UI, 401 ->
    redirect to login).
    """
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of these roles: {[r.value for r in allowed_roles]}",
            )
        return current_user

    return dependency


# Pre-built shortcuts for the common cases used across routers — saves
# writing require_role(UserRole.admin) everywhere.
require_admin = require_role(UserRole.admin)
require_delivery_partner = require_role(UserRole.delivery_partner)
require_staff = require_role(UserRole.admin, UserRole.ops, UserRole.support)
