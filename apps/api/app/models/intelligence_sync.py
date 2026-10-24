"""System records for scheduled intelligence synchronization."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class IntelligenceSyncRun(UUIDMixin, TimestampMixin, Base):
    """One scheduled or worker-triggered intelligence synchronization.

    This is system activity. It is not an audit event attributed to a person.
    Raw feed bodies are not stored.
    """

    __tablename__ = "intelligence_sync_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('running', 'completed', 'partial', 'failed')",
            name="status",
        ),
    )

    sync_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tracked_cve_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    nvd_updated_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    kev_updated_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    epss_updated_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_source_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    threatfox_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    urlhaus_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ioc_inserted_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ioc_updated_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ioc_skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    summary: Mapped[str | None] = mapped_column(String(500))
