"""
Run this directly to test your Supabase Storage S3 connection in isolation
— no FastAPI, no our app code, just boto3 talking straight to Supabase.
Whatever error this prints IS the real problem; our app's error handling
was just re-wrapping whatever boto3 raised, so this cuts straight to the
actual cause.

Usage (from backend/, with your venv activated):
    python diagnose_storage.py
"""
import sys

import boto3
from botocore.client import Config

from app.core.config import settings

print("Testing with these settings (secret values partially masked):")
print(f"  STORAGE_ENDPOINT_URL = {settings.STORAGE_ENDPOINT_URL}")
print(f"  STORAGE_REGION       = {settings.STORAGE_REGION}")
print(f"  STORAGE_BUCKET       = {settings.STORAGE_BUCKET}")
print(f"  STORAGE_ACCESS_KEY   = {settings.STORAGE_ACCESS_KEY[:6]}..." if settings.STORAGE_ACCESS_KEY else "  STORAGE_ACCESS_KEY   = NOT SET")
print(f"  STORAGE_SECRET_KEY   = {'set, length ' + str(len(settings.STORAGE_SECRET_KEY)) if settings.STORAGE_SECRET_KEY else 'NOT SET'}")
print()

client = boto3.client(
    "s3",
    endpoint_url=settings.STORAGE_ENDPOINT_URL,
    aws_access_key_id=settings.STORAGE_ACCESS_KEY,
    aws_secret_access_key=settings.STORAGE_SECRET_KEY,
    config=Config(signature_version="s3v4"),
    region_name=settings.STORAGE_REGION,
)

print("Step 1: Trying to LIST buckets (simplest possible call)...")
try:
    resp = client.list_buckets()
    print("SUCCESS. Buckets visible to these credentials:")
    for b in resp.get("Buckets", []):
        print(f"  - {b['Name']}")
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
    if hasattr(e, "response"):
        print(f"  Raw response: {e.response}")
    print()
    print("If this failed, the problem is your endpoint/region/credentials")
    print("themselves — fix those before re-testing the upload.")
    sys.exit(1)

print()
print("Step 2: Trying to upload a tiny test file to your bucket...")
try:
    client.put_object(
        Bucket=settings.STORAGE_BUCKET,
        Key="diagnostic-test.txt",
        Body=b"hello from diagnose_storage.py",
        ContentType="text/plain",
    )
    print("SUCCESS — a real object was uploaded. Check Supabase Storage ->",
          settings.STORAGE_BUCKET, "for a file named diagnostic-test.txt")
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
    if hasattr(e, "response"):
        print(f"  Raw response: {e.response}")