"""Framework catalog and organization control records."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.identity import User
    from app.models.organization import Organization


class Framework(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "frameworks"

    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)

    versions: Mapped[list[FrameworkVersion]] = relationship(back_populates="framework")


class FrameworkVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "framework_versions"
    __table_args__ = (UniqueConstraint("framework_id", "version_label", name="framework_version"),)

    framework_id: Mapped[UUID] = mapped_column(
        ForeignKey("frameworks.id"), nullable=False, index=True
    )
    version_label: Mapped[str] = mapped_column(String(64), nullable=False)
    is_current: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))

    framework: Mapped[Framework] = relationship(back_populates="versions")
    controls: Mapped[list[Control]] = relationship(back_populates="framework_version")


class Control(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "controls"
    __table_args__ = (UniqueConstraint("organization_id", "control_code", name="org_control_code"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    framework_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("framework_versions.id"), nullable=False, index=True
    )
    human_id: Mapped[str] = human_id_column()
    control_code: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    family: Mapped[str | None] = mapped_column(String(64))

    organization: Mapped[Organization] = relationship()
    framework_version: Mapped[FrameworkVersion] = relationship(back_populates="controls")
    implementations: Mapped[list[ControlImplementation]] = relationship(back_populates="control")
    tests: Mapped[list[ControlTest]] = relationship(back_populates="control")


class ControlMapping(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "control_mappings"
    __table_args__ = (
        UniqueConstraint("source_control_id", "target_control_id", name="control_map"),
    )

    source_control_id: Mapped[UUID] = mapped_column(
        ForeignKey("controls.id"), nullable=False, index=True
    )
    target_control_id: Mapped[UUID] = mapped_column(
        ForeignKey("controls.id"), nullable=False, index=True
    )
    mapping_type: Mapped[str] = mapped_column(String(32), nullable=False)

    source_control: Mapped[Control] = relationship(foreign_keys=[source_control_id])
    target_control: Mapped[Control] = relationship(foreign_keys=[target_control_id])


class ControlImplementation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "control_implementations"

    control_id: Mapped[UUID] = mapped_column(ForeignKey("controls.id"), nullable=False, index=True)
    owner_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    control: Mapped[Control] = relationship(back_populates="implementations")
    owner: Mapped[User | None] = relationship()


class ControlTest(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "control_tests"

    control_id: Mapped[UUID] = mapped_column(ForeignKey("controls.id"), nullable=False, index=True)
    tester_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    result: Mapped[str] = mapped_column(String(32), nullable=False)
    tested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    control: Mapped[Control] = relationship(back_populates="tests")
    tester: Mapped[User | None] = relationship()
