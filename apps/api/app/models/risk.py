"""Internal likelihood × impact risk register. This is not a mandated NIST formula."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.assets import Asset
    from app.models.identity import User
    from app.models.organization import Organization

_RANGE = "BETWEEN 1 AND 5"


class Risk(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "risks"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    asset_id: Mapped[UUID | None] = mapped_column(ForeignKey("assets.id"), index=True)
    owner_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    methodology: Mapped[str] = mapped_column(String(64), nullable=False)

    organization: Mapped[Organization] = relationship()
    asset: Mapped[Asset | None] = relationship()
    owner: Mapped[User | None] = relationship()
    assessments: Mapped[list[RiskAssessment]] = relationship(back_populates="risk")
    treatments: Mapped[list[RiskTreatment]] = relationship(back_populates="risk")
    reviews: Mapped[list[RiskReview]] = relationship(back_populates="risk")


class RiskAssessment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "risk_assessments"
    __table_args__ = (
        CheckConstraint(f"likelihood {_RANGE}", name="likelihood_range"),
        CheckConstraint(f"impact {_RANGE}", name="impact_range"),
        CheckConstraint(
            f"residual_likelihood IS NULL OR residual_likelihood {_RANGE}",
            name="residual_likelihood_range",
        ),
        CheckConstraint(
            f"residual_impact IS NULL OR residual_impact {_RANGE}",
            name="residual_impact_range",
        ),
    )

    risk_id: Mapped[UUID] = mapped_column(ForeignKey("risks.id"), nullable=False, index=True)
    likelihood: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    impact: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    score: Mapped[int] = mapped_column(
        Integer,
        Computed("likelihood * impact", persisted=True),
        nullable=False,
    )
    residual_likelihood: Mapped[int | None] = mapped_column(SmallInteger)
    residual_impact: Mapped[int | None] = mapped_column(SmallInteger)
    residual_score: Mapped[int | None] = mapped_column(
        Integer,
        Computed(
            "CASE WHEN residual_likelihood IS NULL OR residual_impact IS NULL "
            "THEN NULL ELSE residual_likelihood * residual_impact END",
            persisted=True,
        ),
    )
    is_current: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    assessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    risk: Mapped[Risk] = relationship(back_populates="assessments")


class RiskTreatment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "risk_treatments"
    __table_args__ = (
        CheckConstraint(
            "strategy IN ('accept', 'avoid', 'mitigate', 'transfer')",
            name="strategy",
        ),
    )

    risk_id: Mapped[UUID] = mapped_column(ForeignKey("risks.id"), nullable=False, index=True)
    strategy: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    risk: Mapped[Risk] = relationship(back_populates="treatments")


class RiskReview(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "risk_reviews"

    risk_id: Mapped[UUID] = mapped_column(ForeignKey("risks.id"), nullable=False, index=True)
    reviewer_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    risk: Mapped[Risk] = relationship(back_populates="reviews")
    reviewer: Mapped[User | None] = relationship()
