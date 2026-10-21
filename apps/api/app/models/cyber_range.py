"""Private cyber-range catalog. Development metadata only; no remote lab control."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.detection import AttackTechnique, Detection
    from app.models.organization import Organization


class LabZone(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "lab_zones"
    __table_args__ = (
        CheckConstraint(
            "status IN ('planned', 'defined', 'reference_only')",
            name="ck_lab_zones_status",
        ),
        CheckConstraint(
            "observed_state IN ('not_observed', 'simulated', 'reference_only')",
            name="ck_lab_zones_observed_state",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    human_id: Mapped[str] = human_id_column()
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    cidr: Mapped[str] = mapped_column(String(64), nullable=False)
    gateway: Mapped[str | None] = mapped_column(String(64))
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    observed_state: Mapped[str] = mapped_column(String(32), nullable=False)
    isolation_notes: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization] = relationship()
    systems: Mapped[list[LabSystem]] = relationship(back_populates="zone")


class LabSystem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "lab_systems"
    __table_args__ = (
        CheckConstraint(
            "expected_state IN ('planned', 'approved', 'retired')",
            name="ck_lab_systems_expected_state",
        ),
        CheckConstraint(
            "observed_state IN ("
            "'not_observed', 'simulated_reporting', 'simulated_stopped', 'reference_only'"
            ")",
            name="ck_lab_systems_observed_state",
        ),
        CheckConstraint(
            "telemetry_status IN ('not_connected', 'not_reporting', 'simulated', 'reference_only')",
            name="ck_lab_systems_telemetry_status",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    zone_id: Mapped[UUID] = mapped_column(ForeignKey("lab_zones.id"), nullable=False, index=True)
    human_id: Mapped[str] = human_id_column()
    hostname: Mapped[str] = mapped_column(String(120), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(120), nullable=False)
    platform: Mapped[str | None] = mapped_column(String(120))
    expected_state: Mapped[str] = mapped_column(String(32), nullable=False)
    observed_state: Mapped[str] = mapped_column(String(32), nullable=False)
    telemetry_source: Mapped[str | None] = mapped_column(String(200))
    telemetry_expected: Mapped[bool] = mapped_column(nullable=False, default=True)
    telemetry_status: Mapped[str] = mapped_column(String(32), nullable=False)
    telemetry_freshness: Mapped[str | None] = mapped_column(String(64))
    telemetry_semantics: Mapped[str | None] = mapped_column(Text)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_origin: Mapped[str] = mapped_column(String(64), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization] = relationship()
    zone: Mapped[LabZone] = relationship(back_populates="systems")


class LabScenario(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "lab_scenarios"
    __table_args__ = (
        CheckConstraint(
            "status IN ('planned', 'ready', 'simulated', 'validated', 'retired')",
            name="ck_lab_scenarios_status",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    human_id: Mapped[str] = human_id_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    expected_telemetry: Mapped[str | None] = mapped_column(Text)
    safety_notes: Mapped[str | None] = mapped_column(Text)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization] = relationship()
    systems: Mapped[list[LabScenarioSystem]] = relationship(back_populates="scenario")
    detections: Mapped[list[LabScenarioDetection]] = relationship(back_populates="scenario")
    attack_mappings: Mapped[list[LabScenarioAttackMapping]] = relationship(
        back_populates="scenario"
    )


class LabScenarioSystem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "lab_scenario_systems"
    __table_args__ = (UniqueConstraint("scenario_id", "lab_system_id", name="lab_scenario_system"),)

    scenario_id: Mapped[UUID] = mapped_column(
        ForeignKey("lab_scenarios.id"), nullable=False, index=True
    )
    lab_system_id: Mapped[UUID] = mapped_column(
        ForeignKey("lab_systems.id"), nullable=False, index=True
    )

    scenario: Mapped[LabScenario] = relationship(back_populates="systems")
    lab_system: Mapped[LabSystem] = relationship()


class LabScenarioDetection(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "lab_scenario_detections"
    __table_args__ = (
        UniqueConstraint("scenario_id", "detection_id", name="lab_scenario_detection"),
    )

    scenario_id: Mapped[UUID] = mapped_column(
        ForeignKey("lab_scenarios.id"), nullable=False, index=True
    )
    detection_id: Mapped[UUID] = mapped_column(
        ForeignKey("detections.id"), nullable=False, index=True
    )

    scenario: Mapped[LabScenario] = relationship(back_populates="detections")
    detection: Mapped[Detection] = relationship()


class LabScenarioAttackMapping(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "lab_scenario_attack_mappings"
    __table_args__ = (
        UniqueConstraint(
            "scenario_id",
            "attack_technique_id",
            name="lab_scenario_technique",
        ),
    )

    scenario_id: Mapped[UUID] = mapped_column(
        ForeignKey("lab_scenarios.id"), nullable=False, index=True
    )
    attack_technique_id: Mapped[UUID] = mapped_column(
        ForeignKey("attack_techniques.id"), nullable=False, index=True
    )

    scenario: Mapped[LabScenario] = relationship(back_populates="attack_mappings")
    attack_technique: Mapped[AttackTechnique] = relationship()
