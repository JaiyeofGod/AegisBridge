"""Policy ↔ control relationship link/unlink and read contracts."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from tests.csrf_helpers import csrf_headers
from tests.test_authorization import login_as_role

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.audit import AuditEvent
from app.models.evidence import Evidence, EvidenceControlLink
from app.models.grc import Control, ControlTest
from app.models.policy import Policy, PolicyControlMapping
from app.security.csrf import CSRF_HEADER_NAME

DEV_PASSWORD = "Dev-Only-Local-Password-1!"


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


def _create_draft(client: TestClient, title: str = "Mapped policy") -> dict:
    response = client.post(
        "/api/v1/policies",
        headers=csrf_headers(client),
        json={
            "title": title,
            "initial_version_label": "0.1",
            "initial_content": "Draft for mapping tests.",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_link_requires_auth_manage_and_csrf(client: TestClient) -> None:
    path = "/api/v1/policies/POL-0001/controls/CTRL-0002"
    assert client.post(path).status_code == 401

    login_as_role(client, "Read Only")
    denied = client.post(path, headers=csrf_headers(client))
    assert denied.status_code == 403

    login_as_role(client, "CISO")
    # approve without manage
    approve_only = client.post(path, headers=csrf_headers(client))
    assert approve_only.status_code == 403

    login_as_role(client, "GRC Analyst")
    missing_csrf = client.post(path)
    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["code"] == "csrf_failed"


def test_link_unlink_idempotent_audit_and_read_models(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    created = _create_draft(client)
    policy_id = created["id"]
    path = f"/api/v1/policies/{policy_id}/controls/CTRL-0002"

    linked = client.post(path, headers=csrf_headers(client))
    assert linked.status_code == 200, linked.text
    body = linked.json()
    assert body == {"policy_id": policy_id, "control_id": "CTRL-0002", "linked": True}
    assert "uuid" not in linked.text.lower()

    again = client.post(path, headers=csrf_headers(client))
    assert again.status_code == 200
    assert again.json()["linked"] is True

    detail = client.get(f"/api/v1/policies/{policy_id}")
    assert detail.status_code == 200
    mappings = detail.json()["control_mappings"]
    assert len(mappings) == 1
    mapped = mappings[0]
    assert mapped["id"] == "CTRL-0002"
    assert mapped["control_code"] == "AC-2"
    assert mapped["licensed_text_included"] is False
    assert "framework_code" in mapped
    assert "uuid" not in detail.text.lower()
    assert "safeguard" not in detail.text.lower()
    # No licensed CIS prose fields
    assert "cis_text" not in mapped
    assert "licensed_text" not in mapped

    control = client.get("/api/v1/governance/controls/CTRL-0002")
    assert control.status_code == 200
    control_body = control.json()
    assert control_body["licensed_text_included"] is False
    assert any(item["id"] == policy_id for item in control_body["policies"])
    policy_ref = next(item for item in control_body["policies"] if item["id"] == policy_id)
    assert policy_ref["title"] == created["title"]
    assert policy_ref["status"] == "draft"
    assert set(policy_ref.keys()) <= {"id", "title", "status", "current_version"}

    with SessionLocal() as session:
        link_audit = session.scalars(
            select(AuditEvent).where(
                AuditEvent.action == "POLICY_CONTROL_LINK",
                AuditEvent.object_id == f"{policy_id}:CTRL-0002",
            )
        ).first()
        assert link_audit is not None
        assert link_audit.actor_label is not None
        assert link_audit.actor_label.startswith("USR-")
        assert CSRF_HEADER_NAME.lower() not in (link_audit.detail or "").lower()
        assert "Draft for mapping" not in (link_audit.detail or "")

    unlinked = client.delete(path, headers=csrf_headers(client))
    assert unlinked.status_code == 200
    assert unlinked.json()["linked"] is False

    missing = client.delete(path, headers=csrf_headers(client))
    assert missing.status_code == 404

    after = client.get(f"/api/v1/policies/{policy_id}").json()
    assert after["control_mappings"] == []
    assert after["id"] == policy_id

    control_after = client.get("/api/v1/governance/controls/CTRL-0002").json()
    assert all(item["id"] != policy_id for item in control_after["policies"])

    with SessionLocal() as session:
        policy_row = session.scalar(select(Policy).where(Policy.human_id == policy_id))
        control_row = session.scalar(select(Control).where(Control.human_id == "CTRL-0002"))
        assert policy_row is not None
        assert control_row is not None
        remaining_links = session.scalars(
            select(PolicyControlMapping).where(
                PolicyControlMapping.policy_id == policy_row.id,
                PolicyControlMapping.control_id == control_row.id,
            )
        ).all()
        assert remaining_links == []
        assert session.scalars(
            select(AuditEvent).where(
                AuditEvent.action == "POLICY_CONTROL_UNLINK",
                AuditEvent.object_id == f"{policy_id}:CTRL-0002",
            )
        ).first()
        # Unlink must not delete evidence, evidence↔control links, or control tests.
        assert session.scalar(select(Evidence).where(Evidence.human_id == "EVID-0041")) is not None
        assert (
            session.scalars(
                select(EvidenceControlLink).where(EvidenceControlLink.control_id == control_row.id)
            ).first()
            is not None
        )
        _ = session.scalars(
            select(ControlTest).where(ControlTest.control_id == control_row.id)
        ).all()


def test_link_unknown_policy_or_control(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    unknown_policy = client.post(
        "/api/v1/policies/POL-9999/controls/CTRL-0002",
        headers=csrf_headers(client),
    )
    assert unknown_policy.status_code == 404

    unknown_control = client.post(
        "/api/v1/policies/POL-0001/controls/CTRL-9999",
        headers=csrf_headers(client),
    )
    assert unknown_control.status_code == 404


def test_policy_read_can_view_mappings_without_manage(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    created = _create_draft(client, "Readable mapping")
    policy_id = created["id"]
    assert (
        client.post(
            f"/api/v1/policies/{policy_id}/controls/CTRL-0002",
            headers=csrf_headers(client),
        ).status_code
        == 200
    )

    login_as_role(client, "Read Only")
    detail = client.get(f"/api/v1/policies/{policy_id}")
    assert detail.status_code == 200
    assert detail.json()["control_mappings"][0]["id"] == "CTRL-0002"
    assert detail.json()["control_mappings"][0]["licensed_text_included"] is False

    denied = client.post(
        f"/api/v1/policies/{policy_id}/controls/CTRL-0002",
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403


def test_link_rejects_request_body_injection(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    created = _create_draft(client, "No body injection")
    # Endpoint does not declare a body; extra JSON must not become permissions/text.
    response = client.post(
        f"/api/v1/policies/{created['id']}/controls/CTRL-0002",
        headers={**csrf_headers(client), "Content-Type": "application/json"},
        content='{"permissions":["administration.manage"],"licensed_text":"CIS prose"}',
    )
    assert response.status_code == 200
    assert response.json()["linked"] is True
    detail = client.get(f"/api/v1/policies/{created['id']}").json()
    assert detail["control_mappings"][0]["licensed_text_included"] is False
    assert "CIS prose" not in str(detail)


def test_openapi_documents_policy_control_mapping_routes(client: TestClient) -> None:
    login_as_role(client, "Administrator")
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    link_path = "/api/v1/policies/{policy_id}/controls/{control_id}"
    assert link_path in paths
    assert "post" in paths[link_path]
    assert "delete" in paths[link_path]
    post = paths[link_path]["post"]
    delete = paths[link_path]["delete"]
    assert {"SessionCookie": []} in post.get("security", [])
    assert {"SessionCookie": []} in delete.get("security", [])
    assert "csrf" in (post.get("description") or "").lower()
    assert "csrf" in (delete.get("description") or "").lower()
    schemas = spec["components"]["schemas"]
    assert "PolicyControlLinkResult" in schemas
    assert "PolicyMappedControl" in schemas
    mapped = schemas["PolicyMappedControl"]["properties"]
    assert mapped["licensed_text_included"]["default"] is False
    assert "ControlMappedPolicy" in schemas
