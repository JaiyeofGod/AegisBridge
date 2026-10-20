"""Report definition catalog. Generated files and schedulers are not stored here."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.identity import User
    from app.models.organization import Organization


class ReportDefinition(UUIDMixin, TimestampMixin, Base):
    """Saved report definition. last_run_at is null until an execution is stored."""

    __tablename__ = "report_definitions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'ready', 'review', 'archived')",
            name="status",
        ),
        CheckConstraint(
            "schedule_state IN ('not_scheduled', 'schedule_defined')",
            name="schedule_state",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    owner_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    report_type: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    schedule_state: Mapped[str] = mapped_column(String(32), nullable=False)
    schedule_label: Mapped[str | None] = mapped_column(String(64))
    format_label: Mapped[str | None] = mapped_column(String(64))
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organization: Mapped[Organization] = relationship()
    owner: Mapped[User | None] = relationship()
