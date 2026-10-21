"""Domain route authentication and permission enforcement."""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.auth import AuthSession, UserCredential
from app.models.identity import Role, User, UserRole
from app.models.organization import Organization
from app.security.passwords import hash_password
from app.security.permissions import ROLE_PERMISSIONS, SEVEN_ROLES
from app.security.sessions import digest_session_token

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
ADMIN_EMAIL = "amara.okonkwo@aegisbridge.example"

SEEDED_ROLE_USERS = {
    "Administrator": ("USR-0001", ADMIN_EMAIL),
    "Security Engineer": ("USR-0002", "nia.okeke@aegisbridge.example"),
    "GRC Analyst": ("USR-0003", "priya.shah@aegisbridge.example"),
    "SOC Analyst": ("USR-0004", "jonah.hale@aegisbridge.example"),
    "Auditor": ("USR-0005", "marcus.reid@aegisbridge.example"),
}

ROUTE_PERMISSIONS = [
    ("/api/v1/overview", None),  # authenticated only
    ("/api/v1/assets", "asset.read"),
    ("/api/v1/risks", "risk.read"),
    ("/api/v1/vulnerabilities", "vulnerability.read"),
    ("/api/v1/alerts", "alert.read"),
    ("/api/v1/incidents", "incident.read"),
    ("/api/v1/governance/summary", "control.read"),
    ("/api/v1/threat-intelligence/summary", "threat_intel.read"),
    ("/api/v1/reports/summary", "report.read"),
    ("/api/v1/datasets", "dataset.read"),
    ("/api/v1/dataset-experiments", "dataset.read"),
    ("/api/v1/cyber-range/summary", "cyber_range.read"),
    ("/api/v1/administration/summary", "administration.read"),
]


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    application = create_app()
    with TestClient(application) as test_client:
        yield test_client
    get_settings.cache_clear()
    os.environ.pop("AEGIS_DEV_ADMIN_PASSWORD", None)


def _login(client: TestClient, email: str, password: str = DEV_PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _ensure_password(session, user: User, password: str = DEV_PASSWORD) -> None:
    credential = session.scalar(select(UserCredential).where(UserCredential.user_id == user.id))
    digest = hash_password(password)
    if credential is None:
        session.add(UserCredential(user_id=user.id, password_hash=digest, algorithm="argon2id"))
    else:
        credential.password_hash = digest
        credential.algorithm = "argon2id"


def _ensure_single_role(session, user: User, role_name: str) -> None:
    role = session.scalar(select(Role).where(Role.name == role_name))
    assert role is not None
    session.execute(delete(UserRole).where(UserRole.user_id == user.id))
    session.add(UserRole(user_id=user.id, role_id=role.id))


def _email_for_role(role_name: str) -> str:
    if role_name in SEEDED_ROLE_USERS:
        return SEEDED_ROLE_USERS[role_name][1]
    slug = role_name.lower().replace(" ", ".")
    return f"{slug}@aegisbridge.example"


def prepare_role_login(role_name: str) -> str:
    """Ensure a passworded user holding only ``role_name`` exists; return email."""
    assert role_name in SEVEN_ROLES
    email = _email_for_role(role_name)
    with SessionLocal() as session:
        org = session.scalar(select(Organization).order_by(Organization.name))
        assert org is not None
        user = session.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                organization_id=org.id,
                human_id=f"USR-T{uuid.uuid4().hex[:4].upper()}",
                email=email,
                display_name=f"{role_name} Test",
                job_title=role_name,
                account_status="active",
                timezone_name="UTC",
            )
            session.add(user)
            session.flush()
        user.account_status = "active"
        _ensure_single_role(session, user, role_name)
        _ensure_password(session, user)
        session.commit()
    return email


def login_as_role(client: TestClient, role_name: str) -> None:
    email = prepare_role_login(role_name)
    response = _login(client, email)
    assert response.status_code == 200, response.text


def test_health_remains_public(client: TestClient) -> None:
    assert client.get("/api/v1/health").status_code in {200, 503}
    assert client.get("/api/v1/health/live").status_code == 200


def test_domain_routes_require_authentication(client: TestClient) -> None:
    for path, _permission in ROUTE_PERMISSIONS:
        response = client.get(path)
        assert response.status_code == 401, path
        body = response.json()
        assert body["code"] == "unauthenticated"
        assert "Administrator" not in body["message"]
        assert "permission" not in body["message"].lower()


def test_administrator_can_read_each_route_group(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    for path, _permission in ROUTE_PERMISSIONS:
        response = client.get(path)
        assert response.status_code == 200, path


@pytest.mark.parametrize("role_name", list(SEVEN_ROLES))
def test_role_can_access_permitted_routes(client: TestClient, role_name: str) -> None:
    login_as_role(client, role_name)
    granted = ROLE_PERMISSIONS[role_name]
    for path, permission in ROUTE_PERMISSIONS:
        response = client.get(path)
        if permission is None or permission in granted:
            assert response.status_code == 200, f"{role_name} {path}"
        else:
            assert response.status_code == 403, f"{role_name} {path}"
            body = response.json()
            assert body["code"] == "forbidden"
            assert body["message"] == "You do not have access to this resource."
            assert permission not in body["message"]


def test_forbidden_error_shape_for_missing_permission(client: TestClient) -> None:
    login_as_role(client, "Read Only")
    response = client.get("/api/v1/administration/summary")
    assert response.status_code == 403
    assert response.json() == {
        "code": "forbidden",
        "message": "You do not have access to this resource.",
        "details": None,
        "request_id": None,
    }


def test_administration_requires_administration_read(client: TestClient) -> None:
    login_as_role(client, "SOC Analyst")
    assert "administration.read" not in ROLE_PERMISSIONS["SOC Analyst"]
    assert client.get("/api/v1/administration/summary").status_code == 403
    assert client.get("/api/v1/administration/users").status_code == 403


def test_audit_events_require_administration_and_audit_read(client: TestClient) -> None:
    # Security Engineer: administration.read, no audit.read
    login_as_role(client, "Security Engineer")
    assert "administration.read" in ROLE_PERMISSIONS["Security Engineer"]
    assert "audit.read" not in ROLE_PERMISSIONS["Security Engineer"]
    assert client.get("/api/v1/administration/summary").status_code == 200
    denied = client.get("/api/v1/administration/audit-events")
    assert denied.status_code == 403

    client.post("/api/v1/auth/logout")
    # GRC Analyst: audit.read, no administration.read
    login_as_role(client, "GRC Analyst")
    assert "audit.read" in ROLE_PERMISSIONS["GRC Analyst"]
    assert "administration.read" not in ROLE_PERMISSIONS["GRC Analyst"]
    assert client.get("/api/v1/administration/audit-events").status_code == 403

    client.post("/api/v1/auth/logout")
    login_as_role(client, "Auditor")
    assert client.get("/api/v1/administration/audit-events").status_code == 200


def test_integrations_require_administration_and_integration_read(client: TestClient) -> None:
    login_as_role(client, "Auditor")
    assert "administration.read" in ROLE_PERMISSIONS["Auditor"]
    assert "integration.read" not in ROLE_PERMISSIONS["Auditor"]
    assert client.get("/api/v1/administration/summary").status_code == 200
    assert client.get("/api/v1/administration/integrations").status_code == 403

    client.post("/api/v1/auth/logout")
    login_as_role(client, "Security Engineer")
    assert client.get("/api/v1/administration/integrations").status_code == 200


def test_cyber_range_requires_cyber_range_read(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    assert "cyber_range.read" not in ROLE_PERMISSIONS["GRC Analyst"]
    assert client.get("/api/v1/cyber-range/summary").status_code == 403
    client.post("/api/v1/auth/logout")
    login_as_role(client, "SOC Analyst")
    assert client.get("/api/v1/cyber-range/summary").status_code == 200


def test_overview_filters_sections_without_failing(client: TestClient) -> None:
    login_as_role(client, "Read Only")
    body = client.get("/api/v1/overview").json()
    assert body["organization_name"] == "AegisBridge Technologies"
    assert body["kev_exposure"]["exposed_asset_count"] == 1
    assert body["open_incidents"] == 1
    kinds = {item["kind"] for item in body["my_work"]}
    assert "access_review" not in kinds
    assert "remediation" in kinds or "risk" in kinds or "incident" in kinds

    client.post("/api/v1/auth/logout")
    login_as_role(client, "GRC Analyst")
    grc = client.get("/api/v1/overview").json()
    assert grc["open_incidents"] == 0  # no incident.read
    assert grc["kev_exposure"]["exposed_asset_count"] == 1
    assert all(item["kind"] != "incident" for item in grc["my_work"])
    assert all(item["kind"] != "investigation" for item in grc["my_work"])


def test_revoked_and_expired_session_get_401_on_domain(client: TestClient) -> None:
    login = _login(client, ADMIN_EMAIL)
    token = login.cookies.get("aegis_session")
    assert token
    with SessionLocal() as session:
        row = session.scalar(
            select(AuthSession).where(AuthSession.token_digest == digest_session_token(token))
        )
        assert row is not None
        row.revoked_at = datetime.now(UTC)
        session.commit()
    assert client.get("/api/v1/assets").status_code == 401

    login2 = _login(client, ADMIN_EMAIL)
    token2 = login2.cookies.get("aegis_session")
    assert token2
    with SessionLocal() as session:
        row = session.scalar(
            select(AuthSession).where(AuthSession.token_digest == digest_session_token(token2))
        )
        assert row is not None
        row.expires_at = datetime(2020, 1, 1, tzinfo=UTC)
        session.commit()
    assert client.get("/api/v1/assets").status_code == 401


def test_inactive_user_gets_401_on_domain(client: TestClient) -> None:
    email = prepare_role_login("Read Only")
    assert _login(client, email).status_code == 200
    with SessionLocal() as session:
        user = session.scalar(select(User).where(User.email == email))
        assert user is not None
        user.account_status = "inactive"
        session.commit()
    assert client.get("/api/v1/assets").status_code == 401


def test_client_cannot_inject_roles_or_permissions(client: TestClient) -> None:
    login_as_role(client, "Read Only")
    response = client.get(
        "/api/v1/administration/summary",
        headers={
            "X-Role": "Administrator",
            "X-Roles": "Administrator",
            "X-Permission": "administration.read",
            "X-Permissions": "administration.read,audit.read",
        },
        params={"role": "Administrator", "permissions": "administration.read"},
    )
    assert response.status_code == 403


def test_openapi_marks_protected_routes_with_session_cookie(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    schemes = spec["components"]["securitySchemes"]
    assert "SessionCookie" in schemes
    assert schemes["SessionCookie"]["in"] == "cookie"
    assert schemes["SessionCookie"]["type"] == "apiKey"
    assert "password" not in str(schemes).lower() or "password" not in schemes["SessionCookie"]
    assets = spec["paths"]["/api/v1/assets"]["get"]
    assert {"SessionCookie": []} in assets.get("security", [])
    health = spec["paths"]["/api/v1/health"]["get"]
    assert "security" not in health or health.get("security") in (None, [], [{}])
    login = spec["paths"]["/api/v1/auth/login"]["post"]
    assert "security" not in login or login.get("security") in (None, [], [{}])


def test_read_only_lacks_administration_manage(client: TestClient) -> None:
    assert "administration.read" not in ROLE_PERMISSIONS["Read Only"]
    assert "administration.manage" not in ROLE_PERMISSIONS["Read Only"]
    assert "user.role.manage" not in ROLE_PERMISSIONS["CISO"]
    assert "administration.manage" not in ROLE_PERMISSIONS["CISO"]
    assert "administration.read" in ROLE_PERMISSIONS["CISO"]
    assert "administration.read" in ROLE_PERMISSIONS["Security Engineer"]
    assert "administration.manage" not in ROLE_PERMISSIONS["Security Engineer"]
