"""Private object-storage abstraction for evidence bytes."""

from app.storage.factory import (
    check_object_storage_ready,
    get_object_storage,
    set_object_storage_override,
)
from app.storage.protocol import ObjectStorage, StoredObjectInfo

__all__ = [
    "ObjectStorage",
    "StoredObjectInfo",
    "check_object_storage_ready",
    "get_object_storage",
    "set_object_storage_override",
]
