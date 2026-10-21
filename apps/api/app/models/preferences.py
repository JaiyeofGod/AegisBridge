"""Per-user UI preferences. Appearance is stored; theme application is client-side."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.identity import User


class UserPreferences(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "user_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_preferences_user_id"),
        CheckConstraint("theme IN ('system', 'dark', 'light')", name="theme"),
        CheckConstraint("density IN ('comfortable', 'compact')", name="density"),
        CheckConstraint("landing_page IN ('overview')", name="landing_page"),
    )

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    theme: Mapped[str] = mapped_column(String(16), nullable=False)
    density: Mapped[str] = mapped_column(String(16), nullable=False)
    landing_page: Mapped[str] = mapped_column(String(32), nullable=False)
    reduced_motion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user: Mapped[User] = relationship()
