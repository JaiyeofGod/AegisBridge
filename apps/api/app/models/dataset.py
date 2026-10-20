"""Research dataset registry. File bytes are not stored in PostgreSQL."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.organization import Organization


class Dataset(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "datasets"

    organization_id: Mapped[UUID | None] = mapped_column(ForeignKey("organizations.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization | None] = relationship()
    versions: Mapped[list[DatasetVersion]] = relationship(back_populates="dataset")


class DatasetVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "dataset_versions"
    __table_args__ = (UniqueConstraint("dataset_id", "version_label", name="dataset_version"),)

    dataset_id: Mapped[UUID] = mapped_column(ForeignKey("datasets.id"), nullable=False, index=True)
    version_label: Mapped[str] = mapped_column(String(64), nullable=False)

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
    __tablename__ = "dataset_experiments"

    dataset_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("dataset_versions.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    dataset_version: Mapped[DatasetVersion] = relationship(back_populates="experiments")
