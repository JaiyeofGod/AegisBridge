"""Evidence metadata. File bytes stay in object storage, not PostgreSQL."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.grc import Control
    from app.models.identity import User
    from app.models.organization import Organization
    from app.models.risk import Risk


class Evidence(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "evidence"
    __table_args__ = (
        CheckConstraint(
            "sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'",
            name="sha256_hex",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    collected_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    version_label: Mapped[str] = mapped_column(String(32), nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    mime_type: Mapped[str | None] = mapped_column(String(120))
    object_uri: Mapped[str | None] = mapped_column(String(500))
    data_classification: Mapped[str] = mapped_column(String(64), nullable=False)
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organization: Mapped[Organization] = relationship()
    collected_by: Mapped[User | None] = relationship()
    control_links: Mapped[list[EvidenceControlLink]] = relationship(back_populates="evidence")
    risk_links: Mapped[list[EvidenceRiskLink]] = relationship(back_populates="evidence")
    stored_object: Mapped[EvidenceObject | None] = relationship(
        back_populates="evidence",
        uselist=False,
    )


class EvidenceObject(UUIDMixin, TimestampMixin, Base):
    """Private object-storage metadata for one evidence file. Bytes stay outside PostgreSQL."""

    __tablename__ = "evidence_objects"
    __table_args__ = (
        CheckConstraint(
            "sha256 ~ '^[0-9a-f]{64}$'",
            name="evidence_object_sha256_hex",
        ),
        UniqueConstraint("evidence_id", name="uq_evidence_objects_evidence_id"),
    )

    evidence_id: Mapped[UUID] = mapped_column(ForeignKey("evidence.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    bucket: Mapped[str] = mapped_column(String(200), nullable=False)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(200), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    stored_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    evidence: Mapped[Evidence] = relationship(back_populates="stored_object")


class EvidenceControlLink(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "evidence_control_links"
    __table_args__ = (UniqueConstraint("evidence_id", "control_id", name="evidence_control"),)

    evidence_id: Mapped[UUID] = mapped_column(ForeignKey("evidence.id"), nullable=False, index=True)
    control_id: Mapped[UUID] = mapped_column(ForeignKey("controls.id"), nullable=False, index=True)

    evidence: Mapped[Evidence] = relationship(back_populates="control_links")
    control: Mapped[Control] = relationship()


class EvidenceRiskLink(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "evidence_risk_links"
    __table_args__ = (UniqueConstraint("evidence_id", "risk_id", name="evidence_risk"),)

    evidence_id: Mapped[UUID] = mapped_column(ForeignKey("evidence.id"), nullable=False, index=True)
    risk_id: Mapped[UUID] = mapped_column(ForeignKey("risks.id"), nullable=False, index=True)

    evidence: Mapped[Evidence] = relationship(back_populates="risk_links")
    risk: Mapped[Risk] = relationship()
