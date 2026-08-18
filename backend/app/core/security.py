"""
Password hashing.

We NEVER store a plain-text password, and we never write our own hashing
algorithm. bcrypt is the standard: it's deliberately slow (so brute-forcing
stolen hashes is expensive) and automatically handles a random "salt" per
password (so two users with the same password get completely different
hashes, and pre-computed rainbow-table attacks don't work).

passlib.CryptContext just gives us a clean hash()/verify() API over bcrypt.
"""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


# ---------------------------------------------------------------------------
# JWT (JSON Web Token) — how the API recognizes a logged-in user on every
# request without storing session state in memory/DB.
#
# A JWT is just a signed piece of JSON. It has three parts separated by dots:
#   header.payload.signature
# The payload (here: {"sub": "<user_id>", "role": "customer", "exp": ...})
# is NOT encrypted, just base64-encoded — anyone can read it (try pasting a
# token into jwt.io). What makes it trustworthy is the SIGNATURE: it's an
# HMAC-SHA256 hash of the header+payload using JWT_SECRET, which only our
# server knows. If anyone tampers with the payload (e.g. changes role to
# "admin"), the signature won't match anymore and we reject the token in
# decode_token() below. This is what "stateless auth" means: we don't look
# anything up in the DB to validate a token, we just re-verify the signature.
# ---------------------------------------------------------------------------

def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "role": role, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    # Refresh tokens live much longer and carry no role — their ONLY job is
    # to be exchanged for a new access token via /auth/refresh, so a leaked
    # refresh token can't be used directly against role-protected routes.
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        # Covers: expired token, invalid signature (tampered/forged), or
        # malformed token. We deliberately don't distinguish these to the
        # caller — all of them just mean "not authenticated."
        return None
