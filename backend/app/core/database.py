"""
SQLAlchemy engine + session setup.

Key concept if you're new to SQLAlchemy: the `engine` manages a POOL of
actual database connections (so we're not opening/closing a TCP connection
to Supabase on every request — expensive). A `Session` is a lightweight
per-request object that borrows a connection from that pool, tracks the
objects you load/change, and commits them in one transaction.

`get_db()` below is a FastAPI "dependency" — FastAPI calls it before your
route runs, hands your route the yielded `db` session, and (this is the
important bit) runs the code AFTER `yield` once the route finishes, whether
it succeeded or raised an exception. That's what guarantees the session is
always closed and never leaks a connection.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

# pool_pre_ping=True: SQLAlchemy tests each pooled connection with a cheap
# SELECT 1 before handing it to you. Without this, a connection that Supabase
# silently closed (idle timeout) would surface as a confusing error on your
# very next request instead of being quietly replaced.
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# All ORM model classes (Step 2d) inherit from this. SQLAlchemy uses it to
# know which Python classes map to which database tables.
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
