"""Operational user directory: active same-organization selection, not administration."""

from __future__ import annotations

import os
import re
from typing import TypedDict
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from tests.csrf_helpers import csrf_headers
from tests.test_authorization import login_as_role

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.identity import User
from app.models.incident import IncidentTask
from app.models.organization import Department, Organization
from app.security.permissions import PERMISSION_CATALOG, ROLE_PERMISSIONS

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
FORBIDDEN_KEYS = {
    "roles",
    "permissions",
    "email",
    "password",
    "password_hash",
    "credential",
    "credentials",
    "session",
    "sessions",
    "mfa",
    "privileged",
    "access_review",
    "timezone",
    "timezone_name",
    "updated_at",
    "created_at",
    "organization_id",
    "department_id",
    "user_id",
    "grant_source",
}
SAFE_FIELDS = {"id", "display_name", "account_status", "department", "job_title"}


class _DirectoryFixture(TypedDict):
    alpha: str
    bravo: str
    charlie: str
    inactive: str
    other: str
    other_org: str
    active: set[str]
    department_id: UUID
    organization_id: UUID


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


def test_directory_permission_is_operational_not_administrative() -> None:
    assert "directory.manage" not in PERMISSION_CATALOG
    assert "directory.read" in ROLE_PERMISSIONS["Administrator"]
    assert "directory.read" in ROLE_PERMISSIONS["SOC Analyst"]
    assert "directory.read" in ROLE_PERMISSIONS["GRC Analyst"]
    assert "directory.read" in ROLE_PERMISSIONS["Security Engineer"]
    assert "administration.read" not in ROLE_PERMISSIONS["SOC Analyst"]
    assert "directory.read" not in ROLE_PERMISSIONS["CISO"]
    assert "directory.read" not in ROLE_PERMISSIONS["Auditor"]
    assert "directory.read" not in ROLE_PERMISSIONS["Read Only"]


def test_directory_requires_authentication_and_directory_read(client: TestClient) -> None:
    client.cookies.clear()
    anonymous = client.get("/api/v1/directory/users")
    assert anonymous.status_code == 401
    assert anonymous.json()["code"] == "unauthenticated"

    login_as_role(client, "Read Only")
    denied = client.get(
        "/api/v1/directory/users",
        headers={"X-Role": "SOC Analyst", "X-Permission": "directory.read"},
        params={"role": "Administrator"},
    )
    assert denied.status_code == 403
    assert denied.json()["message"] == "You do not have access to this resource."
    assert "SOC Analyst" not in denied.json()["message"]

    login_as_role(client, "SOC Analyst")
    allowed = client.get("/api/v1/directory/users")
    assert allowed.status_code == 200
    assert client.get("/api/v1/administration/users").status_code == 403


def test_directory_lists_only_safe_active_same_org_users(client: TestClient) -> None:
    token = uuid4().hex[:8]
    created = _seed_directory_people(token)
    try:
        login_as_role(client, "SOC Analyst")
        listed = client.get("/api/v1/directory/users", params={"page_size": 100})
        assert listed.status_code == 200
        body = listed.json()
        assert set(body) == {"page", "page_size", "total", "items"}
        ids = {item["id"] for item in body["items"]}
        assert created["active"] <= ids
        assert created["inactive"] not in ids
        assert created["other"] not in ids
        assert "USR-0004" in ids
        jonah = next(item for item in body["items"] if item["id"] == "USR-0004")
        assert jonah["display_name"] == "Jonah Hale"
        assert jonah["account_status"] == "active"
        assert jonah["department"] == "Security"
        assert jonah["job_title"] == "SOC analyst"
        for item in body["items"]:
            assert set(item) == SAFE_FIELDS
            assert item["account_status"] == "active"
            assert item["id"].startswith("USR-")
        encoded = str(body)
        assert UUID_RE.search(encoded) is None
        assert FORBIDDEN_KEYS.isdisjoint(_keys(body))
        assert "argon" not in encoded.lower()
    finally:
        _cleanup_directory_people(created)


def test_directory_search_pagination_and_org_isolation(client: TestClient) -> None:
    token = uuid4().hex[:8]
    created = _seed_directory_people(token)
    try:
        login_as_role(client, "SOC Analyst")
        query = token.upper()
        first = client.get(
            "/api/v1/directory/users",
            params={"q": query.lower(), "page": 1, "page_size": 2},
        )
        assert first.status_code == 200
        page_one = first.json()
        assert page_one["total"] == 3
        assert [item["display_name"] for item in page_one["items"]] == [
            f"Directory Alpha {token}",
            f"Directory Bravo {token}",
        ]
        second = client.get(
            "/api/v1/directory/users",
            params={"q": query, "page": 2, "page_size": 2},
        ).json()
        assert [item["id"] for item in second["items"]] == [created["charlie"]]
        assert set(item["id"] for item in page_one["items"]).isdisjoint(
            item["id"] for item in second["items"]
        )
        beyond = client.get(
            "/api/v1/directory/users",
            params={"q": query, "page": 9, "page_size": 2},
        ).json()
        assert beyond["items"] == []
        assert beyond["total"] == 3

        by_id = client.get(
            "/api/v1/directory/users",
            params={"q": created["bravo"].lower()},
        ).json()
        assert [item["id"] for item in by_id["items"]] == [created["bravo"]]

        by_department = client.get(
            "/api/v1/directory/users",
            params={"q": f"directory lab {token}"},
        ).json()
        assert {item["id"] for item in by_department["items"]} == created["active"]

        assert (
            client.get(
                "/api/v1/directory/users",
                params={"q": f"Directory Delta {token}"},
            ).json()["total"]
            == 0
        )
        assert (
            client.get(
                "/api/v1/directory/users",
                params={"q": created["inactive"]},
            ).json()["total"]
            == 0
        )
        assert (
            client.get(
                "/api/v1/directory/users",
                params={"q": f"Directory Outside {token}"},
            ).json()["total"]
            == 0
        )
        ignored_org = client.get(
            "/api/v1/directory/users",
            params={"q": query, "organization_id": created["other_org"]},
        ).json()
        assert {item["id"] for item in ignored_org["items"]} == created["active"]
        assert client.get("/api/v1/directory/users", params={"page_size": 101}).status_code == 422
        assert client.get("/api/v1/directory/users", params={"page": 0}).status_code == 422
        empty = client.get("/api/v1/directory/users", params={"q": f"missing-{token}"}).json()
        assert empty == {"page": 1, "page_size": 25, "total": 0, "items": []}
    finally:
        _cleanup_directory_people(created)


def test_directory_human_id_is_accepted_as_a_task_assignee(client: TestClient) -> None:
    token = uuid4().hex[:8]
    created = _seed_directory_people(token)
    task_id = None
    try:
        login_as_role(client, "SOC Analyst")
        chosen = client.get(
            "/api/v1/directory/users",
            params={"q": created["alpha"]},
        ).json()["items"][0]["id"]
        assert chosen == created["alpha"]
        before = client.get("/api/v1/incidents/INC-0001").json()
        created_task = client.post(
            "/api/v1/incidents/INC-0001/tasks",
            headers=csrf_headers(client),
            json={"title": f"Directory assignee {token}", "assignee": chosen},
        )
        assert created_task.status_code == 200, created_task.text
        task_id = created_task.json()["id"]
        assert created_task.json()["assignee"]["id"] == chosen
        assert created_task.json()["status"] == "open"
        after = client.get("/api/v1/incidents/INC-0001").json()
        assert after["status"] == before["status"]
        assert after["severity"] == before["severity"]
    finally:
        _cleanup_directory_people(created, task_id=task_id)


def test_openapi_documents_directory_as_read_only(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    operation = spec["paths"]["/api/v1/directory/users"]
    assert set(operation) == {"get"}
    documented = operation["get"]
    assert {"SessionCookie": []} in documented.get("security", [])
    description = documented["description"]
    assert "organization" in description.lower()
    assert "active" in description.lower()
    assert "Administration" in description
    names = {param["name"] for param in documented["parameters"]}
    assert {"page", "page_size", "q"} <= names
    assert "organization_id" not in names
    properties = spec["components"]["schemas"]["DirectoryUser"]["properties"]
    assert set(properties) == SAFE_FIELDS
    assert "email" not in properties
    assert "roles" not in properties


def _seed_directory_people(token: str) -> _DirectoryFixture:
    alpha = f"USR-Y{token[:4].upper()}A"
    bravo = f"USR-Y{token[:4].upper()}B"
    charlie = f"USR-Y{token[:4].upper()}C"
    inactive = f"USR-Y{token[:4].upper()}D"
    outside = f"USR-Y{token[:4].upper()}Z"
    with SessionLocal() as session:
        caller = session.scalar(select(User).where(User.human_id == "USR-0004"))
        assert caller is not None
        org = session.get(Organization, caller.organization_id)
        assert org is not None
        department = Department(organization_id=org.id, name=f"Directory Lab {token}")
        session.add(department)
        session.flush()
        other = Organization(
            name=f"Directory other {token}",
            slug=f"directory-org-{token}",
            environment_label="Lab · Simulated",
            data_origin="simulated",
        )
        session.add(other)
        session.flush()
        rows = [
            (alpha, f"Directory Alpha {token}", "active", org.id, department.id),
            (bravo, f"Directory Bravo {token}", "active", org.id, department.id),
            (charlie, f"Directory Charlie {token}", "active", org.id, department.id),
            (inactive, f"Directory Delta {token}", "inactive", org.id, department.id),
            (outside, f"Directory Outside {token}", "active", other.id, None),
        ]
        for human_id, display_name, status, organization_id, department_id in rows:
            session.add(
                User(
                    organization_id=organization_id,
                    department_id=department_id,
                    human_id=human_id,
                    email=f"{human_id.lower()}@directory.test",
                    display_name=display_name,
                    job_title="Directory picker",
                    account_status=status,
                    timezone_name="UTC",
                )
            )
        session.commit()
        return {
            "alpha": alpha,
            "bravo": bravo,
            "charlie": charlie,
            "inactive": inactive,
            "other": outside,
            "other_org": str(other.id),
            "active": {alpha, bravo, charlie},
            "department_id": department.id,
            "organization_id": other.id,
        }


def _cleanup_directory_people(created: _DirectoryFixture, *, task_id: str | None = None) -> None:
    human_ids = [
        created["alpha"],
        created["bravo"],
        created["charlie"],
        created["inactive"],
        created["other"],
    ]
    with SessionLocal() as session:
        if task_id:
            session.execute(delete(IncidentTask).where(IncidentTask.human_id == task_id))
        session.execute(delete(User).where(User.human_id.in_(human_ids)))
        session.execute(delete(Department).where(Department.id == created["department_id"]))
        session.execute(delete(Organization).where(Organization.id == created["organization_id"]))
        session.commit()


def _keys(value: object):
    if isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _keys(item)
    elif isinstance(value, list):
        for item in value:
            yield from _keys(item)
