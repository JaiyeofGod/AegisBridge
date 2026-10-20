"""Append-oriented audit history. Rows are not given an updated_at column."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.identity import User
    from app.models.organization import Organization


class AuditEvent(UUIDMixin, Base):
    __tablename__ = "audit_events"
    __table_args__ = {
        "comment": "Immutable-style audit history. Do not store secrets in these columns.",
    }

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    actor_label: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    object_type: Mapped[str] = mapped_column(String(80), nullable=False)
    object_id: Mapped[str] = mapped_column(String(80), nullable=False)
    result: Mapped[str] = mapped_column(String(32), nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    environment_name: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization] = relationship()
    actor: Mapped[User | None] = relationship()
