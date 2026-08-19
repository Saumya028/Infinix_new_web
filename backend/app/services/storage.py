"""
Thin wrapper around boto3 (the AWS SDK, which Supabase Storage's S3-
compatible endpoint also speaks). Kept as three small functions rather than
scattering boto3 calls across routers — if you ever migrate to Cloudflare
R2 or raw AWS S3, only this file changes, since both speak the same S3
protocol Supabase does.
"""
import boto3
from botocore.client import Config

from app.core.config import settings


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.STORAGE_ENDPOINT_URL,
        aws_access_key_id=settings.STORAGE_ACCESS_KEY,
        aws_secret_access_key=settings.STORAGE_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name=settings.STORAGE_REGION,
    )


def upload_bytes(key: str, data: bytes, content_type: str) -> None:
    """
    Uploads one object. `Cache-Control: immutable` is deliberate: our keys
    include a random UUID (see admin_catalog.py), so a given key's content
    NEVER changes — replacing an image means uploading under a new key, not
    overwriting. That means browsers/CDNs can cache these forever with zero
    risk of serving stale content, which matters a lot for image load speed.
    """
    _client().put_object(
        Bucket=settings.STORAGE_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",
    )


def delete_object(key: str) -> None:
    _client().delete_object(Bucket=settings.STORAGE_BUCKET, Key=key)


def public_url(key: str) -> str:
    """
    Builds the public URL for an object in a PUBLIC bucket. This assumes
    the bucket is configured as public in Supabase (Storage -> your bucket
    -> make public) — see the setup steps. Private/authenticated buckets
    would need signed URLs instead, which is unnecessary complexity for
    product images that are meant to be publicly visible anyway.
    """
    base = settings.STORAGE_PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/{key}"

