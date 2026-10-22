"""S3-compatible object storage protocol. Provider-agnostic."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import BinaryIO, Protocol, runtime_checkable


@dataclass(frozen=True, slots=True)
class StoredObjectInfo:
    """Safe metadata about a stored object. Never includes credentials."""

    bucket: str
    object_key: str
    size_bytes: int
    content_type: str | None
    etag: str | None = None


@runtime_checkable
class ObjectStorage(Protocol):
    """Private object storage used for evidence bytes."""

    @property
    def provider_label(self) -> str: ...

    @property
    def bucket(self) -> str: ...

    def put_file(
        self,
        *,
        object_key: str,
        fileobj: BinaryIO,
        content_type: str | None,
        size_bytes: int,
    ) -> StoredObjectInfo: ...

    def get_stream(self, *, object_key: str) -> tuple[Iterator[bytes], StoredObjectInfo]: ...

    def delete(self, *, object_key: str) -> None: ...

    def exists(self, *, object_key: str) -> bool: ...

    def ping(self) -> bool: ...
