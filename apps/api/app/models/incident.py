"""Incident response records. Severity and lifecycle status are separate."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.evidence import Evidence
    from app.models.identity import User
    from app.models.organization import Organization


class Incident(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "incidents"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    owner_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)

    organization: Mapped[Organization] = relationship()
    owner: Mapped[User | None] = relationship()
    events: Mapped[list[IncidentEvent]] = relationship(back_populates="incident")
    tasks: Mapped[list[IncidentTask]] = relationship(back_populates="incident")
    indicators: Mapped[list[IncidentIndicator]] = relationship(back_populates="incident")
    evidence_links: Mapped[list[IncidentEvidence]] = relationship(back_populates="incident")


class IncidentEvent(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "incident_events"

    incident_id: Mapped[UUID] = mapped_column(
        ForeignKey("incidents.id"), nullable=False, index=True
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    incident: Mapped[Incident] = relationship(back_populates="events")


class IncidentTask(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "incident_tasks"

    incident_id: Mapped[UUID] = mapped_column(
        ForeignKey("incidents.id"), nullable=False, index=True
    )
    assignee_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)

    incident: Mapped[Incident] = relationship(back_populates="tasks")
    assignee: Mapped[User | None] = relationship()


class IncidentIndicator(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "incident_indicators"

    incident_id: Mapped[UUID] = mapped_column(
        ForeignKey("incidents.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    value: Mapped[str] = mapped_column(String(500), nullable=False)
    confidence: Mapped[str] = mapped_column(String(32), nullable=False)

    incident: Mapped[Incident] = relationship(back_populates="indicators")


class IncidentEvidence(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "incident_evidence"
    __table_args__ = (
        UniqueConstraint("incident_id", "evidence_id", name="incident_evidence_pair"),
    )

    incident_id: Mapped[UUID] = mapped_column(
        ForeignKey("incidents.id"), nullable=False, index=True
    )
    evidence_id: Mapped[UUID] = mapped_column(ForeignKey("evidence.id"), nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text)

    incident: Mapped[Incident] = relationship(back_populates="evidence_links")
    evidence: Mapped[Evidence] = relationship()
