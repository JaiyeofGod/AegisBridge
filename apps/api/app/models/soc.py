"""Selected SOC references. Wazuh remains the system of record for raw alerts."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.assets import Asset
    from app.models.detection import Detection
    from app.models.identity import User
    from app.models.organization import Organization


class AlertReference(UUIDMixin, TimestampMixin, Base):
    """Selected alert metadata. This is not a copy of the Wazuh event database."""

    __tablename__ = "alert_references"
    __table_args__ = (
        CheckConstraint(
            "data_origin IN ('simulated', 'wazuh')",
            name="ck_alert_references_data_origin",
        ),
        Index(
            "uq_alert_references_wazuh_alert",
            "organization_id",
            "wazuh_alert_id",
            unique=True,
            postgresql_where=text("wazuh_alert_id IS NOT NULL"),
        ),
        {"comment": "Selected Wazuh alert metadata and references. Not a raw event store."},
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    asset_id: Mapped[UUID | None] = mapped_column(ForeignKey("assets.id"), index=True)
    detection_id: Mapped[UUID | None] = mapped_column(ForeignKey("detections.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    wazuh_alert_id: Mapped[str | None] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    telemetry_source: Mapped[str] = mapped_column(String(120), nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    data_origin: Mapped[str] = mapped_column(
        String(32), nullable=False, default="simulated", server_default="simulated"
    )
    source_rule_id: Mapped[str | None] = mapped_column(String(32))
    source_rule_level: Mapped[int | None] = mapped_column(Integer)
    source_agent_id: Mapped[str | None] = mapped_column(String(16))
    source_agent_name: Mapped[str | None] = mapped_column(String(128))
    source_manager_name: Mapped[str | None] = mapped_column(String(128))
    source_decoder: Mapped[str | None] = mapped_column(String(64))
    source_src_ip: Mapped[str | None] = mapped_column(String(45))
    source_dst_ip: Mapped[str | None] = mapped_column(String(45))
    source_username: Mapped[str | None] = mapped_column(String(128))
    source_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rule_groups: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)), nullable=False, default=list, server_default=text("'{}'")
    )
    attack_technique_ids: Mapped[list[str]] = mapped_column(
        ARRAY(String(16)), nullable=False, default=list, server_default=text("'{}'")
    )
    attack_tactics: Mapped[list[str]] = mapped_column(
        ARRAY(String(80)), nullable=False, default=list, server_default=text("'{}'")
    )

    organization: Mapped[Organization] = relationship()
    asset: Mapped[Asset | None] = relationship()
    detection: Mapped[Detection | None] = relationship()
    investigations: Mapped[list[Investigation]] = relationship(back_populates="alert_reference")


class Investigation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "investigations"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    alert_reference_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("alert_references.id"), index=True
    )
    assignee_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship()
    alert_reference: Mapped[AlertReference | None] = relationship(back_populates="investigations")
    assignee: Mapped[User | None] = relationship()
