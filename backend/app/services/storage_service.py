"""Private S3-compatible storage for clinic assets."""

import asyncio
import io
from uuid import UUID, uuid4

import boto3
from botocore.config import Config
from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

MAX_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_FORMATS = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}


def _client():
    if not settings.minio_access_key or not settings.minio_secret_key:
        raise HTTPException(status_code=503, detail="Object storage is not configured")
    return boto3.client("s3", endpoint_url=settings.minio_endpoint, aws_access_key_id=settings.minio_access_key, aws_secret_access_key=settings.minio_secret_key, config=Config(signature_version="s3v4"), region_name="us-east-1")


async def save_clinic_logo(clinic_id: UUID, upload: UploadFile) -> tuple[str, str]:
    data = await upload.read(MAX_LOGO_BYTES + 1)
    if len(data) > MAX_LOGO_BYTES:
        raise HTTPException(status_code=413, detail="Logo must not exceed 2 MB")
    try:
        image = Image.open(io.BytesIO(data)); image.verify()
        image = Image.open(io.BytesIO(data))
        media_type = ALLOWED_FORMATS[image.format or ""]
        if image.width > 4000 or image.height > 4000:
            raise HTTPException(status_code=422, detail="Logo dimensions are too large")
    except (UnidentifiedImageError, KeyError, OSError):
        raise HTTPException(status_code=422, detail="Upload a valid PNG, JPEG, or WebP image")
    extension = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[media_type]
    key = f"clinic-logos/{clinic_id}/{uuid4()}.{extension}"
    def put():
        client = _client()
        try: client.head_bucket(Bucket=settings.minio_bucket)
        except Exception: client.create_bucket(Bucket=settings.minio_bucket)
        client.put_object(Bucket=settings.minio_bucket, Key=key, Body=data, ContentType=media_type, CacheControl="public, max-age=31536000, immutable")
    await asyncio.to_thread(put)
    return key, f"{settings.public_backend_url.rstrip('/')}/api/v1/public/clinic-logos/{clinic_id}"


async def read_clinic_logo(key: str) -> tuple[bytes, str]:
    def get():
        item = _client().get_object(Bucket=settings.minio_bucket, Key=key)
        return item["Body"].read(), item.get("ContentType") or "application/octet-stream"
    try: return await asyncio.to_thread(get)
    except Exception: raise HTTPException(status_code=404, detail="Logo not found")
