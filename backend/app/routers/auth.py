from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token, create_refresh_token, decode_token,
    hash_password, verify_password,
)
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserOut,
)

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        # 400, not 401/403 — this isn't an auth failure, it's a bad request
        # (duplicate email). Deliberately vague message: don't leak whether
        # it was the email specifically that's taken vs. some other issue —
        # small thing, but avoids helping account-enumeration attempts.
        raise HTTPException(status_code=400, detail="Could not register with these details")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=UserRole.customer,  # IMPORTANT: role is NEVER taken from the
        # request body. If it were, anyone could POST {"role": "admin"} and
        # register themselves as an admin. Public registration always
        # creates a `customer`; admin/delivery_partner accounts are created
        # by an existing admin through a separate, protected endpoint
        # (we'll add this in Step 4/admin panel work).
    )
    db.add(user)
    db.commit()
    db.refresh(user)  # pulls back the DB-generated id, created_at etc.
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # Deliberately identical error for "no such user" and "wrong password".
    # Distinguishing them tells an attacker which emails are registered.
    invalid_credentials = HTTPException(status_code=401, detail="Incorrect email or password")

    if user is None or not verify_password(payload.password, user.password_hash):
        raise invalid_credentials
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    """
    Access tokens are short-lived (60 min, per settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    on purpose — if one leaks, the damage window is small. Instead of forcing
    the user to log in again every hour, the frontend calls this endpoint
    with the long-lived refresh token to get a new access token silently.
    """
    token_payload = decode_token(payload.refresh_token)
    if token_payload is None or token_payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.query(User).filter(User.id == int(token_payload["sub"])).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),  # rotate it too
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """The simplest possible protected route — just proves auth is working.
    Also what the frontend calls on page load to check 'am I logged in, and as who'."""
    return current_user
