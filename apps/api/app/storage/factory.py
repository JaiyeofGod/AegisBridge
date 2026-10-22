"""Resolve the configured object-storage backend."""

from __future__ import annotations

from functools import lru_cache

from app.core.config import Settings, get_settings
from app.storage.memory import MemoryObjectStorage
from app.storage.protocol import ObjectStorage
from app.storage.s3 import S3ObjectStorage

_override: ObjectStorage | None = None


def set_object_storage_override(storage: ObjectStorage | None) -> None:
    """Test helper to inject a fake backend without touching SeaweedFS."""
    global _override
    _override = storage
    get_object_storage.cache_clear()


@lru_cache
def get_object_storage() -> ObjectStorage:
    if _override is not None:
        return _override
    settings = get_settings()
    return build_object_storage(settings)


def build_object_storage(settings: Settings) -> ObjectStorage:
    provider = settings.object_storage_provider.strip().lower()
    if settings.app_env.lower() == "test" or provider in {"memory", "test", "fake"}:
        return MemoryObjectStorage(bucket=settings.s3_bucket)

    access_key = settings.aws_access_key_id
    secret_key = settings.aws_secret_access_key
    if not access_key or not secret_key:
        if settings.app_env.lower() in {"local", "development", "dev"}:
            return MemoryObjectStorage(bucket=settings.s3_bucket)
        raise RuntimeError("Object storage credentials are not configured.")

    label = provider if provider else "s3"
    if settings.s3_endpoint_url and "8333" in settings.s3_endpoint_url:
        label = "seaweedfs"
    elif "r2.cloudflarestorage.com" in (settings.s3_endpoint_url or ""):
        label = "r2"

    return S3ObjectStorage(
        endpoint_url=settings.s3_endpoint_url,
        access_key_id=access_key,
        secret_access_key=secret_key,
        bucket=settings.s3_bucket,
        region=settings.s3_region,
        provider_label=label,
    )


def check_object_storage_ready() -> bool:
    try:
        return get_object_storage().ping()
    except Exception:
        return False
