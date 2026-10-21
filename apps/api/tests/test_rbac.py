"""Role and permission resolution tests."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.api.deps import (
    get_current_principal,
    require_any_permission,
    require_permissions,
    require_roles,
)
from app.api.errors import ApiError
from app.security.permissions import (
    PERMISSION_CATALOG,
    PRIVILEGED_ROLES,
    ROLE_PERMISSIONS,
    SEVEN_ROLES,
    is_privileged,
    permissions_for_roles,
)
from app.security.rbac import AuthenticatedPrincipal

require_admin = require_roles("Administrator")
require_risk_accept = require_permissions("risk.accept")
require_risk_or_asset = require_any_permission("risk.accept", "asset.read")


def test_seven_roles_and_catalog_are_complete() -> None:
    assert set(SEVEN_ROLES) == set(ROLE_PERMISSIONS)
    assert len(SEVEN_ROLES) == 7
    assert "Administrator" in SEVEN_ROLES
    assert "Security Engineer" in SEVEN_ROLES
    for codes in ROLE_PERMISSIONS.values():
        assert codes <= set(PERMISSION_CATALOG)


def test_privileged_semantics() -> None:
    assert is_privileged(["Administrator"]) is True
    assert is_privileged(["Security Engineer"]) is True
    assert is_privileged(["CISO"]) is False
    assert is_privileged(["GRC Analyst", "Auditor"]) is False
    assert set(PRIVILEGED_ROLES) == {"Administrator", "Security Engineer"}


def test_effective_permissions_union_roles() -> None:
    codes = permissions_for_roles(["SOC Analyst", "Auditor"])
    assert "incident.close" in codes
    assert "evidence.download" in codes
    assert "user.role.manage" not in codes


def _principal(*, roles: list[str], permissions: list[str] | None = None) -> AuthenticatedPrincipal:
    now = datetime.now(UTC)
    resolved = permissions if permissions is not None else permissions_for_roles(roles)
    return AuthenticatedPrincipal(
        user_id=uuid4(),
        human_id="USR-TEST",
        email="test@aegisbridge.example",
        display_name="Test User",
        account_status="active",
        department="Security",
        organization_name="AegisBridge Technologies",
        organization_slug="aegisbridge-technologies",
        environment_label="Lab · Simulated",
        data_origin="simulated",
        roles=tuple(sorted(roles)),
        permissions=tuple(resolved),
        privileged=is_privileged(roles),
        session_human_id="SES-TEST",
        session_created_at=now,
        session_expires_at=now,
        session_last_seen_at=now,
        timezone_name="UTC",
        job_title=None,
        created_at=now,
    )


def test_required_role_and_permission_helpers() -> None:
    read_only = _principal(roles=["Read Only"])
    admin = _principal(roles=["Administrator"])

    with pytest.raises(ApiError) as forbidden_role:
        require_admin(read_only)
    assert forbidden_role.value.status_code == 403

    with pytest.raises(ApiError) as forbidden_perm:
        require_risk_accept(read_only)
    assert forbidden_perm.value.status_code == 403

    assert require_risk_or_asset(read_only).human_id == "USR-TEST"
    assert require_admin(admin).human_id == "USR-TEST"
    assert require_risk_accept(admin).human_id == "USR-TEST"


def test_unauthenticated_is_401_for_account_style_dependency() -> None:
    with pytest.raises(ApiError) as excinfo:
        get_current_principal(None)  # type: ignore[arg-type]
    assert excinfo.value.status_code == 401
