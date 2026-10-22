"""Policy records and acknowledgements."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.grc import Control
    from app.models.identity import User
    from app.models.organization import Organization


class Policy(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "policies"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    owner_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)

    organization: Mapped[Organization] = relationship()
    owner: Mapped[User | None] = relationship()
    versions: Mapped[list[PolicyVersion]] = relationship(
        back_populates="policy",
        order_by="PolicyVersion.created_at",
    )
    control_links: Mapped[list[PolicyControlMapping]] = relationship(
        back_populates="policy",
        order_by="PolicyControlMapping.created_at",
    )


class PolicyVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "policy_versions"
    __table_args__ = (UniqueConstraint("policy_id", "version_label", name="policy_version"),)

    policy_id: Mapped[UUID] = mapped_column(ForeignKey("policies.id"), nullable=False, index=True)
    version_label: Mapped[str] = mapped_column(String(32), nullable=False)
    body_summary: Mapped[str] = mapped_column(Text, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), nullable=False, server_default=text("'draft'"))
    is_current: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))

    policy: Mapped[Policy] = relationship(back_populates="versions")
    acknowledgements: Mapped[list[PolicyAcknowledgement]] = relationship(
        back_populates="policy_version"
    )


class PolicyAcknowledgement(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "policy_acknowledgements"
    __table_args__ = (UniqueConstraint("policy_version_id", "user_id", name="policy_ack"),)

    policy_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("policy_versions.id"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    acknowledged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    policy_version: Mapped[PolicyVersion] = relationship(back_populates="acknowledgements")
    user: Mapped[User] = relationship()


class PolicyControlMapping(UUIDMixin, TimestampMixin, Base):
    """Relationship-only link between a policy and a control. No control text is stored."""

    __tablename__ = "policy_control_mappings"
    __table_args__ = (UniqueConstraint("policy_id", "control_id", name="policy_control"),)

    policy_id: Mapped[UUID] = mapped_column(ForeignKey("policies.id"), nullable=False, index=True)
    control_id: Mapped[UUID] = mapped_column(ForeignKey("controls.id"), nullable=False, index=True)

    policy: Mapped[Policy] = relationship(back_populates="control_links")
    control: Mapped[Control] = relationship()
