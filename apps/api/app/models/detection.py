"""Detection catalog and ATT&CK technique references."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.organization import Organization


class AttackTechnique(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "attack_techniques"

    technique_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    tactic: Mapped[str] = mapped_column(String(80), nullable=False)
    attack_version: Mapped[str] = mapped_column(String(32), nullable=False)


class Detection(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "detections"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    human_id: Mapped[str] = human_id_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)

    organization: Mapped[Organization] = relationship()
    versions: Mapped[list[DetectionVersion]] = relationship(back_populates="detection")
    attack_mappings: Mapped[list[DetectionAttackMapping]] = relationship(back_populates="detection")


class DetectionVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "detection_versions"
    __table_args__ = (UniqueConstraint("detection_id", "version_label", name="detection_version"),)

    detection_id: Mapped[UUID] = mapped_column(
        ForeignKey("detections.id"), nullable=False, index=True
    )
    version_label: Mapped[str] = mapped_column(String(32), nullable=False)
    logic_summary: Mapped[str] = mapped_column(Text, nullable=False)
    is_current: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))

    detection: Mapped[Detection] = relationship(back_populates="versions")
    validation_runs: Mapped[list[ValidationRun]] = relationship(back_populates="detection_version")


class DetectionAttackMapping(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "detection_attack_mappings"
    __table_args__ = (
        UniqueConstraint("detection_id", "attack_technique_id", name="detection_technique"),
    )

    detection_id: Mapped[UUID] = mapped_column(
        ForeignKey("detections.id"), nullable=False, index=True
    )
    attack_technique_id: Mapped[UUID] = mapped_column(
        ForeignKey("attack_techniques.id"), nullable=False, index=True
    )

    detection: Mapped[Detection] = relationship(back_populates="attack_mappings")
    attack_technique: Mapped[AttackTechnique] = relationship()


class ValidationRun(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "validation_runs"

    detection_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("detection_versions.id"), nullable=False, index=True
    )
    result: Mapped[str] = mapped_column(String(32), nullable=False)
    ran_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    detection_version: Mapped[DetectionVersion] = relationship(back_populates="validation_runs")
