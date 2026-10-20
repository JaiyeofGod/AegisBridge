"""Third-party vendor records."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.organization import Organization


class Vendor(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "vendors"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    human_id: Mapped[str] = human_id_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)

    organization: Mapped[Organization] = relationship()
    services: Mapped[list[VendorService]] = relationship(back_populates="vendor")
    assessments: Mapped[list[VendorAssessment]] = relationship(back_populates="vendor")


class VendorService(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "vendor_services"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    vendor: Mapped[Vendor] = relationship(back_populates="services")


class VendorAssessment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "vendor_assessments"

    vendor_id: Mapped[UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False, index=True)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    assessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    vendor: Mapped[Vendor] = relationship(back_populates="assessments")
    findings: Mapped[list[VendorFinding]] = relationship(back_populates="assessment")


class VendorFinding(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "vendor_findings"

    vendor_assessment_id: Mapped[UUID] = mapped_column(
        ForeignKey("vendor_assessments.id"), nullable=False, index=True
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)

    assessment: Mapped[VendorAssessment] = relationship(back_populates="findings")
