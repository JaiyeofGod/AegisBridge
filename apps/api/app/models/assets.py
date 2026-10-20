"""Asset inventory. Criticality and exposure stay separate facts."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.identity import User
    from app.models.organization import Organization


class AssetType(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "asset_types"

    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    assets: Mapped[list[Asset]] = relationship(back_populates="asset_type")


class Asset(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "assets"
    __table_args__ = (UniqueConstraint("organization_id", "hostname", name="asset_hostname"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    asset_type_id: Mapped[UUID] = mapped_column(
        ForeignKey("asset_types.id"), nullable=False, index=True
    )
    human_id: Mapped[str] = human_id_column()
    hostname: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    criticality: Mapped[str] = mapped_column(String(32), nullable=False)
    exposure: Mapped[str] = mapped_column(String(32), nullable=False)
    lifecycle: Mapped[str] = mapped_column(String(32), nullable=False)
    environment_name: Mapped[str] = mapped_column(String(64), nullable=False)
    data_classification: Mapped[str] = mapped_column(String(64), nullable=False)
    platform: Mapped[str | None] = mapped_column(String(64))
    os_version: Mapped[str | None] = mapped_column(String(120))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    telemetry_status: Mapped[str] = mapped_column(String(64), nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organization: Mapped[Organization] = relationship()
    asset_type: Mapped[AssetType] = relationship(back_populates="assets")
    owners: Mapped[list[AssetOwner]] = relationship(back_populates="asset")
    software_links: Mapped[list[AssetSoftware]] = relationship(back_populates="asset")
    data_links: Mapped[list[AssetDataRelationship]] = relationship(back_populates="asset")


class AssetOwner(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "asset_owners"
    __table_args__ = (UniqueConstraint("asset_id", "owner_role", name="asset_owner_role"),)

    asset_id: Mapped[UUID] = mapped_column(ForeignKey("assets.id"), nullable=False, index=True)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    owner_label: Mapped[str] = mapped_column(String(200), nullable=False)
    owner_role: Mapped[str] = mapped_column(String(32), nullable=False)

    asset: Mapped[Asset] = relationship(back_populates="owners")
    user: Mapped[User | None] = relationship()


class SoftwareProduct(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "software_products"
    __table_args__ = (UniqueConstraint("name", "version_label", name="software_name_version"),)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    vendor_name: Mapped[str | None] = mapped_column(String(200))
    version_label: Mapped[str] = mapped_column(String(80), nullable=False)


class AssetSoftware(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "asset_software"
    __table_args__ = (
        UniqueConstraint("asset_id", "software_product_id", name="asset_software_pair"),
    )

    asset_id: Mapped[UUID] = mapped_column(ForeignKey("assets.id"), nullable=False, index=True)
    software_product_id: Mapped[UUID] = mapped_column(
        ForeignKey("software_products.id"), nullable=False, index=True
    )

    asset: Mapped[Asset] = relationship(back_populates="software_links")
    software_product: Mapped[SoftwareProduct] = relationship()


class DataAsset(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "data_assets"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="data_asset_name"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    classification: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization] = relationship()
    asset_links: Mapped[list[AssetDataRelationship]] = relationship(back_populates="data_asset")


class AssetDataRelationship(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "asset_data_relationships"
    __table_args__ = (
        UniqueConstraint("asset_id", "data_asset_id", "relationship_kind", name="asset_data"),
    )

    asset_id: Mapped[UUID] = mapped_column(ForeignKey("assets.id"), nullable=False, index=True)
    data_asset_id: Mapped[UUID] = mapped_column(
        ForeignKey("data_assets.id"), nullable=False, index=True
    )
    relationship_kind: Mapped[str] = mapped_column(String(32), nullable=False)

    asset: Mapped[Asset] = relationship(back_populates="data_links")
    data_asset: Mapped[DataAsset] = relationship(back_populates="asset_links")
