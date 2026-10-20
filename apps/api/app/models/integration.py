"""Integration catalog and sync state. Credentials are not stored."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.organization import Organization


class Integration(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "integrations"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    human_id: Mapped[str | None] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    auth_state: Mapped[str] = mapped_column(String(120), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization] = relationship()
    sync_jobs: Mapped[list[SyncJob]] = relationship(back_populates="integration")
    sync_state: Mapped[SyncState | None] = relationship(back_populates="integration")


class SyncJob(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sync_jobs"

    integration_id: Mapped[UUID] = mapped_column(
        ForeignKey("integrations.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    integration: Mapped[Integration] = relationship(back_populates="sync_jobs")


class SyncState(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sync_states"

    integration_id: Mapped[UUID] = mapped_column(
        ForeignKey("integrations.id"), nullable=False, unique=True
    )
    freshness: Mapped[str] = mapped_column(String(64), nullable=False)
    cursor_label: Mapped[str | None] = mapped_column(String(120))
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    integration: Mapped[Integration] = relationship(back_populates="sync_state")
