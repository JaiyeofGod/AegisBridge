"""Research dataset registry. File bytes are not stored in PostgreSQL."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.organization import Organization


class Dataset(UUIDMixin, TimestampMixin, Base):
    """Registry metadata. Status and verification_status are stored labels only."""

    __tablename__ = "datasets"

    organization_id: Mapped[UUID | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    publisher: Mapped[str | None] = mapped_column(String(200))
    source_label: Mapped[str | None] = mapped_column(String(200))
    source_url: Mapped[str | None] = mapped_column(String(500))
    publication_year: Mapped[int | None] = mapped_column(Integer)
    domain: Mapped[str | None] = mapped_column(String(200))
    license_label: Mapped[str | None] = mapped_column(String(120))
    verification_status: Mapped[str | None] = mapped_column(String(64))
    purpose: Mapped[str | None] = mapped_column(Text)
    size_label: Mapped[str | None] = mapped_column(String(120))
    row_count: Mapped[int | None] = mapped_column(BigInteger)
    feature_count: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization | None] = relationship()
    versions: Mapped[list[DatasetVersion]] = relationship(back_populates="dataset")


class DatasetVersion(UUIDMixin, TimestampMixin, Base):
    """One catalog or ingested revision. Raw rows are not stored."""

    __tablename__ = "dataset_versions"
    __table_args__ = (
        UniqueConstraint("dataset_id", "version_label", name="dataset_version"),
        CheckConstraint(
            "ingestion_status IS NULL OR ingestion_status IN "
            "('downloading', 'validating', 'ready', 'failed')",
            name="ingestion_status",
        ),
        CheckConstraint(
            "validation_status IS NULL OR validation_status IN ('passed', 'failed')",
            name="validation_status",
        ),
        CheckConstraint(
            "artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$'",
            name="artifact_sha256_hex",
        ),
    )

    dataset_id: Mapped[UUID] = mapped_column(ForeignKey("datasets.id"), nullable=False, index=True)
    version_label: Mapped[str] = mapped_column(String(64), nullable=False)
    source_type: Mapped[str | None] = mapped_column(String(32))
    source_revision: Mapped[str | None] = mapped_column(String(64))
    source_reference: Mapped[str | None] = mapped_column(String(500))
    ingestion_status: Mapped[str | None] = mapped_column(String(32))
    validation_status: Mapped[str | None] = mapped_column(String(32))
    ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    row_count: Mapped[int | None] = mapped_column(BigInteger)
    column_count: Mapped[int | None] = mapped_column(Integer)
    byte_size: Mapped[int | None] = mapped_column(BigInteger)
    artifact_sha256: Mapped[str | None] = mapped_column(String(64))
    profile: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    error_summary: Mapped[str | None] = mapped_column(String(500))

    dataset: Mapped[Dataset] = relationship(back_populates="versions")
    files: Mapped[list[DatasetFile]] = relationship(back_populates="dataset_version")
    experiments: Mapped[list[DatasetExperiment]] = relationship(back_populates="dataset_version")


class DatasetFile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "dataset_files"
    __table_args__ = (
        CheckConstraint(
            "sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'",
            name="sha256_hex",
        ),
    )

    dataset_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("dataset_versions.id"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    storage_uri: Mapped[str | None] = mapped_column(String(500))

    dataset_version: Mapped[DatasetVersion] = relationship(back_populates="files")


class DatasetExperiment(UUIDMixin, TimestampMixin, Base):
    """Experiment metadata. Model bytes stay in private object storage."""

    __tablename__ = "dataset_experiments"
    __table_args__ = (
        CheckConstraint(
            "model_sha256 IS NULL OR model_sha256 ~ '^[0-9a-f]{64}$'",
            name="model_sha256_hex",
        ),
        CheckConstraint(
            "vocabulary_sha256 IS NULL OR vocabulary_sha256 ~ '^[0-9a-f]{64}$'",
            name="vocabulary_sha256_hex",
        ),
        CheckConstraint(
            "manifest_sha256 IS NULL OR manifest_sha256 ~ '^[0-9a-f]{64}$'",
            name="manifest_sha256_hex",
        ),
    )

    dataset_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("dataset_versions.id"), nullable=False, index=True
    )
    human_id: Mapped[str | None] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    experiment_type: Mapped[str | None] = mapped_column(String(80))
    approach: Mapped[str | None] = mapped_column(String(200))
    metrics_summary: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    config: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    metrics: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    model_sha256: Mapped[str | None] = mapped_column(String(64))
    vocabulary_sha256: Mapped[str | None] = mapped_column(String(64))
    manifest_sha256: Mapped[str | None] = mapped_column(String(64))
    private_artifacts: Mapped[dict[str, object] | None] = mapped_column(JSONB)

    dataset_version: Mapped[DatasetVersion] = relationship(back_populates="experiments")
