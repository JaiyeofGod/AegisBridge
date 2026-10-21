"""Synchronizer CSRF tokens bound to server sessions.

Raw CSRF tokens are never persisted; only SHA-256 digests are stored on the
session row. Tokens are distinct from session cookie values.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

CSRF_HEADER_NAME = "X-CSRF-Token"


def generate_csrf_token() -> str:
    """CSPRNG token (~256 bits). Distinct from the session cookie value."""
    return secrets.token_urlsafe(32)


def digest_csrf_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def csrf_tokens_match(*, provided: str, expected_digest: str | None) -> bool:
    if expected_digest is None or expected_digest.strip() == "":
        return False
    if provided.strip() == "":
        return False
    return hmac.compare_digest(digest_csrf_token(provided.strip()), expected_digest)
