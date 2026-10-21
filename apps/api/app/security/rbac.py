"""Centralized role and permission checks for FastAPI dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.security.permissions import (
    PRIVILEGED_ROLES,
    is_privileged,
    permissions_for_roles,
)


@dataclass(frozen=True, slots=True)
class AuthenticatedPrincipal:
    """Safe current-user context for authorization and Account responses."""

    user_id: UUID
    human_id: str
    email: str
    display_name: str
    account_status: str
    department: str | None
    organization_name: str
    organization_slug: str
    environment_label: str
    data_origin: str
    roles: tuple[str, ...]
    permissions: tuple[str, ...]
    privileged: bool
    session_human_id: str
    session_created_at: datetime
    session_expires_at: datetime
    session_last_seen_at: datetime
    timezone_name: str
    job_title: str | None
    created_at: datetime

    def has_role(self, role: str) -> bool:
        return role in self.roles

    def has_any_role(self, *roles: str) -> bool:
        return any(role in self.roles for role in roles)

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions

    def has_any_permission(self, *permissions: str) -> bool:
        return any(code in self.permissions for code in permissions)


def resolve_roles(role_names: list[str]) -> tuple[str, ...]:
    return tuple(sorted(role_names))


def resolve_permissions(role_names: list[str] | tuple[str, ...]) -> tuple[str, ...]:
    return tuple(permissions_for_roles(role_names))


def resolve_privileged(role_names: list[str] | tuple[str, ...]) -> bool:
    return is_privileged(role_names)


__all__ = [
    "AuthenticatedPrincipal",
    "PRIVILEGED_ROLES",
    "resolve_permissions",
    "resolve_privileged",
    "resolve_roles",
]
