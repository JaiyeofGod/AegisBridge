"""Organization structure."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Organization(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    environment_label: Mapped[str] = mapped_column(String(80), nullable=False)
    data_origin: Mapped[str] = mapped_column(String(32), nullable=False, default="simulated")

    departments: Mapped[list[Department]] = relationship(back_populates="organization")
    business_processes: Mapped[list[BusinessProcess]] = relationship(back_populates="organization")


class Department(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="department_name"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="departments")
    business_processes: Mapped[list[BusinessProcess]] = relationship(back_populates="department")


class BusinessProcess(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "business_processes"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="process_name"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    department_id: Mapped[UUID | None] = mapped_column(ForeignKey("departments.id"), index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization] = relationship(back_populates="business_processes")
    department: Mapped[Department | None] = relationship(back_populates="business_processes")
