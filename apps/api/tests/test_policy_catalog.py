"""Policy catalog pagination, search, filters, and sort."""

from __future__ import annotations

import os
import re
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from tests.csrf_helpers import csrf_headers
from tests.test_authorization import login_as_role

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.auth import UserCredential
from app.models.identity import User, UserRole
from app.models.organization import Organization
from app.security.passwords import hash_password

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)


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


def _create_draft(client: TestClient, title: str) -> dict:
    response = client.post(
        "/api/v1/policies",
        headers=csrf_headers(client),
        json={
            "title": title,
            "initial_version_label": "0.1",
            "initial_content": "Catalog test body — must not appear in list results.",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_policy_list_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/policies").status_code == 401


def test_policy_list_requires_policy_read(client: TestClient) -> None:
    with SessionLocal() as session:
        org = session.scalar(select(Organization).order_by(Organization.name))
        assert org is not None
        email = f"nopolicread-{uuid.uuid4().hex[:8]}@aegisbridge.example"
        human_id = f"USR-T{uuid.uuid4().hex[:3].upper()}"
        user = User(
            organization_id=org.id,
            human_id=human_id,
            email=email,
            display_name="No Policy Read",
            account_status="active",
            timezone_name="UTC",
        )
        session.add(user)
        session.flush()
        session.execute(delete(UserRole).where(UserRole.user_id == user.id))
        session.add(
            UserCredential(
                user_id=user.id,
                password_hash=hash_password(DEV_PASSWORD),
                algorithm="argon2id",
            )
        )
        session.commit()

    login = client.post("/api/v1/auth/login", json={"email": email, "password": DEV_PASSWORD})
    assert login.status_code == 200
    denied = client.get("/api/v1/policies", params={"q": "incident"})
    assert denied.status_code == 403


def test_policy_pagination_stable_ordering(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    created_ids = [
        _create_draft(client, f"Catalog Policy {suffix}")["id"]
        for suffix in ("Alpha", "Bravo", "Charlie", "Delta")
    ]

    page1 = client.get(
        "/api/v1/policies",
        params={"page": 1, "page_size": 2, "sort": "id", "direction": "asc"},
    ).json()
    page2 = client.get(
        "/api/v1/policies",
        params={"page": 2, "page_size": 2, "sort": "id", "direction": "asc"},
    ).json()
    assert page1["total"] >= 5
    assert page1["total"] == page2["total"]
    ids1 = [item["id"] for item in page1["items"]]
    ids2 = [item["id"] for item in page2["items"]]
    assert len(ids1) == 2
    assert set(ids1).isdisjoint(ids2)
    assert ids1 == sorted(ids1)
    assert ids2 == sorted(ids2)

    beyond = client.get("/api/v1/policies", params={"page": 999, "page_size": 10}).json()
    assert beyond["items"] == []
    assert beyond["total"] == page1["total"]

    too_large = client.get("/api/v1/policies", params={"page_size": 101})
    assert too_large.status_code == 422

    # Created drafts are discoverable among pages
    all_ids = set()
    page_num = 1
    while True:
        window = client.get(
            "/api/v1/policies",
            params={"page": page_num, "page_size": 100, "sort": "id"},
        ).json()
        all_ids.update(item["id"] for item in window["items"])
        if page_num * 100 >= window["total"]:
            break
        page_num += 1
    assert set(created_ids).issubset(all_ids)


def test_policy_search_and_status_filter(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    incident = _create_draft(client, "Incident Response Playbook")
    access = _create_draft(client, "Access Review Procedure")

    by_title = client.get("/api/v1/policies", params={"q": "incident"}).json()
    assert by_title["total"] >= 1
    assert any(item["id"] == incident["id"] for item in by_title["items"])
    assert all("content" not in item for item in by_title["items"])
    assert all("initial_content" not in item for item in by_title["items"])
    assert "Catalog test body" not in client.get("/api/v1/policies", params={"q": "incident"}).text

    by_id = client.get("/api/v1/policies", params={"q": access["id"].lower()}).json()
    assert by_id["total"] == 1
    assert by_id["items"][0]["id"] == access["id"]

    empty = client.get("/api/v1/policies", params={"q": "zzznomatch"}).json()
    assert empty["total"] == 0
    assert empty["items"] == []

    drafts = client.get("/api/v1/policies", params={"status": "draft"}).json()
    assert drafts["total"] >= 2
    assert all(item["status"] == "draft" for item in drafts["items"])

    published = client.get("/api/v1/policies", params={"status": "published"}).json()
    assert published["total"] >= 1
    assert all(item["status"] == "published" for item in published["items"])

    combined = client.get(
        "/api/v1/policies",
        params={"q": "access", "status": "draft"},
    ).json()
    assert combined["total"] >= 1
    assert all(item["status"] == "draft" for item in combined["items"])
    assert any(item["id"] == access["id"] for item in combined["items"])

    bad = client.get("/api/v1/policies", params={"status": "bogus"})
    assert bad.status_code == 422

    blob = client.get("/api/v1/policies", params={"page_size": 100}).text
    assert UUID_RE.search(blob) is None


def test_policy_sort_allowlist(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    _create_draft(client, "Zebra Policy")
    _create_draft(client, "Alpha Policy")

    asc = client.get(
        "/api/v1/policies",
        params={"sort": "title", "direction": "asc", "page_size": 100},
    ).json()
    titles = [item["title"] for item in asc["items"]]
    assert len(titles) >= 2

    desc = client.get(
        "/api/v1/policies",
        params={"sort": "title", "direction": "desc", "page_size": 100},
    ).json()
    # DB collation may differ from Python sorted(); require asc/desc to invert.
    assert [item["title"] for item in desc["items"]] == list(reversed(titles))

    rejected = client.get("/api/v1/policies", params={"sort": "owner_user_id"})
    assert rejected.status_code == 422
    bad_dir = client.get(
        "/api/v1/policies",
        params={"sort": "title", "direction": "random"},
    )
    assert bad_dir.status_code == 422


def test_policy_list_openapi_documents_query_params(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    spec = client.get("/openapi.json").json()
    params = {item["name"]: item for item in spec["paths"]["/api/v1/policies"]["get"]["parameters"]}
    for name in ("page", "page_size", "q", "status", "sort", "direction"):
        assert name in params
    assert params["page_size"]["schema"]["maximum"] == 100
    security = spec["paths"]["/api/v1/policies"]["get"].get("security")
    assert security is not None
    assert "SessionCookie" in str(security)
