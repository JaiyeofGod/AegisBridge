"""Pinned MITRE ATT&CK Enterprise catalog. Separate from local detection references."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class AttackRelease(UUIDMixin, TimestampMixin, Base):
    """One imported ATT&CK domain release. Lookups use the active row."""

    __tablename__ = "attack_releases"
    __table_args__ = (
        UniqueConstraint("domain", "version", name="domain_version"),
        CheckConstraint("domain IN ('enterprise')", name="domain"),
        CheckConstraint("bundle_sha256 ~ '^[0-9a-f]{64}$'", name="bundle_sha256_hex"),
        Index(
            "uq_attack_releases_one_active",
            "domain",
            unique=True,
            postgresql_where=text("active"),
        ),
    )

    domain: Mapped[str] = mapped_column(String(32), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    source: Mapped[str] = mapped_column(String(80), nullable=False)
    stix_version: Mapped[str] = mapped_column(String(16), nullable=False)
    bundle_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class AttackCatalogTactic(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "attack_catalog_tactics"
    __table_args__ = (
        UniqueConstraint("release_id", "stix_id", name="release_stix"),
        UniqueConstraint("release_id", "external_id", name="release_external"),
        UniqueConstraint("release_id", "short_name", name="release_short_name"),
    )

    release_id: Mapped[UUID] = mapped_column(
        ForeignKey("attack_releases.id", name="fk_attack_catalog_tactics_release_id"),
        nullable=False,
        index=True,
    )
    stix_id: Mapped[str] = mapped_column(String(160), nullable=False)
    external_id: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    short_name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    object_version: Mapped[str | None] = mapped_column(String(16))
    modified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deprecated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class AttackCatalogTechnique(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "attack_catalog_techniques"
    __table_args__ = (
        UniqueConstraint("release_id", "stix_id", name="release_stix"),
        UniqueConstraint("release_id", "external_id", name="release_external"),
    )

    release_id: Mapped[UUID] = mapped_column(
        ForeignKey("attack_releases.id", name="fk_attack_catalog_techniques_release_id"),
        nullable=False,
        index=True,
    )
    parent_technique_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "attack_catalog_techniques.id",
            name="fk_attack_catalog_techniques_parent_id",
        ),
        index=True,
    )
    stix_id: Mapped[str] = mapped_column(String(160), nullable=False)
    external_id: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_subtechnique: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    platforms: Mapped[list[str]] = mapped_column(
        ARRAY(String(64)),
        nullable=False,
        server_default=text("'{}'"),
    )
    object_version: Mapped[str | None] = mapped_column(String(16))
    modified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deprecated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class AttackCatalogTacticLink(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "attack_catalog_tactic_links"
    __table_args__ = (UniqueConstraint("technique_id", "tactic_id", name="technique_tactic"),)

    technique_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "attack_catalog_techniques.id",
            name="fk_attack_catalog_tactic_links_technique_id",
        ),
        nullable=False,
        index=True,
    )
    tactic_id: Mapped[UUID] = mapped_column(
        ForeignKey("attack_catalog_tactics.id", name="fk_attack_catalog_tactic_links_tactic_id"),
        nullable=False,
        index=True,
    )
