"""Private evidence object upload/download/delete tests (memory storage)."""

from __future__ import annotations

import hashlib
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from tests.csrf_helpers import csrf_headers
from tests.test_authorization import login_as_role

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.audit import AuditEvent
from app.models.evidence import Evidence, EvidenceObject
from app.security.csrf import CSRF_HEADER_NAME
from app.storage.factory import get_object_storage, set_object_storage_override
from app.storage.memory import MemoryObjectStorage

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
ADMIN_EMAIL = "amara.okonkwo@aegisbridge.example"


@pytest.fixture
def memory_storage():
    storage = MemoryObjectStorage(bucket="aegis-test-evidence")
    set_object_storage_override(storage)
    get_object_storage.cache_clear()
    yield storage
    set_object_storage_override(None)
    get_object_storage.cache_clear()
    storage.clear()


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, memory_storage: MemoryObjectStorage):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("OBJECT_STORAGE_PROVIDER", "memory")
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    application = create_app()
    with TestClient(application) as test_client:
        yield test_client
    get_settings.cache_clear()
    os.environ.pop("AEGIS_DEV_ADMIN_PASSWORD", None)


def _login(client: TestClient):
    return client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": DEV_PASSWORD})


def _create_evidence(client: TestClient, title: str = "Upload target") -> str:
    created = client.post(
        "/api/v1/evidence",
        json={"title": title, "data_classification": "simulated"},
        headers=csrf_headers(client),
    )
    assert created.status_code == 200
    return created.json()["id"]


def test_upload_requires_manage_csrf_and_persists_hash(
    client: TestClient, memory_storage: MemoryObjectStorage
) -> None:
    login_as_role(client, "Auditor")
    evidence_id = None
    # Auditor cannot create; use admin for record then switch.
    client.cookies.clear()
    login_as_role(client, "Administrator")
    evidence_id = _create_evidence(client)

    login_as_role(client, "Auditor")
    denied = client.post(
        f"/api/v1/evidence/{evidence_id}/object",
        files={"file": ("note.txt", b"hello-evidence", "text/plain")},
        headers=csrf_headers(client),
    )
    assert denied.status_code == 403

    client.cookies.clear()
    assert (
        client.post(
            f"/api/v1/evidence/{evidence_id}/object",
            files={"file": ("note.txt", b"hello-evidence", "text/plain")},
        ).status_code
        == 401
    )

    login_as_role(client, "GRC Analyst")
    missing_csrf = client.post(
        f"/api/v1/evidence/{evidence_id}/object",
        files={"file": ("note.txt", b"hello-evidence", "text/plain")},
    )
    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["code"] == "csrf_failed"

    payload = b"hello-evidence-bytes"
    expected_hash = hashlib.sha256(payload).hexdigest()
    uploaded = client.post(
        f"/api/v1/evidence/{evidence_id}/object",
        files={"file": ("../../etc/passwd", payload, "text/plain")},
        headers=csrf_headers(client),
    )
    assert uploaded.status_code == 200
    body = uploaded.json()
    assert body["object_stored"] is True
    assert body["integrity_verified"] is False
    assert body["sha256"] == expected_hash
    assert body["hash_source"] == "server_calculated_at_ingestion"
    assert body["original_filename"] == "passwd"
    assert body["size_bytes"] == len(payload)
    assert body["storage_provider"] == "memory"
    assert "object_uri" not in body
    assert "object_key" not in body
    assert "AWS_SECRET" not in str(body)
    assert "access_key" not in str(body).lower()

    with SessionLocal() as session:
        evidence = session.scalar(select(Evidence).where(Evidence.human_id == evidence_id))
        assert evidence is not None
        assert evidence.stored_object is not None
        assert evidence.stored_object.sha256 == expected_hash
        assert evidence.stored_object.object_key.startswith(f"evidence/{evidence_id}/")
        assert evidence.stored_object.original_filename == "passwd"
        assert memory_storage.exists(object_key=evidence.stored_object.object_key)
        event = session.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.action == "EVIDENCE_OBJECT_UPLOAD",
                AuditEvent.object_id == evidence_id,
            )
            .order_by(AuditEvent.occurred_at.desc())
        ).first()
        assert event is not None
        assert CSRF_HEADER_NAME.lower() not in (event.detail or "").lower()
        assert "aegis_session" not in (event.detail or "").lower()

    conflict = client.post(
        f"/api/v1/evidence/{evidence_id}/object",
        files={"file": ("again.txt", b"second", "text/plain")},
        headers=csrf_headers(client),
    )
    assert conflict.status_code == 409


def test_upload_rejects_empty_and_oversized(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("EVIDENCE_MAX_UPLOAD_BYTES", "32")
    get_settings.cache_clear()
    login_as_role(client, "GRC Analyst")
    evidence_id = _create_evidence(client, title="Limits")

    empty = client.post(
        f"/api/v1/evidence/{evidence_id}/object",
        files={"file": ("empty.txt", b"", "text/plain")},
        headers=csrf_headers(client),
    )
    assert empty.status_code == 422

    huge = client.post(
        f"/api/v1/evidence/{evidence_id}/object",
        files={"file": ("big.bin", b"x" * 64, "application/octet-stream")},
        headers=csrf_headers(client),
    )
    assert huge.status_code == 422
    detail = client.get(f"/api/v1/evidence/{evidence_id}").json()
    assert detail["object_stored"] is False


def test_download_streams_bytes_and_audits(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    evidence_id = _create_evidence(client, title="Downloadable")
    payload = b"download-me-please"
    assert (
        client.post(
            f"/api/v1/evidence/{evidence_id}/object",
            files={"file": ("report.txt", payload, "text/plain")},
            headers=csrf_headers(client),
        ).status_code
        == 200
    )

    downloaded = client.get(f"/api/v1/evidence/{evidence_id}/object")
    assert downloaded.status_code == 200
    assert downloaded.content == payload
    assert downloaded.headers["content-disposition"].startswith("attachment;")
    assert "report.txt" in downloaded.headers["content-disposition"]
    assert downloaded.headers.get("x-content-type-options") == "nosniff"
    assert "AWS_" not in downloaded.headers.get("content-disposition", "")

    login_as_role(client, "Read Only")
    # Read Only lacks evidence.read in matrix — expect 403.
    assert client.get(f"/api/v1/evidence/{evidence_id}/object").status_code == 403

    client.cookies.clear()
    assert client.get(f"/api/v1/evidence/{evidence_id}/object").status_code == 401

    with SessionLocal() as session:
        assert session.scalars(
            select(AuditEvent).where(AuditEvent.action == "EVIDENCE_OBJECT_DOWNLOAD")
        ).first()


def test_download_missing_object_and_unknown_evidence(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    evidence_id = _create_evidence(client, title="No object yet")
    assert client.get(f"/api/v1/evidence/{evidence_id}/object").status_code == 404
    assert client.get("/api/v1/evidence/EVID-9999/object").status_code == 404


def test_delete_removes_object_preserves_metadata(
    client: TestClient, memory_storage: MemoryObjectStorage
) -> None:
    login_as_role(client, "GRC Analyst")
    evidence_id = _create_evidence(client, title="Deletable")
    payload = b"temporary-bytes"
    assert (
        client.post(
            f"/api/v1/evidence/{evidence_id}/object",
            files={"file": ("tmp.txt", payload, "text/plain")},
            headers=csrf_headers(client),
        ).status_code
        == 200
    )
    with SessionLocal() as session:
        obj = session.scalar(
            select(EvidenceObject).join(Evidence).where(Evidence.human_id == evidence_id)
        )
        assert obj is not None
        key = obj.object_key

    deleted = client.delete(
        f"/api/v1/evidence/{evidence_id}/object",
        headers=csrf_headers(client),
    )
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True
    assert deleted.json()["object_stored"] is False
    assert memory_storage.exists(object_key=key) is False

    detail = client.get(f"/api/v1/evidence/{evidence_id}").json()
    assert detail["id"] == evidence_id
    assert detail["object_stored"] is False
    assert detail["title"] == "Deletable"

    with SessionLocal() as session:
        evidence = session.scalar(select(Evidence).where(Evidence.human_id == evidence_id))
        assert evidence is not None
        assert evidence.stored_object is None
        assert session.scalars(
            select(AuditEvent).where(AuditEvent.action == "EVIDENCE_OBJECT_DELETE")
        ).first()


def test_storage_failure_does_not_mark_stored(
    client: TestClient, memory_storage: MemoryObjectStorage
) -> None:
    class FailingStorage(MemoryObjectStorage):
        def put_file(self, **kwargs):  # type: ignore[no-untyped-def]
            from app.api.errors import ApiError

            raise ApiError(
                503,
                "storage_unavailable",
                "Evidence object storage is temporarily unavailable.",
            )

    set_object_storage_override(FailingStorage())
    get_object_storage.cache_clear()
    login_as_role(client, "GRC Analyst")
    evidence_id = _create_evidence(client, title="Fail upload")
    response = client.post(
        f"/api/v1/evidence/{evidence_id}/object",
        files={"file": ("x.txt", b"data", "text/plain")},
        headers=csrf_headers(client),
    )
    assert response.status_code == 503
    detail = client.get(f"/api/v1/evidence/{evidence_id}").json()
    assert detail["object_stored"] is False
    set_object_storage_override(memory_storage)
    get_object_storage.cache_clear()


def test_db_failure_after_upload_attempts_cleanup(
    client: TestClient, memory_storage: MemoryObjectStorage, monkeypatch: pytest.MonkeyPatch
) -> None:
    login_as_role(client, "GRC Analyst")
    evidence_id = _create_evidence(client, title="Cleanup")

    uploaded = {"done": False}
    real_put = memory_storage.put_file

    def tracking_put(**kwargs):  # type: ignore[no-untyped-def]
        info = real_put(**kwargs)
        uploaded["done"] = True
        return info

    memory_storage.put_file = tracking_put  # type: ignore[method-assign]
    original_commit = Session.commit

    def maybe_boom(self: Session) -> None:
        if uploaded["done"]:
            raise RuntimeError("forced db failure")
        return original_commit(self)

    monkeypatch.setattr(Session, "commit", maybe_boom)
    response = client.post(
        f"/api/v1/evidence/{evidence_id}/object",
        files={"file": ("cleanup.txt", b"cleanup-bytes", "text/plain")},
        headers=csrf_headers(client),
    )
    assert response.status_code == 500
    monkeypatch.undo()
    memory_storage.put_file = real_put  # type: ignore[method-assign]
    assert memory_storage._objects == {}  # noqa: SLF001
    detail = client.get(f"/api/v1/evidence/{evidence_id}").json()
    assert detail["object_stored"] is False


def test_openapi_documents_object_routes(client: TestClient) -> None:
    _login(client)
    spec = client.get("/openapi.json").json()
    assert "/api/v1/evidence/{evidence_id}/object" in spec["paths"]
    methods = set(spec["paths"]["/api/v1/evidence/{evidence_id}/object"])
    assert {"get", "post", "delete"}.issubset(methods)
    post = spec["paths"]["/api/v1/evidence/{evidence_id}/object"]["post"]
    assert {"SessionCookie": []} in post.get("security", [])
