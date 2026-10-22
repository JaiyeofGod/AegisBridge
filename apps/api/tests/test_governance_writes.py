"""Governance control implementation, tests, and evidence metadata writes."""

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
from app.models.evidence import Evidence, EvidenceControlLink
from app.models.grc import ControlTest
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


def test_control_implementation_requires_manage_and_csrf(client: TestClient) -> None:
    login_as_role(client, "Auditor")
    denied = client.patch(
        "/api/v1/governance/controls/CTRL-0002/implementation",
        json={"status": "implemented"},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403
    assert denied.json()["code"] == "forbidden"

    client.cookies.clear()
    assert (
        client.patch(
            "/api/v1/governance/controls/CTRL-0002/implementation",
            json={"status": "implemented"},
        ).status_code
        == 401
    )

    login_as_role(client, "GRC Analyst")
    missing = client.patch(
        "/api/v1/governance/controls/CTRL-0002/implementation",
        json={"status": "implemented"},
    )
    assert missing.status_code == 403
    assert missing.json()["code"] == "csrf_failed"


def test_control_implementation_persists_audits_and_conflict(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    reset = client.patch(
        "/api/v1/governance/controls/CTRL-0002/implementation",
        json={"status": "partial", "notes": "Simulated implementation label."},
        headers=csrf_headers(client),
    )
    assert reset.status_code == 200
    before = client.get("/api/v1/governance/controls/CTRL-0002").json()
    assert before["licensed_text_included"] is False
    expected = before["implementation"]["updated_at"]

    updated = client.patch(
        "/api/v1/governance/controls/CTRL-0002/implementation",
        json={
            "status": "implemented",
            "notes": "Lab implementation note recorded manually.",
            "expected_updated_at": expected,
        },
        headers=csrf_headers(client),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["implementation"]["status"] == "implemented"
    assert body["implementation"]["notes"] == "Lab implementation note recorded manually."
    assert "CIS" not in (body["implementation"]["notes"] or "")
    assert body["licensed_text_included"] is False

    summary = client.get("/api/v1/governance/summary").json()
    assert summary["control_implementations"]["by_status"].get("implemented", 0) >= 1

    stale = client.patch(
        "/api/v1/governance/controls/CTRL-0002/implementation",
        json={"status": "partial", "expected_updated_at": expected},
        headers=csrf_headers(client),
    )
    assert stale.status_code == 409

    with SessionLocal() as session:
        events = session.scalars(
            select(AuditEvent).where(AuditEvent.action == "CONTROL_IMPLEMENTATION_UPDATE")
        ).all()
        assert events
        for event in events:
            assert event.object_id == "CTRL-0002"
            blob = f"{event.detail or ''}{event.actor_label}"
            assert CSRF_HEADER_NAME.lower() not in blob.lower()
            assert "aegis_session" not in blob.lower()

    restore = client.patch(
        "/api/v1/governance/controls/CTRL-0002/implementation",
        json={
            "status": "partial",
            "notes": "Simulated implementation label.",
            "expected_updated_at": body["implementation"]["updated_at"],
        },
        headers=csrf_headers(client),
    )
    assert restore.status_code == 200


def test_control_implementation_rejects_mass_assignment_and_invalid_status(
    client: TestClient,
) -> None:
    login_as_role(client, "Administrator")
    before = client.get("/api/v1/governance/controls/CTRL-0002").json()
    rejected = client.patch(
        "/api/v1/governance/controls/CTRL-0002/implementation",
        json={
            "status": "implemented",
            "control_code": "AC-HACK",
            "permissions": ["control.manage"],
            "title": "should fail",
        },
        headers=csrf_headers(client),
    )
    assert rejected.status_code == 422
    after = client.get("/api/v1/governance/controls/CTRL-0002").json()
    assert after["implementation"]["status"] == before["implementation"]["status"]

    invalid = client.patch(
        "/api/v1/governance/controls/CTRL-0002/implementation",
        json={"status": "fully_compliant"},
        headers=csrf_headers(client),
    )
    assert invalid.status_code == 422

    missing = client.patch(
        "/api/v1/governance/controls/CTRL-9999/implementation",
        json={"status": "partial"},
        headers=csrf_headers(client),
    )
    assert missing.status_code == 404


def test_control_test_create_and_update(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    created = client.post(
        "/api/v1/governance/controls/CTRL-0002/tests",
        json={"result": "pass", "notes": "Manual walkthrough in the lab seed."},
        headers=csrf_headers(client),
    )
    assert created.status_code == 200
    body = created.json()
    assert body["id"].startswith("CTEST-")
    assert body["result"] == "pass"
    assert body["recording_mode"] == "manual"
    assert "manual development recording" in (body["notes"] or "").lower()

    summary = client.get("/api/v1/governance/summary").json()
    assert summary["control_implementations"]["tests_recorded"] >= 1
    assert summary["assessment_work"]["tests_recorded"] >= 1

    expected = body["updated_at"]
    patched = client.patch(
        f"/api/v1/governance/control-tests/{body['id']}",
        json={"result": "fail", "expected_updated_at": expected},
        headers=csrf_headers(client),
    )
    assert patched.status_code == 200
    assert patched.json()["result"] == "fail"

    detail = client.get("/api/v1/governance/controls/CTRL-0002").json()
    assert any(test["id"] == body["id"] for test in detail["tests"])

    with SessionLocal() as session:
        assert session.scalars(
            select(AuditEvent).where(AuditEvent.action == "CONTROL_TEST_CREATE")
        ).first()
        assert session.scalars(
            select(AuditEvent).where(AuditEvent.action == "CONTROL_TEST_UPDATE")
        ).first()
        row = session.scalar(select(ControlTest).where(ControlTest.human_id == body["id"]))
        assert row is not None
        assert row.result == "fail"


def test_control_test_requires_manage_and_valid_result(client: TestClient) -> None:
    login_as_role(client, "Auditor")
    denied = client.post(
        "/api/v1/governance/controls/CTRL-0002/tests",
        json={"result": "pass"},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403

    login_as_role(client, "GRC Analyst")
    invalid = client.post(
        "/api/v1/governance/controls/CTRL-0002/tests",
        json={"result": "automated_green"},
        headers=csrf_headers(client),
    )
    assert invalid.status_code == 422


def test_evidence_metadata_create_and_hash_validation(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    created = client.post(
        "/api/v1/evidence",
        json={
            "title": "Manual privileged account export note",
            "description": "Metadata only. No file uploaded.",
            "sha256": "A" * 64,
            "data_classification": "simulated",
        },
        headers=csrf_headers(client),
    )
    assert created.status_code == 200
    body = created.json()
    assert body["id"].startswith("EVID-")
    assert body["sha256"] == "a" * 64
    assert body["object_stored"] is False
    assert body["integrity_verified"] is False
    assert "object_uri" not in body

    bad = client.post(
        "/api/v1/evidence",
        json={"title": "Bad hash", "sha256": "not-a-hash"},
        headers=csrf_headers(client),
    )
    assert bad.status_code == 422

    injected = client.post(
        "/api/v1/evidence",
        json={
            "title": "Inject",
            "object_uri": "s3://secret/path",
            "permissions": ["evidence.manage"],
        },
        headers=csrf_headers(client),
    )
    assert injected.status_code == 422

    summary = client.get("/api/v1/governance/summary").json()
    assert summary["evidence_freshness"]["recorded"] >= 2

    with SessionLocal() as session:
        evidence = session.scalar(select(Evidence).where(Evidence.human_id == body["id"]))
        assert evidence is not None
        assert evidence.object_uri is None
        assert session.scalars(
            select(AuditEvent).where(AuditEvent.action == "EVIDENCE_CREATE")
        ).first()


def test_evidence_requires_manage_and_csrf(client: TestClient) -> None:
    login_as_role(client, "Auditor")
    denied = client.post(
        "/api/v1/evidence",
        json={"title": "Should fail"},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403

    login_as_role(client, "GRC Analyst")
    missing = client.post("/api/v1/evidence", json={"title": "Should fail csrf"})
    assert missing.status_code == 403
    assert missing.json()["code"] == "csrf_failed"


def test_control_evidence_link_and_unlink(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    created = client.post(
        "/api/v1/evidence",
        json={"title": "Linkable evidence metadata"},
        headers=csrf_headers(client),
    )
    evidence_id = created.json()["id"]

    linked = client.post(
        f"/api/v1/governance/controls/CTRL-0002/evidence/{evidence_id}",
        headers=csrf_headers(client),
    )
    assert linked.status_code == 200
    assert linked.json()["linked"] is True

    again = client.post(
        f"/api/v1/governance/controls/CTRL-0002/evidence/{evidence_id}",
        headers=csrf_headers(client),
    )
    assert again.status_code == 200
    assert again.json()["linked"] is True

    detail = client.get("/api/v1/governance/controls/CTRL-0002").json()
    assert any(item["id"] == evidence_id for item in detail["evidence"])
    assert detail["evidence_count"] >= 2

    missing = client.post(
        "/api/v1/governance/controls/CTRL-0002/evidence/EVID-9999",
        headers=csrf_headers(client),
    )
    assert missing.status_code == 404

    unlinked = client.delete(
        f"/api/v1/governance/controls/CTRL-0002/evidence/{evidence_id}",
        headers=csrf_headers(client),
    )
    assert unlinked.status_code == 200
    assert unlinked.json()["linked"] is False

    with SessionLocal() as session:
        assert session.scalars(
            select(AuditEvent).where(AuditEvent.action == "CONTROL_EVIDENCE_LINK")
        ).first()
        assert session.scalars(
            select(AuditEvent).where(AuditEvent.action == "CONTROL_EVIDENCE_UNLINK")
        ).first()
        remaining = session.scalars(
            select(EvidenceControlLink).join(Evidence).where(Evidence.human_id == evidence_id)
        ).all()
        assert remaining == []


def test_control_evidence_link_requires_both_permissions(client: TestClient) -> None:
    """Security Engineer has neither control.manage nor evidence.manage."""
    login_as_role(client, "Security Engineer")
    denied = client.post(
        "/api/v1/governance/controls/CTRL-0002/evidence/EVID-0041",
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403


def test_governance_write_openapi_documents_mutations(client: TestClient) -> None:
    _login(client)
    fetch_csrf(client)
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/api/v1/governance/controls/{control_id}/implementation" in paths
    assert "/api/v1/governance/controls/{control_id}/tests" in paths
    assert "/api/v1/governance/control-tests/{test_id}" in paths
    assert "/api/v1/evidence" in paths
    assert "/api/v1/governance/controls/{control_id}/evidence/{evidence_id}" in paths
    schemas = spec["components"]["schemas"]
    for name in (
        "ControlImplementationUpdate",
        "ControlTestCreate",
        "ControlTestUpdate",
        "EvidenceCreate",
    ):
        assert name in schemas
        assert schemas[name].get("additionalProperties") is False
    for path in (
        "/api/v1/governance/controls/{control_id}/implementation",
        "/api/v1/evidence",
    ):
        method = "patch" if "implementation" in path else "post"
        assert {"SessionCookie": []} in paths[path][method].get("security", [])
