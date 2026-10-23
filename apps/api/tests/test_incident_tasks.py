"""Incident response task reads and writes. Completion does not close the incident."""

from __future__ import annotations

import os
import re
import threading
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from tests.csrf_helpers import csrf_headers
from tests.test_authorization import login_as_role

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.audit import AuditEvent
from app.models.identity import User, UserRole
from app.models.incident import Incident, IncidentTask
from app.models.organization import Organization
from app.schemas.incidents import IncidentTaskCreate
from app.security.rbac import AuthenticatedPrincipal
from app.services.incident_tasks import create_incident_task

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
SEEDED = {
    "TASK-0001": ("Review affected host telemetry", "open", None),
    "TASK-0002": ("Validate containment evidence", "in_progress", "USR-0004"),
    "TASK-0003": ("Document recovery verification", "open", None),
}


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    _restore_task_fixtures()
    application = create_app()
    with TestClient(application) as test_client:
        yield test_client
    _restore_task_fixtures()
    get_settings.cache_clear()
    os.environ.pop("AEGIS_DEV_ADMIN_PASSWORD", None)


def test_incident_read_lists_tasks_without_internal_ids(client: TestClient) -> None:
    client.cookies.clear()
    assert client.get("/api/v1/incidents/INC-0001/tasks").status_code == 401

    login_as_role(client, "Read Only")
    listed = client.get("/api/v1/incidents/INC-0001/tasks")
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] == 3
    assert [item["id"] for item in body["items"]] == ["TASK-0001", "TASK-0002", "TASK-0003"]
    assert body["items"][1]["assignee"]["id"] == "USR-0004"
    assert "email" not in body["items"][1]["assignee"]
    assert UUID_RE.search(str(body)) is None

    detail = client.get("/api/v1/incidents/INC-0001/tasks/TASK-0002")
    assert detail.status_code == 200
    assert detail.json()["incident_id"] == "INC-0001"
    assert detail.json()["completed_at"] is None

    missing = client.get("/api/v1/incidents/INC-0001/tasks/TASK-9999")
    assert missing.status_code == 404
    other = _other_incident()
    mismatched = client.get(f"/api/v1/incidents/{other}/tasks/TASK-0001")
    assert mismatched.status_code == 404

    denied = client.post(
        "/api/v1/incidents/INC-0001/tasks",
        json={"title": "Should not persist"},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403


def test_manage_can_create_task_without_changing_the_incident(client: TestClient) -> None:
    login_as_role(client, "SOC Analyst")
    before = client.get("/api/v1/incidents/INC-0001").json()
    missing_csrf = client.post(
        "/api/v1/incidents/INC-0001/tasks",
        json={"title": "Collect simulated log excerpt"},
    )
    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["code"] == "csrf_failed"

    created = client.post(
        "/api/v1/incidents/INC-0001/tasks",
        json={"title": "Collect simulated log excerpt", "assignee": "USR-0004"},
        headers=csrf_headers(client),
    )
    assert created.status_code == 200
    body = created.json()
    assert body["id"] == "TASK-0004"
    assert body["incident_id"] == "INC-0001"
    assert body["status"] == "open"
    assert body["completed_at"] is None
    assert body["assignee"]["id"] == "USR-0004"
    assert UUID_RE.search(str(body)) is None

    after = client.get("/api/v1/incidents/INC-0001").json()
    assert after["status"] == before["status"]
    assert after["severity"] == before["severity"]
    assert after["updated_at"] == before["updated_at"]
    assert after["owner"] == before["owner"]

    rejected = client.post(
        "/api/v1/incidents/INC-0001/tasks",
        json={
            "title": "Bad",
            "human_id": "TASK-0099",
            "completed_at": "2026-01-01T00:00:00Z",
            "status": "not-a-status",
            "permissions": ["incident.close"],
        },
        headers=csrf_headers(client),
    )
    assert rejected.status_code == 422

    with SessionLocal() as session:
        event = session.scalar(
            select(AuditEvent).where(
                AuditEvent.action == "INCIDENT_TASK_CREATE",
                AuditEvent.object_id == "INC-0001:TASK-0004",
            )
        )
    assert event is not None
    assert event.actor_label
    assert "TASK-0004" in (event.detail or "")
    assert "csrf" not in (event.detail or "").lower()


def test_patch_updates_task_and_rejects_stale_or_foreign_ids(client: TestClient) -> None:
    login_as_role(client, "SOC Analyst")
    current = client.get("/api/v1/incidents/INC-0001/tasks/TASK-0001").json()
    stale = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0001",
        json={"title": "Renamed", "expected_updated_at": "2000-01-01T00:00:00Z"},
        headers=csrf_headers(client),
    )
    assert stale.status_code == 409

    unexpected = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0001",
        json={"priority": "high", "completed_at": "2026-01-01T00:00:00Z"},
        headers=csrf_headers(client),
    )
    assert unexpected.status_code == 422

    updated = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0001",
        json={
            "title": "Review simulated host telemetry",
            "status": "blocked",
            "expected_updated_at": current["updated_at"],
        },
        headers=csrf_headers(client),
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "blocked"
    assert updated.json()["title"] == "Review simulated host telemetry"
    assert updated.json()["completed_at"] is None

    other = _other_incident()
    mismatched = client.patch(
        f"/api/v1/incidents/{other}/tasks/TASK-0001",
        json={"title": "Cross incident"},
        headers=csrf_headers(client),
    )
    assert mismatched.status_code == 404

    with SessionLocal() as session:
        event = session.scalar(
            select(AuditEvent).where(
                AuditEvent.action == "INCIDENT_TASK_UPDATE",
                AuditEvent.object_id == "INC-0001:TASK-0001",
            )
        )
    assert event is not None
    assert "blocked" in (event.detail or "")


def test_completion_is_server_owned_and_reopen_clears_it(client: TestClient, monkeypatch) -> None:
    from app.security import permissions as permission_catalog

    narrowed = dict(permission_catalog.ROLE_PERMISSIONS)
    narrowed["SOC Analyst"] = frozenset(
        code for code in narrowed["SOC Analyst"] if code != "incident.close"
    )
    monkeypatch.setattr(permission_catalog, "ROLE_PERMISSIONS", narrowed)
    login_as_role(client, "SOC Analyst")

    incident_before = client.get("/api/v1/incidents/INC-0001").json()
    refused_close = client.patch(
        "/api/v1/incidents/INC-0001",
        json={"status": "resolved"},
        headers=csrf_headers(client),
    )
    assert refused_close.status_code == 403

    current = client.get("/api/v1/incidents/INC-0001/tasks/TASK-0003").json()
    completed = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0003",
        json={"status": "completed", "expected_updated_at": current["updated_at"]},
        headers=csrf_headers(client),
    )
    assert completed.status_code == 200
    assert completed.json()["completed_at"]
    incident_after = client.get("/api/v1/incidents/INC-0001").json()
    assert incident_after["status"] == incident_before["status"]
    assert incident_after["severity"] == incident_before["severity"]

    reopened = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0003",
        json={
            "status": "open",
            "expected_updated_at": completed.json()["updated_at"],
        },
        headers=csrf_headers(client),
    )
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "open"
    assert reopened.json()["completed_at"] is None

    with SessionLocal() as session:
        actions = set(
            session.scalars(
                select(AuditEvent.action).where(
                    AuditEvent.object_id == "INC-0001:TASK-0003",
                    AuditEvent.action.in_(("INCIDENT_TASK_COMPLETE", "INCIDENT_TASK_REOPEN")),
                )
            ).all()
        )
    assert actions == {"INCIDENT_TASK_COMPLETE", "INCIDENT_TASK_REOPEN"}


def test_cancelled_task_stays_readable_and_is_not_completion(client: TestClient) -> None:
    login_as_role(client, "SOC Analyst")
    current = client.get("/api/v1/incidents/INC-0001/tasks/TASK-0001").json()
    cancelled = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0001",
        json={"status": "cancelled", "expected_updated_at": current["updated_at"]},
        headers=csrf_headers(client),
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["completed_at"] is None

    visible = client.get("/api/v1/incidents/INC-0001/tasks/TASK-0001")
    assert visible.status_code == 200
    assert visible.json()["status"] == "cancelled"
    listed = client.get("/api/v1/incidents/INC-0001").json()
    assert listed["open_task_count"] == 2
    spec = client.get("/openapi.json").json()
    methods = set(spec["paths"]["/api/v1/incidents/{incident_id}/tasks/{task_id}"])
    assert "delete" not in methods

    with SessionLocal() as session:
        event = session.scalar(
            select(AuditEvent).where(
                AuditEvent.action == "INCIDENT_TASK_CANCEL",
                AuditEvent.object_id == "INC-0001:TASK-0001",
            )
        )
    assert event is not None


def test_assignee_must_be_an_active_user_in_the_incident_organization(client: TestClient) -> None:
    login_as_role(client, "SOC Analyst")
    current = client.get("/api/v1/incidents/INC-0001/tasks/TASK-0001").json()
    unknown = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0001",
        json={"assignee": "USR-9999", "expected_updated_at": current["updated_at"]},
        headers=csrf_headers(client),
    )
    assert unknown.status_code == 422

    uuid_assignee = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0001",
        json={
            "assignee": "550e8400-e29b-41d4-a716-446655440000",
            "expected_updated_at": current["updated_at"],
        },
        headers=csrf_headers(client),
    )
    assert uuid_assignee.status_code == 422

    _set_account_status("USR-0005", "inactive")
    inactive = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0001",
        json={"assignee": "USR-0005", "expected_updated_at": current["updated_at"]},
        headers=csrf_headers(client),
    )
    assert inactive.status_code == 422
    assert inactive.json()["message"] == "Assignee must be an active user."

    outsider = _other_org_user()
    foreign = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0001",
        json={"assignee": outsider, "expected_updated_at": current["updated_at"]},
        headers=csrf_headers(client),
    )
    assert foreign.status_code == 422
    assert foreign.json()["message"] == "Assignee user was not found."


def test_task_list_is_paged_and_filtered(client: TestClient) -> None:
    login_as_role(client, "Read Only")
    first = client.get(
        "/api/v1/incidents/INC-0001/tasks",
        params={"page": 1, "page_size": 1},
    ).json()
    assert first["total"] == 3
    assert first["items"][0]["id"] == "TASK-0001"
    second = client.get(
        "/api/v1/incidents/INC-0001/tasks",
        params={"page": 2, "page_size": 1},
    ).json()
    assert second["items"][0]["id"] == "TASK-0002"
    assert (
        client.get(
            "/api/v1/incidents/INC-0001/tasks",
            params={"page_size": 101},
        ).status_code
        == 422
    )
    assert (
        client.get(
            "/api/v1/incidents/INC-0001/tasks",
            params={"status": "not-a-status"},
        ).status_code
        == 422
    )

    login_as_role(client, "SOC Analyst")
    current = client.get("/api/v1/incidents/INC-0001/tasks/TASK-0001").json()
    completed = client.patch(
        "/api/v1/incidents/INC-0001/tasks/TASK-0001",
        json={"status": "completed", "expected_updated_at": current["updated_at"]},
        headers=csrf_headers(client),
    )
    assert completed.status_code == 200
    ordered = client.get("/api/v1/incidents/INC-0001/tasks", params={"page_size": 10}).json()
    assert [item["id"] for item in ordered["items"]] == ["TASK-0002", "TASK-0003", "TASK-0001"]
    only_completed = client.get(
        "/api/v1/incidents/INC-0001/tasks",
        params={"status": "completed"},
    ).json()
    assert [item["id"] for item in only_completed["items"]] == ["TASK-0001"]


def test_concurrent_creates_allocate_distinct_task_ids(client: TestClient) -> None:
    """Two sessions serialize on the task-id lock. HTTP is not required for that."""
    del client
    principal = _task_actor()
    barrier = threading.Barrier(2)
    found: list[str] = []
    errors: list[BaseException] = []
    collected = threading.Lock()

    def create(title: str) -> None:
        try:
            barrier.wait(timeout=5)
            with SessionLocal() as session:
                record = create_incident_task(
                    session,
                    principal,
                    "INC-0001",
                    IncidentTaskCreate(title=title),
                )
            with collected:
                found.append(record.id)
        except BaseException as exc:
            with collected:
                errors.append(exc)

    workers = [
        threading.Thread(target=create, args=(f"Concurrent simulated task {index}",))
        for index in (1, 2)
    ]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=10)

    assert errors == []
    assert len(found) == 2
    assert len(set(found)) == 2
    assert all(re.fullmatch(r"TASK-\d{4}", task_id) for task_id in found)
    with SessionLocal() as session:
        stored = set(
            session.scalars(select(IncidentTask.human_id).where(IncidentTask.human_id.in_(found)))
        )
        seeded = set(
            session.scalars(
                select(IncidentTask.human_id).where(IncidentTask.human_id.in_(tuple(SEEDED)))
            )
        )
    assert stored == set(found)
    assert seeded == set(SEEDED)


def test_openapi_documents_task_routes(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    collection = spec["paths"]["/api/v1/incidents/{incident_id}/tasks"]
    single = spec["paths"]["/api/v1/incidents/{incident_id}/tasks/{task_id}"]
    assert {"get", "post"} <= set(collection)
    assert {"get", "patch"} <= set(single)
    assert "delete" not in collection
    assert "delete" not in single
    assert {"SessionCookie": []} in collection["post"].get("security", [])
    assert {"SessionCookie": []} in single["patch"].get("security", [])
    assert "CSRF" in collection["post"]["description"]
    assert "CSRF" in single["patch"]["description"]
    schemas = spec["components"]["schemas"]
    assert schemas["IncidentTaskCreate"]["additionalProperties"] is False
    assert schemas["IncidentTaskUpdate"]["additionalProperties"] is False
    assert "TASK-NNNN" in collection["get"]["description"]


def _task_actor() -> AuthenticatedPrincipal:
    now = datetime.now(UTC)
    with SessionLocal() as session:
        user = session.scalar(select(User).where(User.human_id == "USR-0004"))
        assert user is not None
        return AuthenticatedPrincipal(
            user_id=user.id,
            human_id=user.human_id,
            email=user.email,
            display_name=user.display_name,
            account_status=user.account_status,
            department=None,
            organization_name="AegisBridge Technologies",
            organization_slug="aegisbridge-technologies",
            environment_label="Lab · Simulated",
            data_origin="simulated",
            roles=("SOC Analyst",),
            permissions=("incident.manage",),
            privileged=False,
            session_human_id="SES-TASK-LOCK",
            session_created_at=now,
            session_expires_at=now,
            session_last_seen_at=now,
            timezone_name=user.timezone_name,
            job_title=user.job_title,
            created_at=user.created_at,
        )


def _other_incident() -> str:
    human_id = f"INC-T{uuid4().hex[:4].upper()}"
    with SessionLocal() as session:
        source = session.scalar(select(Incident).where(Incident.human_id == "INC-0001"))
        assert source is not None
        session.add(
            Incident(
                organization_id=source.organization_id,
                human_id=human_id,
                title="Second simulated incident",
                severity="low",
                status="resolved",
                summary="Fixture only. Not a confirmed compromise.",
            )
        )
        session.commit()
    return human_id


def _other_org_user() -> str:
    human_id = f"USR-Z{uuid4().hex[:4].upper()}"
    with SessionLocal() as session:
        org = Organization(
            name="Other task org",
            slug=f"other-org-{uuid4().hex[:8]}",
            environment_label="Lab · Simulated",
            data_origin="simulated",
        )
        session.add(org)
        session.flush()
        session.add(
            User(
                organization_id=org.id,
                human_id=human_id,
                email=f"{human_id.lower()}@example.test",
                display_name="Outside User",
                account_status="active",
                timezone_name="UTC",
            )
        )
        session.commit()
    return human_id


def _set_account_status(human_id: str, status: str) -> None:
    with SessionLocal() as session:
        user = session.scalar(select(User).where(User.human_id == human_id))
        assert user is not None
        user.account_status = status
        session.commit()


def _restore_task_fixtures() -> None:
    with SessionLocal() as session:
        session.execute(delete(IncidentTask).where(IncidentTask.human_id.not_in(tuple(SEEDED))))
        for human_id, (title, status, assignee_human_id) in SEEDED.items():
            task = session.scalar(select(IncidentTask).where(IncidentTask.human_id == human_id))
            if task is None:
                continue
            assignee_id = None
            if assignee_human_id is not None:
                assignee = session.scalar(select(User).where(User.human_id == assignee_human_id))
                assignee_id = None if assignee is None else assignee.id
            task.title = title
            task.status = status
            task.completed_at = None
            task.assignee_user_id = assignee_id
        session.execute(delete(Incident).where(Incident.human_id.like("INC-T%")))
        outside_org_ids = list(
            session.scalars(
                select(Organization.id).where(Organization.slug.like("other-org-%"))
            ).all()
        )
        if outside_org_ids:
            outside_user_ids = list(
                session.scalars(
                    select(User.id).where(User.organization_id.in_(outside_org_ids))
                ).all()
            )
            if outside_user_ids:
                session.execute(delete(UserRole).where(UserRole.user_id.in_(outside_user_ids)))
                session.execute(delete(User).where(User.id.in_(outside_user_ids)))
            session.execute(delete(Organization).where(Organization.id.in_(outside_org_ids)))
        auditor = session.scalar(select(User).where(User.human_id == "USR-0005"))
        if auditor is not None:
            auditor.account_status = "active"
        session.commit()
