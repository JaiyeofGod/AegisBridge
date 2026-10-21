"""Opaque session tokens and digests. Raw tokens are never persisted."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.core.config import Settings


def generate_session_token() -> str:
    """CSPRNG opaque token (~256 bits of entropy via 32 raw bytes, url-safe)."""
    return secrets.token_urlsafe(32)


def digest_session_token(token: str) -> str:
    """One-way SHA-256 hex digest. Store only this value; never the raw token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_session_human_id() -> str:
    return f"SES-{uuid4().hex[:10].upper()}"


def session_expiry(settings: Settings, *, now: datetime | None = None) -> datetime:
    moment = now or datetime.now(UTC)
    return moment + timedelta(seconds=settings.session_ttl_seconds)


def cookie_secure(settings: Settings) -> bool:
    if settings.session_cookie_secure is not None:
        return settings.session_cookie_secure
    return settings.app_env.lower() not in {"local", "development", "dev", "test"}
