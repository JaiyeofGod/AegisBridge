"""Identity catalog. Authentication secrets and sessions are intentionally absent."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, human_id_column

if TYPE_CHECKING:
    from app.models.organization import Department, Organization


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("organization_id", "email", name="user_email"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    department_id: Mapped[UUID | None] = mapped_column(ForeignKey("departments.id"), index=True)
    human_id: Mapped[str] = human_id_column()
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    job_title: Mapped[str | None] = mapped_column(String(160))
    account_status: Mapped[str] = mapped_column(String(32), nullable=False)
    timezone_name: Mapped[str] = mapped_column(String(64), nullable=False)

    organization: Mapped[Organization] = relationship()
    department: Mapped[Department | None] = relationship()
    role_links: Mapped[list[UserRole]] = relationship(back_populates="user")


class Role(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="role_name"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)

    organization: Mapped[Organization] = relationship()
    user_links: Mapped[list[UserRole]] = relationship(back_populates="role")


class Permission(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)


class UserRole(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="user_role"),)

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role_id: Mapped[UUID] = mapped_column(ForeignKey("roles.id"), nullable=False, index=True)

    user: Mapped[User] = relationship(back_populates="role_links")
    role: Mapped[Role] = relationship(back_populates="user_links")


class AccessEntitlement(UUIDMixin, TimestampMixin, Base):
    """Permission label granted to a user. Not an authorization check."""

    __tablename__ = "access_entitlements"
    __table_args__ = (UniqueConstraint("user_id", "permission_id", name="user_permission"),)

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    permission_id: Mapped[UUID] = mapped_column(
        ForeignKey("permissions.id"), nullable=False, index=True
    )
    grant_source: Mapped[str] = mapped_column(String(32), nullable=False)

    user: Mapped[User] = relationship()
    permission: Mapped[Permission] = relationship()


class AccessReview(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "access_reviews"

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"), nullable=False, index=True
    )
    human_id: Mapped[str] = human_id_column()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    organization: Mapped[Organization] = relationship()
    findings: Mapped[list[AccessReviewFinding]] = relationship(back_populates="review")


class AccessReviewFinding(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "access_review_findings"

    access_review_id: Mapped[UUID] = mapped_column(
        ForeignKey("access_reviews.id"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    finding: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)

    review: Mapped[AccessReview] = relationship(back_populates="findings")
    user: Mapped[User] = relationship()
