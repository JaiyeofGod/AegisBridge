"""Local password credentials and server-managed sessions.

Password hashes use Argon2id. Session cookies carry opaque tokens; only digests
are stored. Plaintext passwords and raw session tokens never appear here.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.identity import User


class UserCredential(UUIDMixin, TimestampMixin, Base):
    """Local password authentication material for one user."""

    __tablename__ = "user_credentials"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_credentials_user_id"),)

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    algorithm: Mapped[str] = mapped_column(String(32), nullable=False, default="argon2id")

    user: Mapped[User] = relationship()


class AuthSession(UUIDMixin, Base):
    """Server-side session. The cookie value is never stored, only its digest."""

    __tablename__ = "sessions"

    human_id: Mapped[str] = human_id_column()
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    client_host: Mapped[str | None] = mapped_column(String(64))
    csrf_token_digest: Mapped[str | None] = mapped_column(String(64))

    user: Mapped[User] = relationship()
