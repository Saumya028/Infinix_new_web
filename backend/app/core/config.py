"""
Centralized app configuration.

Why this exists instead of scattering os.getenv() calls everywhere (which is
what the old Flask app did in config/settings.py): pydantic-settings gives us
- type validation (DATABASE_URL must be a string, JWT_EXPIRE_MINUTES must be
  an int) at startup, so a missing/misspelled env var fails LOUDLY at boot
  instead of causing a mysterious bug at 2am when someone finally hits that
  code path in production.
- a single object (`settings`) importable everywhere, instead of re-reading
  env vars in every file.

Note on Supabase: Supabase Postgres is just Postgres. DATABASE_URL is the
connection string from Supabase's dashboard (Project Settings -> Database ->
Connection string -> URI, "Transaction" pooler mode for serverless/FastAPI).
Nothing else in this file is Supabase-specific.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- Database (Supabase Postgres connection string) ---
    DATABASE_URL: str  # e.g. postgresql://postgres:[password]@[host]:5432/postgres

    # --- Auth ---
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- Object storage (Step 6 will use these — S3-compatible, works for
    # Supabase Storage, Cloudflare R2, or AWS S3 unchanged) ---
    STORAGE_ENDPOINT_URL: str | None = None
    STORAGE_ACCESS_KEY: str | None = None
    STORAGE_SECRET_KEY: str | None = None
    STORAGE_BUCKET: str = "infinix-assets"
    STORAGE_PUBLIC_BASE_URL: str | None = None  # CDN domain in front of the bucket

    # --- Cache ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- CORS ---
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
