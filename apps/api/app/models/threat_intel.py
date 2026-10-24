"""Threat-intelligence sources and indicators.

Seeded rows are simulated. ThreatFox and URLhaus rows are untrusted feed
observations, not compromise claims.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.assets import Asset
    from app.models.detection import AttackTechnique
    from app.models.organization import Organization


class ThreatIntelSource(UUIDMixin, TimestampMixin, Base):
    """Catalog row for a feed. connection_status records whether it is connected."""

    __tablename__ = "threat_intel_sources"
    __table_args__ = (
        CheckConstraint(
            "connection_status IN ('configured', 'reference_only', 'not_connected', "
            "'delayed', 'healthy')",
            name="connection_status",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    human_id: Mapped[str] = human_id_column()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    connection_status: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization] = relationship()
    indicators: Mapped[list[ThreatIndicator]] = relationship(back_populates="source")
    advisories: Mapped[list[ThreatAdvisory]] = relationship(back_populates="source")


class ThreatIndicator(UUIDMixin, TimestampMixin, Base):
    """One indicator observation from one source.

    The same normalized value from ThreatFox and URLhaus stays as two rows.
    ``confidence`` is only the seeded high/medium/low label. Feed confidence,
    when a source actually provides one, is ``source_confidence``.
    """

    __tablename__ = "threat_indicators"
    __table_args__ = (
        CheckConstraint(
            "indicator_type IN ('ip', 'domain', 'url', 'file_hash')",
            name="indicator_type",
        ),
        CheckConstraint(
            "indicator_subtype IN "
            "('ipv4', 'ipv6', 'domain', 'hostname', 'url', 'md5', 'sha1', 'sha256')",
            name="subtype",
        ),
        CheckConstraint(
            "status IN ('active', 'expired', 'retracted')",
            name="status",
        ),
        CheckConstraint(
            "confidence IN ('high', 'medium', 'low')",
            name="confidence",
        ),
        CheckConstraint(
            "source_confidence IS NULL OR (source_confidence >= 0 AND source_confidence <= 100)",
            name="source_confidence",
        ),
        UniqueConstraint(
            "source_id",
            "indicator_subtype",
            "normalized_value",
            name="source_indicator",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    source_id: Mapped[UUID] = mapped_column(
        ForeignKey("threat_intel_sources.id"), nullable=False, index=True
    )
    matched_asset_id: Mapped[UUID | None] = mapped_column(ForeignKey("assets.id"), index=True)
    attack_technique_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("attack_techniques.id"), index=True
    )
    human_id: Mapped[str] = human_id_column()
    indicator_type: Mapped[str] = mapped_column(String(32), nullable=False)
    indicator_subtype: Mapped[str] = mapped_column(String(16), nullable=False)
    value: Mapped[str] = mapped_column(String(2048), nullable=False)
    normalized_value: Mapped[str] = mapped_column(String(2048), nullable=False)
    confidence: Mapped[str | None] = mapped_column(String(32))
    severity: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    internal_match: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    source_record_id: Mapped[str | None] = mapped_column(String(64))
    threat_type: Mapped[str | None] = mapped_column(String(64))
    malware_family: Mapped[str | None] = mapped_column(String(120))
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)),
        nullable=False,
        default=list,
        server_default="{}",
    )
    source_confidence: Mapped[int | None] = mapped_column(Integer)
    source_status: Mapped[str | None] = mapped_column(String(32))
    reference_url: Mapped[str | None] = mapped_column(String(500))
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organization: Mapped[Organization] = relationship()
    source: Mapped[ThreatIntelSource] = relationship(back_populates="indicators")
    matched_asset: Mapped[Asset | None] = relationship()
    attack_technique: Mapped[AttackTechnique | None] = relationship()


class ThreatAdvisory(UUIDMixin, TimestampMixin, Base):
    """Stored advisory metadata. This table is not an external advisory feed."""

    __tablename__ = "threat_advisories"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    source_id: Mapped[UUID] = mapped_column(
        ForeignKey("threat_intel_sources.id"), nullable=False, index=True
    )
    human_id: Mapped[str] = human_id_column()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[str | None] = mapped_column(String(32))
    related_cve: Mapped[str | None] = mapped_column(String(32))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organization: Mapped[Organization] = relationship()
    source: Mapped[ThreatIntelSource] = relationship(back_populates="advisories")
