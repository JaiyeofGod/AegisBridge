"""In-memory object storage for unit tests. Not for production."""

from __future__ import annotations

from collections.abc import Iterator
from typing import BinaryIO

from app.api.errors import ApiError
from app.storage.protocol import StoredObjectInfo


class MemoryObjectStorage:
    def __init__(self, *, bucket: str = "aegis-test-evidence") -> None:
        self._bucket = bucket
        self._objects: dict[str, tuple[bytes, str | None]] = {}

    @property
    def provider_label(self) -> str:
        return "memory"

    @property
    def bucket(self) -> str:
        return self._bucket

    def put_file(
        self,
        *,
        object_key: str,
        fileobj: BinaryIO,
        content_type: str | None,
        size_bytes: int,
    ) -> StoredObjectInfo:
        fileobj.seek(0)
        payload = fileobj.read()
        if len(payload) != size_bytes:
            raise ApiError(422, "validation_error", "Uploaded size did not match content.")
        self._objects[object_key] = (payload, content_type)
        return StoredObjectInfo(
            bucket=self._bucket,
            object_key=object_key,
            size_bytes=size_bytes,
            content_type=content_type,
            etag=None,
        )

    def get_stream(self, *, object_key: str) -> tuple[Iterator[bytes], StoredObjectInfo]:
        if object_key not in self._objects:
            raise ApiError(404, "not_found", "Evidence object was not found in storage.")
        payload, content_type = self._objects[object_key]
        info = StoredObjectInfo(
            bucket=self._bucket,
            object_key=object_key,
            size_bytes=len(payload),
            content_type=content_type,
        )

        def iterate() -> Iterator[bytes]:
            yield payload

        return iterate(), info

    def delete(self, *, object_key: str) -> None:
        self._objects.pop(object_key, None)

    def exists(self, *, object_key: str) -> bool:
        return object_key in self._objects

    def ping(self) -> bool:
        return True

    def clear(self) -> None:
        self._objects.clear()
