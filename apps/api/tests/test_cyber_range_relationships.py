"""Catalog relationship create, update, and delete. Not live reachability."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from tests.csrf_helpers import csrf_headers
from tests.test_authorization import login_as_role

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.audit import AuditEvent
from app.models.cyber_range import LabSystem, LabSystemRelationship

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
COLLECTION = "/api/v1/cyber-range/system-relationships"


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
    _delete_relationship("REL-0004")


def _delete_relationship(human_id: str) -> None:
    with SessionLocal() as session:
        row = session.scalar(
            select(LabSystemRelationship).where(LabSystemRelationship.human_id == human_id)
        )
        if row is not None:
            session.delete(row)
        session.execute(
            delete(AuditEvent).where(
                AuditEvent.object_type == "lab_system_relationship",
                AuditEvent.object_id == human_id,
            )
        )
        session.commit()


def _assert_relationship_audit(action: str, relationship_id: str, *fragments: str) -> None:
    with SessionLocal() as session:
        event = session.scalar(
            select(AuditEvent)
            .where(AuditEvent.action == action, AuditEvent.object_id == relationship_id)
            .order_by(AuditEvent.occurred_at.desc())
        )
        assert event is not None
        assert event.object_type == "lab_system_relationship"
        assert event.result == "success"
        assert event.actor_label
        detail = event.detail or ""
        for fragment in fragments:
            assert fragment in detail
        lowered = detail.lower()
        assert "password" not in lowered
        assert "csrf" not in lowered
        assert "token" not in lowered


def _system_count() -> int:
    with SessionLocal() as session:
        return int(session.scalar(select(func.count()).select_from(LabSystem)) or 0)


def test_create_requires_manage_permission_and_csrf(client: TestClient) -> None:
    payload = {
        "source_system_id": "LAB-GW-01",
        "target_system_id": "KALI-RED-01",
        "relationship_kind": "connected_to",
    }
    assert client.post(COLLECTION, json=payload).status_code == 401

    login_as_role(client, "SOC Analyst")
    denied = client.post(COLLECTION, json=payload, headers=csrf_headers(client))
    assert denied.status_code == 403

    login_as_role(client, "Security Engineer")
    missing_csrf = client.post(COLLECTION, json=payload)
    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["code"] == "csrf_failed"


def test_administrator_can_create_catalog_relationship(client: TestClient) -> None:
    before = _system_count()
    login_as_role(client, "Administrator")
    created = client.post(
        COLLECTION,
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-GW-01",
            "target_system_id": "KALI-RED-01",
            "relationship_kind": "connected_to",
        },
    )
    assert created.status_code == 200
    relationship_id = created.json()["id"]
    _assert_relationship_audit(
        "LAB_RELATIONSHIP_CREATE",
        relationship_id,
        relationship_id,
        "LAB-GW-01",
        "connected_to",
        "KALI-RED-01",
    )
    removed = client.delete(
        f"{COLLECTION}/{relationship_id}",
        headers=csrf_headers(client),
    )
    assert removed.status_code == 200
    assert _system_count() == before


def test_authorized_create_and_validation(client: TestClient) -> None:
    login_as_role(client, "Security Engineer")
    created = client.post(
        COLLECTION,
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-GW-01",
            "target_system_id": "KALI-RED-01",
            "relationship_kind": "connected_to",
        },
    )
    assert created.status_code == 200
    body = created.json()
    assert body["id"] == "REL-0004"
    _assert_relationship_audit(
        "LAB_RELATIONSHIP_CREATE",
        "REL-0004",
        "REL-0004",
        "LAB-GW-01",
        "connected_to",
        "KALI-RED-01",
        "Not live reachability.",
    )
    assert body["source_system_id"] == "LAB-GW-01"
    assert body["target_system_id"] == "KALI-RED-01"
    assert body["relationship_kind"] == "connected_to"
    assert "created_at" not in body

    duplicate = client.post(
        COLLECTION,
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-GW-01",
            "target_system_id": "KALI-RED-01",
            "relationship_kind": "connected_to",
        },
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "conflict"

    self_link = client.post(
        COLLECTION,
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-GW-01",
            "target_system_id": "LAB-GW-01",
            "relationship_kind": "manages",
        },
    )
    assert self_link.status_code == 422
    assert self_link.json()["code"] == "validation_error"

    bad_kind = client.post(
        COLLECTION,
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-GW-01",
            "target_system_id": "WIN-USER-01",
            "relationship_kind": "attack_path",
        },
    )
    assert bad_kind.status_code == 422

    missing_source = client.post(
        COLLECTION,
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-MISSING",
            "target_system_id": "WIN-USER-01",
            "relationship_kind": "monitors",
        },
    )
    assert missing_source.status_code == 404

    missing_target = client.post(
        COLLECTION,
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-GW-01",
            "target_system_id": "LAB-MISSING",
            "relationship_kind": "monitors",
        },
    )
    assert missing_target.status_code == 404


def test_update_and_delete_keep_systems(client: TestClient) -> None:
    login_as_role(client, "Security Engineer")
    created = client.post(
        COLLECTION,
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-GW-01",
            "target_system_id": "KALI-RED-01",
            "relationship_kind": "connected_to",
        },
    )
    assert created.status_code == 200
    relationship_id = created.json()["id"]
    before = _system_count()

    updated = client.patch(
        f"{COLLECTION}/{relationship_id}",
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-GW-01",
            "target_system_id": "LINUX-APP-01",
            "relationship_kind": "manages",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["relationship_kind"] == "manages"
    assert updated.json()["target_system_id"] == "LINUX-APP-01"
    _assert_relationship_audit(
        "LAB_RELATIONSHIP_UPDATE",
        relationship_id,
        relationship_id,
        "LAB-GW-01",
        "manages",
        "LINUX-APP-01",
        "Not live reachability.",
    )

    duplicate = client.patch(
        f"{COLLECTION}/{relationship_id}",
        headers=csrf_headers(client),
        json={
            "source_system_id": "SEC-WAZUH-01",
            "target_system_id": "WIN-USER-01",
            "relationship_kind": "monitors",
        },
    )
    assert duplicate.status_code == 409

    self_link = client.patch(
        f"{COLLECTION}/{relationship_id}",
        headers=csrf_headers(client),
        json={
            "source_system_id": "LINUX-APP-01",
            "target_system_id": "LINUX-APP-01",
            "relationship_kind": "depends_on",
        },
    )
    assert self_link.status_code == 422

    missing = client.patch(
        f"{COLLECTION}/REL-9999",
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-GW-01",
            "target_system_id": "KALI-RED-01",
            "relationship_kind": "connected_to",
        },
    )
    assert missing.status_code == 404

    login_as_role(client, "SOC Analyst")
    denied_update = client.patch(
        f"{COLLECTION}/{relationship_id}",
        headers=csrf_headers(client),
        json={
            "source_system_id": "LAB-GW-01",
            "target_system_id": "KALI-RED-01",
            "relationship_kind": "connected_to",
        },
    )
    assert denied_update.status_code == 403
    denied_delete = client.delete(
        f"{COLLECTION}/{relationship_id}",
        headers=csrf_headers(client),
    )
    assert denied_delete.status_code == 403

    login_as_role(client, "Security Engineer")
    removed = client.delete(f"{COLLECTION}/{relationship_id}", headers=csrf_headers(client))
    assert removed.status_code == 200
    assert removed.json()["id"] == relationship_id
    _assert_relationship_audit(
        "LAB_RELATIONSHIP_DELETE",
        relationship_id,
        relationship_id,
        "LAB-GW-01",
        "manages",
        "LINUX-APP-01",
        "Systems were not deleted.",
    )
    assert _system_count() == before
    gone = client.delete(f"{COLLECTION}/{relationship_id}", headers=csrf_headers(client))
    assert gone.status_code == 404
    listed = client.get(COLLECTION).json()
    assert relationship_id not in {item["id"] for item in listed["items"]}
    assert listed["total"] == 3
