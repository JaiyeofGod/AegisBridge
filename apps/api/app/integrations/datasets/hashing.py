"""Chunked SHA-256. This is an integrity hash, not a signature check."""

from __future__ import annotations

import hashlib
from pathlib import Path

_CHUNK = 1024 * 1024


def file_sha256(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(_CHUNK)
            if not chunk:
                break
            size += len(chunk)
            digest.update(chunk)
    return digest.hexdigest(), size


def manifest_sha256(rows: tuple[tuple[str, str, int], ...]) -> str:
    """Hash the sorted name, content hash, and size lines for one revision."""
    digest = hashlib.sha256()
    for name, content_hash, size in sorted(rows):
        digest.update(f"{name} {content_hash} {size}\n".encode())
    return digest.hexdigest()
