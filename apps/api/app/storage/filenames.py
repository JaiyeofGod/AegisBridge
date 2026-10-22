"""Safe filename handling for evidence uploads. Never drives object keys."""

from __future__ import annotations

import re
from pathlib import PurePosixPath, PureWindowsPath

from app.api.errors import ApiError

_MAX_FILENAME_LENGTH = 200
_SAFE_CHARS = re.compile(r"[^A-Za-z0-9._+\-()\[\] ]+")


def sanitize_original_filename(raw: str | None) -> str:
    """Return a safe display filename. Rejects path traversal and empty names."""
    if raw is None or raw.strip() == "":
        raise ApiError(422, "validation_error", "A filename is required.")

    candidate = raw.strip().replace("\x00", "")
    # Strip directory components from POSIX and Windows-style paths.
    candidate = PureWindowsPath(candidate).name
    candidate = PurePosixPath(candidate).name
    if candidate in {"", ".", ".."}:
        raise ApiError(422, "validation_error", "Filename is not allowed.")
    if "/" in candidate or "\\" in candidate:
        raise ApiError(422, "validation_error", "Filename must not include path separators.")
    if len(candidate) > _MAX_FILENAME_LENGTH:
        raise ApiError(
            422,
            "validation_error",
            f"Filename must be at most {_MAX_FILENAME_LENGTH} characters.",
        )
    cleaned = _SAFE_CHARS.sub("_", candidate).strip(" .")
    if cleaned in {"", ".", ".."}:
        raise ApiError(422, "validation_error", "Filename is not allowed.")
    return cleaned
