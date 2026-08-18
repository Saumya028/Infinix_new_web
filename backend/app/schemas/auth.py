"""
Pydantic schemas define what data goes IN and OUT of the API — separate from
the SQLAlchemy models (app/models/), which define what's stored in the DB.

Why keep these separate instead of just returning the DB model directly?
Two reasons that matter a lot for auth specifically:
  1. UserOut below deliberately has no password_hash field. If we ever
     accidentally did `return db_user` from a route, FastAPI would try to
     serialize the ENTIRE SQLAlchemy object including the bcrypt hash out
     to the client. Defining UserOut explicitly makes that impossible.
  2. Input validation: RegisterRequest below gets FastAPI to reject a
     malformed request (e.g. missing password, invalid email) with a clean
     422 error BEFORE any of your route code runs.
"""
from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str | None
    phone: str | None
    role: UserRole

    class Config:
        from_attributes = True  # lets this be built directly from a SQLAlchemy User object
