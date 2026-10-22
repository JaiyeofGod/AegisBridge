"""CSRF foundation, preference persistence, and risk treatment writes."""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from tests.csrf_helpers import csrf_headers, fetch_csrf
from tests.test_authorization import login_as_role, prepare_role_login

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.audit import AuditEvent
from app.models.auth import AuthSession
from app.models.identity import User
from app.security.csrf import CSRF_HEADER_NAME, digest_csrf_token
from app.security.sessions import digest_session_token

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


def test_csrf_required_for_authenticated_writes(client: TestClient) -> None:
    login = _login(client)
    assert login.status_code == 200
    missing = client.patch(
        "/api/v1/account/preferences",
        json={"theme": "dark"},
    )
    assert missing.status_code == 403
    assert missing.json()["code"] == "csrf_failed"

    invalid = client.patch(
        "/api/v1/account/preferences",
        json={"theme": "dark"},
        headers={CSRF_HEADER_NAME: "not-a-valid-token"},
    )
    assert invalid.status_code == 403
    assert invalid.json()["code"] == "csrf_failed"
    assert (
        "csrf" not in invalid.json()["message"].lower()
        or "failed" in invalid.json()["message"].lower()
    )


def test_valid_csrf_allows_write_and_is_not_session_token(client: TestClient) -> None:
    login = _login(client)
    session_cookie = login.cookies.get("aegis_session")
    assert session_cookie
    csrf = fetch_csrf(client)
    assert csrf != session_cookie
    assert digest_csrf_token(csrf) != digest_session_token(session_cookie)

    response = client.patch(
        "/api/v1/account/preferences",
        json={"theme": "dark"},
        headers={CSRF_HEADER_NAME: csrf},
    )
    assert response.status_code == 200
    assert response.json()["theme"] == "dark"
    assert response.json()["persistence"] == "stored"


def test_csrf_token_alone_cannot_authenticate(client: TestClient) -> None:
    login = _login(client)
    csrf = login.json()["csrf_token"]
    client.cookies.clear()
    response = client.patch(
        "/api/v1/account/preferences",
        json={"theme": "light"},
        headers={CSRF_HEADER_NAME: csrf},
    )
    assert response.status_code == 401


def test_csrf_bound_to_session_rejects_cross_session_reuse(client: TestClient) -> None:
    first = _login(client)
    csrf_a = first.json()["csrf_token"]
    client.post("/api/v1/auth/logout", headers={CSRF_HEADER_NAME: csrf_a})

    second = _login(client)
    assert second.status_code == 200
    # Old CSRF from previous session must not authorize writes on the new session.
    rejected = client.patch(
        "/api/v1/account/preferences",
        json={"theme": "light"},
        headers={CSRF_HEADER_NAME: csrf_a},
    )
    assert rejected.status_code == 403


def test_revoked_and_expired_session_block_writes(client: TestClient) -> None:
    login = _login(client)
    token = login.cookies.get("aegis_session")
    csrf = fetch_csrf(client)
    assert token
    with SessionLocal() as session:
        row = session.scalar(
            select(AuthSession).where(AuthSession.token_digest == digest_session_token(token))
        )
        assert row is not None
        row.revoked_at = datetime.now(UTC)
        session.commit()
    assert (
        client.patch(
            "/api/v1/account/preferences",
            json={"theme": "dark"},
            headers={CSRF_HEADER_NAME: csrf},
        ).status_code
        == 401
    )

    login2 = _login(client)
    token2 = login2.cookies.get("aegis_session")
    csrf2 = fetch_csrf(client)
    with SessionLocal() as session:
        row = session.scalar(
            select(AuthSession).where(AuthSession.token_digest == digest_session_token(token2))
        )
        assert row is not None
        row.expires_at = datetime(2020, 1, 1, tzinfo=UTC)
        session.commit()
    assert (
        client.patch(
            "/api/v1/account/preferences",
            json={"theme": "dark"},
            headers={CSRF_HEADER_NAME: csrf2},
        ).status_code
        == 401
    )


def test_preferences_defaults_then_persist(client: TestClient) -> None:
    from sqlalchemy import delete

    from app.models.preferences import UserPreferences

    with SessionLocal() as session:
        admin = session.scalar(select(User).where(User.human_id == "USR-0001"))
        assert admin is not None
        session.execute(delete(UserPreferences).where(UserPreferences.user_id == admin.id))
        session.commit()

    _login(client)
    before = client.get("/api/v1/account/preferences").json()
    assert before["persistence"] == "default"
    assert before["theme"] == "system"
    assert before["updated_at"] is None

    patched = client.patch(
        "/api/v1/account/preferences",
        json={"theme": "dark", "density": "compact"},
        headers=csrf_headers(client),
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["persistence"] == "stored"
    assert body["theme"] == "dark"
    assert body["density"] == "compact"
    assert body["landing_page"] == "overview"
    assert body["updated_at"] is not None

    partial = client.patch(
        "/api/v1/account/preferences",
        json={"reduced_motion": True},
        headers=csrf_headers(client),
    )
    assert partial.status_code == 200
    assert partial.json()["theme"] == "dark"
    assert partial.json()["reduced_motion"] is True

    again = client.get("/api/v1/account/preferences").json()
    assert again["theme"] == "dark"
    assert again["density"] == "compact"
    assert again["reduced_motion"] is True


def test_preferences_validation_and_audit(client: TestClient) -> None:
    _login(client)
    bad = client.patch(
        "/api/v1/account/preferences",
        json={"theme": "neon"},
        headers=csrf_headers(client),
    )
    assert bad.status_code == 422

    client.patch(
        "/api/v1/account/preferences",
        json={"theme": "light"},
        headers=csrf_headers(client),
    )
    with SessionLocal() as session:
        events = session.scalars(
            select(AuditEvent).where(AuditEvent.action == "PREFERENCES_UPDATE")
        ).all()
        assert events
        for event in events:
            blob = f"{event.detail or ''}{event.object_id}{event.actor_label}"
            assert "csrf" not in blob.lower()
            assert "aegis_session" not in blob
            assert "token_digest" not in blob
            assert DEV_PASSWORD not in blob


def test_preferences_cannot_target_another_user(client: TestClient) -> None:
    _login(client)
    # Foreign user_id in body must be ignored; only the session principal is updated.
    response = client.patch(
        "/api/v1/account/preferences",
        json={"theme": "dark", "user_id": "USR-0003", "email": "priya.shah@aegisbridge.example"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200
    assert response.json()["theme"] == "dark"
    with SessionLocal() as session:
        admin = session.scalar(select(User).where(User.human_id == "USR-0001"))
        other = session.scalar(select(User).where(User.human_id == "USR-0003"))
        assert admin is not None and other is not None
        from app.models.preferences import UserPreferences

        admin_prefs = session.scalar(
            select(UserPreferences).where(UserPreferences.user_id == admin.id)
        )
        other_prefs = session.scalar(
            select(UserPreferences).where(UserPreferences.user_id == other.id)
        )
        assert admin_prefs is not None
        assert admin_prefs.theme == "dark"
        assert other_prefs is None


def test_risk_treatment_requires_manage_and_csrf(client: TestClient) -> None:
    login_as_role(client, "Read Only")
    denied = client.patch(
        "/api/v1/risks/RISK-0021/treatment",
        json={"status": "in_progress"},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403
    assert denied.json()["code"] == "forbidden"

    client.cookies.clear()
    assert (
        client.patch(
            "/api/v1/risks/RISK-0021/treatment",
            json={"status": "in_progress"},
        ).status_code
        == 401
    )

    login_as_role(client, "GRC Analyst")
    missing_csrf = client.patch(
        "/api/v1/risks/RISK-0021/treatment",
        json={"status": "in_progress"},
    )
    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["code"] == "csrf_failed"


def test_risk_treatment_update_persists_and_audits(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    # Normalize seed row so shared-DB ordering does not depend on prior suite runs.
    reset = client.patch(
        "/api/v1/risks/RISK-0021/treatment",
        json={
            "strategy": "mitigate",
            "status": "planned",
            "notes": "Simulated treatment. No control change was applied.",
        },
        headers=csrf_headers(client),
    )
    assert reset.status_code == 200
    before = client.get("/api/v1/risks/RISK-0021").json()
    assert before["treatment_strategy"] == "mitigate"
    assert before["treatment_status"] == "planned"
    expected = before.get("treatment_updated_at")

    updated = client.patch(
        "/api/v1/risks/RISK-0021/treatment",
        json={
            "status": "in_progress",
            "notes": "Mitigation started in the lab seed environment.",
            "expected_updated_at": expected,
            "owner": "USR-0001",
            "title": "should-be-ignored",
        },
        headers=csrf_headers(client),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["treatment_status"] == "in_progress"
    assert body["treatment_notes"] == "Mitigation started in the lab seed environment."
    assert body["title"] == before["title"]
    assert body["treatment_strategy"] == "mitigate"

    stale = client.patch(
        "/api/v1/risks/RISK-0021/treatment",
        json={"status": "complete", "expected_updated_at": expected},
        headers=csrf_headers(client),
    )
    assert stale.status_code == 409

    assert client.get("/api/v1/risks/RISK-0021").json()["treatment_status"] == "in_progress"

    with SessionLocal() as session:
        events = session.scalars(
            select(AuditEvent).where(AuditEvent.action == "RISK_TREATMENT_UPDATE")
        ).all()
        assert events
        for event in events:
            assert event.object_id == "RISK-0021"
            blob = f"{event.detail or ''}{event.actor_label}"
            assert CSRF_HEADER_NAME.lower() not in blob.lower()
            assert "token_digest" not in blob


def test_risk_treatment_validation_and_not_found(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    invalid = client.patch(
        "/api/v1/risks/RISK-0021/treatment",
        json={"strategy": "ignore"},
        headers=csrf_headers(client),
    )
    assert invalid.status_code == 422

    missing = client.patch(
        "/api/v1/risks/RISK-9999/treatment",
        json={"status": "planned"},
        headers=csrf_headers(client),
    )
    assert missing.status_code == 404


def test_permission_headers_cannot_elevate_writes(client: TestClient) -> None:
    prepare_role_login("Read Only")
    login_as_role(client, "Read Only")
    response = client.patch(
        "/api/v1/risks/RISK-0021/treatment",
        json={"status": "complete", "permissions": ["risk.manage"]},
        headers={
            **csrf_headers(client),
            "X-Permissions": "risk.manage",
            "X-Role": "Administrator",
        },
    )
    assert response.status_code == 403


def test_openapi_documents_write_and_csrf_routes(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    assert "/api/v1/auth/csrf" in spec["paths"]
    assert "/api/v1/account/preferences" in spec["paths"]
    assert "patch" in spec["paths"]["/api/v1/account/preferences"]
    assert "/api/v1/risks/{risk_id}/treatment" in spec["paths"]
    assert "patch" in spec["paths"]["/api/v1/risks/{risk_id}/treatment"]
    assert "/api/v1/incidents/{incident_id}" in spec["paths"]
    assert "patch" in spec["paths"]["/api/v1/incidents/{incident_id}"]
    assert "/api/v1/vulnerabilities/{vulnerability_id}/remediation" in spec["paths"]
    assert "patch" in spec["paths"]["/api/v1/vulnerabilities/{vulnerability_id}/remediation"]
    assert "SessionCookie" in spec["components"]["securitySchemes"]
    prefs_patch = spec["paths"]["/api/v1/account/preferences"]["patch"]
    assert {"SessionCookie": []} in prefs_patch.get("security", [])
    incident_patch = spec["paths"]["/api/v1/incidents/{incident_id}"]["patch"]
    assert {"SessionCookie": []} in incident_patch.get("security", [])
    rem_patch = spec["paths"]["/api/v1/vulnerabilities/{vulnerability_id}/remediation"]["patch"]
    assert {"SessionCookie": []} in rem_patch.get("security", [])
    assert "IncidentUpdate" in spec["components"]["schemas"]
    assert "VulnerabilityRemediationUpdate" in spec["components"]["schemas"]


def test_incident_update_requires_manage_and_csrf(client: TestClient) -> None:
    login_as_role(client, "Read Only")
    denied = client.patch(
        "/api/v1/incidents/INC-0001",
        json={"status": "contained"},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403
    assert denied.json()["code"] == "forbidden"

    client.cookies.clear()
    assert (
        client.patch(
            "/api/v1/incidents/INC-0001",
            json={"status": "contained"},
        ).status_code
        == 401
    )

    login_as_role(client, "SOC Analyst")
    missing_csrf = client.patch(
        "/api/v1/incidents/INC-0001",
        json={"status": "contained"},
    )
    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["code"] == "csrf_failed"


def test_incident_update_persists_and_audits(client: TestClient) -> None:
    login_as_role(client, "SOC Analyst")
    reset = client.patch(
        "/api/v1/incidents/INC-0001",
        json={
            "title": "Repeated authentication failures",
            "severity": "medium",
            "status": "investigating",
            "summary": (
                "Simulated incident. Severity and status are separate. No confirmed compromise."
            ),
            "owner": "USR-0004",
        },
        headers=csrf_headers(client),
    )
    assert reset.status_code == 200
    before = client.get("/api/v1/incidents/INC-0001").json()
    expected = before.get("updated_at")

    updated = client.patch(
        "/api/v1/incidents/INC-0001",
        json={
            "status": "contained",
            "severity": "high",
            "summary": "Containment steps recorded in the lab seed environment.",
            "expected_updated_at": expected,
        },
        headers=csrf_headers(client),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["status"] == "contained"
    assert body["severity"] == "high"
    assert body["summary"] == "Containment steps recorded in the lab seed environment."
    assert body["title"] == before["title"]
    assert body["containment_state"] is None

    stale = client.patch(
        "/api/v1/incidents/INC-0001",
        json={"status": "resolved", "expected_updated_at": expected},
        headers=csrf_headers(client),
    )
    assert stale.status_code == 409

    assert client.get("/api/v1/incidents/INC-0001").json()["status"] == "contained"

    with SessionLocal() as session:
        events = session.scalars(
            select(AuditEvent).where(AuditEvent.action == "INCIDENT_UPDATE")
        ).all()
        assert events
        for event in events:
            assert event.object_id == "INC-0001"
            blob = f"{event.detail or ''}{event.actor_label}"
            assert CSRF_HEADER_NAME.lower() not in blob.lower()
            assert "token_digest" not in blob
            assert "aegis_session" not in blob.lower()


def test_incident_update_rejects_unexpected_fields(client: TestClient) -> None:
    login_as_role(client, "SOC Analyst")
    before = client.get("/api/v1/incidents/INC-0001").json()
    rejected = client.patch(
        "/api/v1/incidents/INC-0001",
        json={
            "status": "contained",
            "containment_state": "should-fail",
            "cvss_base_score": 9.8,
            "created_at": "2020-01-01T00:00:00Z",
            "permissions": ["incident.manage"],
            "id": "INC-HACK",
        },
        headers=csrf_headers(client),
    )
    assert rejected.status_code == 422
    assert rejected.json()["code"] == "validation_error"
    after = client.get("/api/v1/incidents/INC-0001").json()
    assert after["status"] == before["status"]
    assert after["updated_at"] == before["updated_at"]


def test_incident_update_validation_and_not_found(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    invalid = client.patch(
        "/api/v1/incidents/INC-0001",
        json={"severity": "apocalyptic"},
        headers=csrf_headers(client),
    )
    assert invalid.status_code == 422

    missing = client.patch(
        "/api/v1/incidents/INC-9999",
        json={"status": "investigating"},
        headers=csrf_headers(client),
    )
    assert missing.status_code == 404


def test_incident_close_requires_close_permission(client: TestClient) -> None:
    """Strip incident.close from SOC Analyst for this check, then restore."""
    from app.security.permissions import ROLE_PERMISSIONS

    original = ROLE_PERMISSIONS["SOC Analyst"]
    narrowed = frozenset(p for p in original if p != "incident.close")
    ROLE_PERMISSIONS["SOC Analyst"] = narrowed
    try:
        client.cookies.clear()
        login_as_role(client, "SOC Analyst")
        denied = client.patch(
            "/api/v1/incidents/INC-0001",
            json={"status": "closed"},
            headers=csrf_headers(client),
        )
        assert denied.status_code == 403
        assert denied.json()["code"] == "forbidden"
    finally:
        ROLE_PERMISSIONS["SOC Analyst"] = original


def test_vulnerability_remediation_requires_manage_and_csrf(client: TestClient) -> None:
    login_as_role(client, "Read Only")
    denied = client.patch(
        "/api/v1/vulnerabilities/VULN-0041/remediation",
        json={"status": "in_progress"},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403
    assert denied.json()["code"] == "forbidden"

    client.cookies.clear()
    assert (
        client.patch(
            "/api/v1/vulnerabilities/VULN-0041/remediation",
            json={"status": "in_progress"},
        ).status_code
        == 401
    )

    login_as_role(client, "Security Engineer")
    missing_csrf = client.patch(
        "/api/v1/vulnerabilities/VULN-0041/remediation",
        json={"status": "in_progress"},
    )
    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["code"] == "csrf_failed"


def test_vulnerability_remediation_persists_and_audits(client: TestClient) -> None:
    login_as_role(client, "Security Engineer")
    reset = client.patch(
        "/api/v1/vulnerabilities/VULN-0041/remediation",
        json={
            "status": "open",
            "title": "Patch FIN-APP-01",
            "due_on": "2026-10-20",
            "owner": "USR-0001",
            "asset_id": "AST-0007",
        },
        headers=csrf_headers(client),
    )
    assert reset.status_code == 200
    before = client.get("/api/v1/vulnerabilities/VULN-0041").json()
    asset = before["assets"][0]
    assert asset["remediation_status"] == "open"
    expected = asset.get("remediation_updated_at")
    cvss_before = before["cvss_base_score"]
    epss_before = before["epss"]
    kev_before = before["kev_listed"]
    action_before = asset["action_decision"]

    updated = client.patch(
        "/api/v1/vulnerabilities/VULN-0041/remediation",
        json={
            "status": "in_progress",
            "title": "Patch FIN-APP-01 — lab window",
            "due_on": "2026-10-27",
            "expected_updated_at": expected,
            "asset_id": "AST-0007",
        },
        headers=csrf_headers(client),
    )
    assert updated.status_code == 200
    body = updated.json()
    asset_after = body["assets"][0]
    assert asset_after["asset_id"] == "AST-0007"
    assert asset_after["remediation_status"] == "in_progress"
    assert asset_after["remediation_title"] == "Patch FIN-APP-01 — lab window"
    assert asset_after["due_on"] == "2026-10-27"
    assert body["cvss_base_score"] == cvss_before
    assert body["epss"] == epss_before
    assert body["kev_listed"] == kev_before
    assert asset_after["action_decision"] == action_before

    stale = client.patch(
        "/api/v1/vulnerabilities/VULN-0041/remediation",
        json={
            "status": "complete",
            "expected_updated_at": expected,
            "asset_id": "AST-0007",
        },
        headers=csrf_headers(client),
    )
    assert stale.status_code == 409

    refreshed = client.get("/api/v1/vulnerabilities/VULN-0041").json()
    assert refreshed["assets"][0]["remediation_status"] == "in_progress"
    assert refreshed["assets"][0]["asset_id"] == "AST-0007"

    with SessionLocal() as session:
        events = session.scalars(
            select(AuditEvent).where(AuditEvent.action == "VULNERABILITY_REMEDIATION_UPDATE")
        ).all()
        assert events
        for event in events:
            assert event.object_id == "VULN-0041"
            blob = f"{event.detail or ''}{event.actor_label}"
            assert CSRF_HEADER_NAME.lower() not in blob.lower()
            assert "token_digest" not in blob


def test_vulnerability_remediation_rejects_unexpected_fields(client: TestClient) -> None:
    login_as_role(client, "Security Engineer")
    before = client.get("/api/v1/vulnerabilities/VULN-0041").json()
    rejected = client.patch(
        "/api/v1/vulnerabilities/VULN-0041/remediation",
        json={
            "status": "complete",
            "cvss_base_score": 1.0,
            "epss": 0.01,
            "kev_listed": False,
            "action_decision": "track",
            "created_at": "2020-01-01T00:00:00Z",
            "permissions": ["vulnerability.manage"],
            "id": "VULN-HACK",
        },
        headers=csrf_headers(client),
    )
    assert rejected.status_code == 422
    assert rejected.json()["code"] == "validation_error"
    after = client.get("/api/v1/vulnerabilities/VULN-0041").json()
    assert after["assets"][0]["remediation_status"] == before["assets"][0]["remediation_status"]
    assert after["cvss_base_score"] == before["cvss_base_score"]
    assert after["epss"] == before["epss"]
    assert after["kev_listed"] == before["kev_listed"]
    assert after["assets"][0]["action_decision"] == before["assets"][0]["action_decision"]


def test_vulnerability_remediation_cannot_reassign_asset(client: TestClient) -> None:
    """asset_id selects an existing finding; it cannot move remediation to another asset."""
    from app.models.vulnerability import AssetVulnerability, RemediationTask, Vulnerability

    login_as_role(client, "Security Engineer")
    before = client.get("/api/v1/vulnerabilities/VULN-0041").json()
    assert before["assets"][0]["asset_id"] == "AST-0007"
    status_before = before["assets"][0]["remediation_status"]

    with SessionLocal() as session:
        finding = session.scalar(select(Vulnerability).where(Vulnerability.human_id == "VULN-0041"))
        assert finding is not None
        task = session.scalar(
            select(RemediationTask)
            .join(
                AssetVulnerability,
                AssetVulnerability.id == RemediationTask.asset_vulnerability_id,
            )
            .where(AssetVulnerability.vulnerability_id == finding.id)
            .order_by(RemediationTask.created_at.desc())
        )
        assert task is not None
        original_link_id = task.asset_vulnerability_id

    # AST-0018 exists in seed but is not linked to VULN-0041.
    rejected = client.patch(
        "/api/v1/vulnerabilities/VULN-0041/remediation",
        json={"status": "complete", "asset_id": "AST-0018"},
        headers=csrf_headers(client),
    )
    assert rejected.status_code == 422
    assert rejected.json()["code"] == "validation_error"

    after = client.get("/api/v1/vulnerabilities/VULN-0041").json()
    assert after["assets"][0]["asset_id"] == "AST-0007"
    assert after["assets"][0]["remediation_status"] == status_before
    assert len(after["assets"]) == 1

    with SessionLocal() as session:
        finding = session.scalar(select(Vulnerability).where(Vulnerability.human_id == "VULN-0041"))
        assert finding is not None
        task = session.scalar(
            select(RemediationTask)
            .join(
                AssetVulnerability,
                AssetVulnerability.id == RemediationTask.asset_vulnerability_id,
            )
            .where(AssetVulnerability.vulnerability_id == finding.id)
            .order_by(RemediationTask.created_at.desc())
        )
        assert task is not None
        assert task.asset_vulnerability_id == original_link_id
        assert task.status == status_before


def test_vulnerability_remediation_validation_and_not_found(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    invalid = client.patch(
        "/api/v1/vulnerabilities/VULN-0041/remediation",
        json={"status": "ignore-me"},
        headers=csrf_headers(client),
    )
    assert invalid.status_code == 422

    missing = client.patch(
        "/api/v1/vulnerabilities/VULN-9999/remediation",
        json={"status": "open"},
        headers=csrf_headers(client),
    )
    assert missing.status_code == 404
