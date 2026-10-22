"""Administration access-review, user status, and role assignment writes."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from tests.csrf_helpers import csrf_headers, fetch_csrf
from tests.test_authorization import login_as_role

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.audit import AuditEvent
from app.models.identity import User, UserRole
from app.security.csrf import CSRF_HEADER_NAME

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
ADMIN_EMAIL = "amara.okonkwo@aegisbridge.example"


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


def _login(client: TestClient, email: str = ADMIN_EMAIL, password: str = DEV_PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _user_by_id(items: list[dict], user_id: str) -> dict:
    return next(item for item in items if item["id"] == user_id)


def test_access_review_update_requires_manage_and_csrf(client: TestClient) -> None:
    login_as_role(client, "Auditor")
    denied = client.patch(
        "/api/v1/administration/access-reviews/ARV-0001",
        json={"status": "completed"},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403
    assert denied.json()["code"] == "forbidden"

    client.cookies.clear()
    assert (
        client.patch(
            "/api/v1/administration/access-reviews/ARV-0001",
            json={"status": "completed"},
        ).status_code
        == 401
    )

    login_as_role(client, "Administrator")
    missing_csrf = client.patch(
        "/api/v1/administration/access-reviews/ARV-0001",
        json={"status": "completed"},
    )
    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["code"] == "csrf_failed"


def test_access_review_update_persists_audits_and_conflict(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    reset = client.patch(
        "/api/v1/administration/access-reviews/ARV-0001",
        json={"status": "in_progress", "name": "October access review"},
        headers=csrf_headers(client),
    )
    assert reset.status_code == 200
    before = next(
        item
        for item in client.get("/api/v1/administration/access-reviews").json()["items"]
        if item["id"] == "ARV-0001"
    )
    expected = before["updated_at"]
    assert before["status"] == "in_progress"

    updated = client.patch(
        "/api/v1/administration/access-reviews/ARV-0001",
        json={
            "status": "completed",
            "name": "October access review (closed)",
            "expected_updated_at": expected,
        },
        headers=csrf_headers(client),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["status"] == "completed"
    assert body["name"] == "October access review (closed)"
    assert body["owner"] is None
    assert body["due_at"] is None

    summary = client.get("/api/v1/administration/summary").json()
    assert summary["pending_access_review_count"] == 0

    stale = client.patch(
        "/api/v1/administration/access-reviews/ARV-0001",
        json={"status": "in_progress", "expected_updated_at": expected},
        headers=csrf_headers(client),
    )
    assert stale.status_code == 409

    listed = next(
        item
        for item in client.get("/api/v1/administration/access-reviews").json()["items"]
        if item["id"] == "ARV-0001"
    )
    assert listed["status"] == "completed"

    with SessionLocal() as session:
        events = session.scalars(
            select(AuditEvent).where(AuditEvent.action == "ACCESS_REVIEW_UPDATE")
        ).all()
        assert events
        for event in events:
            assert event.object_id == "ARV-0001"
            blob = f"{event.detail or ''}{event.actor_label}"
            assert CSRF_HEADER_NAME.lower() not in blob.lower()
            assert "token_digest" not in blob
            assert "aegis_session" not in blob.lower()


def test_access_review_rejects_unexpected_fields_and_invalid_status(
    client: TestClient,
) -> None:
    login_as_role(client, "Administrator")
    before = next(
        item
        for item in client.get("/api/v1/administration/access-reviews").json()["items"]
        if item["id"] == "ARV-0001"
    )
    rejected = client.patch(
        "/api/v1/administration/access-reviews/ARV-0001",
        json={
            "status": "completed",
            "owner": "USR-0001",
            "due_at": "2026-12-01T00:00:00Z",
            "notes": "invented",
            "permissions": ["administration.manage"],
        },
        headers=csrf_headers(client),
    )
    assert rejected.status_code == 422
    assert rejected.json()["code"] == "validation_error"
    after = next(
        item
        for item in client.get("/api/v1/administration/access-reviews").json()["items"]
        if item["id"] == "ARV-0001"
    )
    assert after["status"] == before["status"]
    assert after["updated_at"] == before["updated_at"]

    invalid = client.patch(
        "/api/v1/administration/access-reviews/ARV-0001",
        json={"status": "approved"},
        headers=csrf_headers(client),
    )
    assert invalid.status_code == 422

    missing = client.patch(
        "/api/v1/administration/access-reviews/ARV-9999",
        json={"status": "completed"},
        headers=csrf_headers(client),
    )
    assert missing.status_code == 404


def test_user_status_update_requires_manage_and_csrf(client: TestClient) -> None:
    login_as_role(client, "Auditor")
    denied = client.patch(
        "/api/v1/administration/users/USR-0005",
        json={"status": "inactive"},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403

    client.cookies.clear()
    assert (
        client.patch(
            "/api/v1/administration/users/USR-0005",
            json={"status": "inactive"},
        ).status_code
        == 401
    )

    login_as_role(client, "Administrator")
    missing = client.patch(
        "/api/v1/administration/users/USR-0005",
        json={"status": "inactive"},
    )
    assert missing.status_code == 403
    assert missing.json()["code"] == "csrf_failed"


def test_user_status_update_persists_audits_and_blocks_auth(client: TestClient) -> None:
    # Ensure Auditor has a credential without leaving an Auditor session cookie.
    login_as_role(client, "Auditor")
    auditor_email = "marcus.reid@aegisbridge.example"
    client.cookies.clear()

    login_as_role(client, "Administrator")
    users = client.get("/api/v1/administration/users").json()["items"]
    target = _user_by_id(users, "USR-0005")
    expected = target["updated_at"]
    assert target["status"] == "active"
    active_before = client.get("/api/v1/administration/summary").json()["active_user_count"]

    updated = client.patch(
        "/api/v1/administration/users/USR-0005",
        json={"status": "inactive", "expected_updated_at": expected},
        headers=csrf_headers(client),
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "inactive"
    assert updated.json()["id"] == "USR-0005"

    listed = _user_by_id(client.get("/api/v1/administration/users").json()["items"], "USR-0005")
    assert listed["status"] == "inactive"
    assert (
        client.get("/api/v1/administration/summary").json()["active_user_count"]
        == active_before - 1
    )

    client.cookies.clear()
    blocked = client.post(
        "/api/v1/auth/login",
        json={"email": auditor_email, "password": DEV_PASSWORD},
    )
    assert blocked.status_code == 401
    assert blocked.json()["code"] == "authentication_failed"

    login_as_role(client, "Administrator")
    restored = client.patch(
        "/api/v1/administration/users/USR-0005",
        json={"status": "active"},
        headers=csrf_headers(client),
    )
    assert restored.status_code == 200
    assert restored.json()["status"] == "active"

    with SessionLocal() as session:
        events = session.scalars(
            select(AuditEvent).where(AuditEvent.action == "USER_STATUS_UPDATE")
        ).all()
        assert events
        for event in events:
            assert event.object_id == "USR-0005"
            blob = f"{event.detail or ''}{event.actor_label}"
            assert "password" not in blob.lower()
            assert CSRF_HEADER_NAME.lower() not in blob.lower()


def test_user_status_rejects_mass_assignment_and_unknown_user(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    before = _user_by_id(client.get("/api/v1/administration/users").json()["items"], "USR-0004")
    rejected = client.patch(
        "/api/v1/administration/users/USR-0004",
        json={
            "status": "inactive",
            "email": "attacker@example.com",
            "password_hash": "x",
            "permissions": ["administration.manage"],
            "human_id": "USR-HACK",
            "id": "00000000-0000-0000-0000-000000000000",
        },
        headers=csrf_headers(client),
    )
    assert rejected.status_code == 422
    after = _user_by_id(client.get("/api/v1/administration/users").json()["items"], "USR-0004")
    assert after["status"] == before["status"]
    assert after["email"] == before["email"]

    invalid = client.patch(
        "/api/v1/administration/users/USR-0004",
        json={"status": "disabled"},
        headers=csrf_headers(client),
    )
    assert invalid.status_code == 422

    missing = client.patch(
        "/api/v1/administration/users/USR-9999",
        json={"status": "inactive"},
        headers=csrf_headers(client),
    )
    assert missing.status_code == 404


def test_cannot_disable_last_active_administrator(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    users = client.get("/api/v1/administration/users").json()["items"]
    admin = _user_by_id(users, "USR-0001")
    denied = client.patch(
        "/api/v1/administration/users/USR-0001",
        json={"status": "inactive", "expected_updated_at": admin["updated_at"]},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 409
    assert denied.json()["code"] == "conflict"
    assert (
        _user_by_id(client.get("/api/v1/administration/users").json()["items"], "USR-0001")[
            "status"
        ]
        == "active"
    )


def test_user_roles_require_role_manage_and_csrf(client: TestClient) -> None:
    login_as_role(client, "Security Engineer")
    denied = client.put(
        "/api/v1/administration/users/USR-0004/roles",
        json={"roles": ["Read Only"]},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403

    login_as_role(client, "Administrator")
    missing = client.put(
        "/api/v1/administration/users/USR-0004/roles",
        json={"roles": ["Read Only"]},
    )
    assert missing.status_code == 403
    assert missing.json()["code"] == "csrf_failed"


def test_user_roles_replace_persists_permissions_and_audit(client: TestClient) -> None:
    from sqlalchemy.orm import selectinload

    login_as_role(client, "Administrator")
    reset = client.put(
        "/api/v1/administration/users/USR-0004/roles",
        json={"roles": ["SOC Analyst"]},
        headers=csrf_headers(client),
    )
    assert reset.status_code == 200
    before = _user_by_id(client.get("/api/v1/administration/users").json()["items"], "USR-0004")
    assert before["roles"] == ["SOC Analyst"]

    updated = client.put(
        "/api/v1/administration/users/USR-0004/roles",
        json={
            "roles": ["Read Only", "Read Only", "Auditor"],
            "expected_updated_at": before["updated_at"],
        },
        headers=csrf_headers(client),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["roles"] == ["Auditor", "Read Only"]
    assert "audit.read" in body["permissions"]
    assert "incident.manage" not in body["permissions"]
    assert body["privileged"] is False

    listed = _user_by_id(client.get("/api/v1/administration/users").json()["items"], "USR-0004")
    assert listed["roles"] == ["Auditor", "Read Only"]

    roles_catalog = {
        item["name"] for item in client.get("/api/v1/administration/roles").json()["items"]
    }
    assert roles_catalog == {
        "Administrator",
        "Auditor",
        "CISO",
        "GRC Analyst",
        "Read Only",
        "SOC Analyst",
        "Security Engineer",
    }

    with SessionLocal() as session:
        user = session.scalar(
            select(User)
            .where(User.human_id == "USR-0004")
            .options(selectinload(User.role_links).selectinload(UserRole.role))
        )
        assert user is not None
        assert sorted(link.role.name for link in user.role_links) == ["Auditor", "Read Only"]

        events = session.scalars(
            select(AuditEvent).where(AuditEvent.action == "USER_ROLE_UPDATE")
        ).all()
        assert events
        for event in events:
            assert event.object_id == "USR-0004"
            assert "Administrator=no" in (event.detail or "")
            blob = f"{event.detail or ''}{event.actor_label}"
            assert CSRF_HEADER_NAME.lower() not in blob.lower()
            assert "password" not in blob.lower()


def test_user_roles_reject_unknown_and_permission_injection(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    unknown = client.put(
        "/api/v1/administration/users/USR-0003/roles",
        json={"roles": ["Superuser"]},
        headers=csrf_headers(client),
    )
    assert unknown.status_code == 422

    injected = client.put(
        "/api/v1/administration/users/USR-0003/roles",
        json={
            "roles": ["GRC Analyst"],
            "permissions": ["administration.manage"],
            "password_hash": "x",
        },
        headers=csrf_headers(client),
    )
    assert injected.status_code == 422

    # Restore catalog baseline for this user if a prior suite left roles mutated.
    restore = client.put(
        "/api/v1/administration/users/USR-0003/roles",
        json={"roles": ["GRC Analyst"]},
        headers=csrf_headers(client),
    )
    assert restore.status_code == 200
    before = _user_by_id(client.get("/api/v1/administration/users").json()["items"], "USR-0003")
    assert before["roles"] == ["GRC Analyst"]


def test_cannot_remove_administrator_from_last_active_admin(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    admin = _user_by_id(client.get("/api/v1/administration/users").json()["items"], "USR-0001")
    denied = client.put(
        "/api/v1/administration/users/USR-0001/roles",
        json={"roles": ["Read Only"], "expected_updated_at": admin["updated_at"]},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 409
    assert denied.json()["code"] == "conflict"
    still = _user_by_id(client.get("/api/v1/administration/users").json()["items"], "USR-0001")
    assert "Administrator" in still["roles"]


def test_security_engineer_cannot_assign_administrator(client: TestClient) -> None:
    login_as_role(client, "Security Engineer")
    denied = client.put(
        "/api/v1/administration/users/USR-0004/roles",
        json={"roles": ["Administrator"]},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403


def test_admin_write_openapi_documents_mutations(client: TestClient) -> None:
    _login(client)
    fetch_csrf(client)
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/api/v1/administration/access-reviews/{review_id}" in paths
    assert "patch" in paths["/api/v1/administration/access-reviews/{review_id}"]
    assert "/api/v1/administration/users/{user_id}" in paths
    assert "patch" in paths["/api/v1/administration/users/{user_id}"]
    assert "/api/v1/administration/users/{user_id}/roles" in paths
    assert "put" in paths["/api/v1/administration/users/{user_id}/roles"]
    schemas = spec["components"]["schemas"]
    assert "AccessReviewUpdate" in schemas
    assert "UserStatusUpdate" in schemas
    assert "UserRolesUpdate" in schemas
    assert schemas["AccessReviewUpdate"].get("additionalProperties") is False
    assert schemas["UserStatusUpdate"].get("additionalProperties") is False
    assert schemas["UserRolesUpdate"].get("additionalProperties") is False
    for path in (
        "/api/v1/administration/access-reviews/{review_id}",
        "/api/v1/administration/users/{user_id}",
        "/api/v1/administration/users/{user_id}/roles",
    ):
        for method in paths[path]:
            assert {"SessionCookie": []} in paths[path][method].get("security", [])
