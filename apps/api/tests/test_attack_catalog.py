"""Pinned ATT&CK Enterprise catalog. The STIX fixture is local. No live MITRE calls."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterator
from datetime import datetime

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select, update
from tests.test_authorization import login_as_role

from app.core.config import Settings
from app.core.db import SessionLocal
from app.integrations.attack.errors import AttackIngestError
from app.integrations.attack.http import _body
from app.integrations.attack.parse import parse_enterprise_bundle
from app.models.attack_catalog import (
    AttackCatalogTactic,
    AttackCatalogTacticLink,
    AttackCatalogTechnique,
    AttackRelease,
)
from app.models.detection import AttackTechnique
from app.services.attack_sync import sync_attack_enterprise

UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)


def _settings() -> Settings:
    return Settings(_env_file=None, attack_enterprise_version="20.0")  # type: ignore[arg-type]


def _object(object_type: str, stix_id: str, **fields: object) -> dict[str, object]:
    return {"type": object_type, "id": stix_id, "spec_version": "2.1", **fields}


def _reference(external_id: str) -> list[dict[str, str]]:
    return [{"source_name": "mitre-attack", "external_id": external_id}]


def _bundle(version: str = "20.0", *, extra: list[dict[str, object]] | None = None) -> bytes:
    objects: list[dict[str, object]] = [
        _object(
            "x-mitre-collection",
            "x-mitre-collection--11111111-1111-4111-8111-111111111111",
            name="Enterprise ATT&CK",
            x_mitre_version=version,
        ),
        _object(
            "x-mitre-tactic",
            "x-mitre-tactic--22222222-2222-4222-8222-222222222222",
            name="Execution",
            x_mitre_shortname="execution",
            description="Run the payload.",
            modified="2024-04-11T00:00:00.000Z",
            x_mitre_version="1.2",
            external_references=_reference("TA0002"),
        ),
        _object(
            "x-mitre-tactic",
            "x-mitre-tactic--33333333-3333-4333-8333-333333333333",
            name="Persistence",
            x_mitre_shortname="persistence",
            modified="2024-04-11T00:00:00Z",
            external_references=_reference("TA0003"),
        ),
        _object(
            "attack-pattern",
            "attack-pattern--44444444-4444-4444-8444-444444444444",
            name="Command and Scripting Interpreter",
            description="Parent technique.",
            modified="2024-05-01T12:00:00.000Z",
            x_mitre_version="2.0",
            x_mitre_is_subtechnique=False,
            x_mitre_platforms=["Windows", "Linux"],
            kill_chain_phases=[
                {"kill_chain_name": "mitre-attack", "phase_name": "execution"},
                {"kill_chain_name": "mitre-attack", "phase_name": "persistence"},
            ],
            external_references=_reference("T1059"),
        ),
        _object(
            "attack-pattern",
            "attack-pattern--55555555-5555-4555-8555-555555555555",
            name="PowerShell",
            description="Sub-technique.",
            modified="2024-05-02T00:00:00.000Z",
            x_mitre_is_subtechnique=True,
            x_mitre_platforms=["Windows"],
            kill_chain_phases=[{"kill_chain_name": "mitre-attack", "phase_name": "execution"}],
            external_references=_reference("T1059.001"),
        ),
        _object(
            "relationship",
            "relationship--66666666-6666-4666-8666-666666666666",
            relationship_type="subtechnique-of",
            source_ref="attack-pattern--55555555-5555-4555-8555-555555555555",
            target_ref="attack-pattern--44444444-4444-4444-8444-444444444444",
        ),
        _object(
            "attack-pattern",
            "attack-pattern--77777777-7777-4777-8777-777777777777",
            name="Old Revoked Technique",
            revoked=True,
            kill_chain_phases=[{"kill_chain_name": "mitre-attack", "phase_name": "execution"}],
            external_references=_reference("T9999"),
        ),
        _object(
            "attack-pattern",
            "attack-pattern--88888888-8888-4888-8888-888888888888",
            name="Old Deprecated Technique",
            x_mitre_deprecated=True,
            kill_chain_phases=[{"kill_chain_name": "mitre-attack", "phase_name": "persistence"}],
            external_references=_reference("T9998"),
        ),
        _object(
            "attack-pattern",
            "attack-pattern--99999999-9999-4999-8999-999999999999",
            name="Missing external id",
        ),
        _object(
            "course-of-action",
            "course-of-action--aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            name="Not ingested",
        ),
    ]
    if extra:
        objects.extend(extra)
    return json.dumps({"type": "bundle", "spec_version": "2.1", "objects": objects}).encode()


def _sync(payload: bytes, **overrides: object):
    values: dict[str, object] = {
        "attack_enterprise_version": "20.0",
        "attack_stix_timeout_seconds": 2,
        "attack_stix_max_bytes": 1000,
    }
    values.update(overrides)
    settings = Settings(_env_file=None, **values)  # type: ignore[arg-type]
    return sync_attack_enterprise(payload=payload, settings=settings)


def _clear_catalog() -> None:
    with SessionLocal() as session:
        session.execute(delete(AttackCatalogTacticLink))
        session.execute(update(AttackCatalogTechnique).values(parent_technique_id=None))
        session.execute(delete(AttackCatalogTechnique))
        session.execute(delete(AttackCatalogTactic))
        session.execute(delete(AttackRelease))
        session.commit()


@pytest.fixture
def catalog() -> Iterator[None]:
    _clear_catalog()
    yield
    _clear_catalog()


def test_parser_reads_tactics_techniques_and_relationships() -> None:
    parsed = parse_enterprise_bundle(json.loads(_bundle()), "20.0")
    tactics = {item.external_id: item for item in parsed.tactics}
    techniques = {item.external_id: item for item in parsed.techniques}
    assert set(tactics) == {"TA0002", "TA0003"}
    assert tactics["TA0002"].short_name == "execution"
    assert tactics["TA0002"].modified_at == datetime.fromisoformat("2024-04-11T00:00:00+00:00")
    parent = techniques["T1059"]
    child = techniques["T1059.001"]
    assert parent.stix_id.startswith("attack-pattern--")
    assert parent.tactic_short_names == ("execution", "persistence")
    assert parent.platforms == ("Windows", "Linux")
    assert child.is_subtechnique is True
    assert child.parent_stix_id == parent.stix_id
    assert techniques["T9999"].revoked is True
    assert techniques["T9998"].deprecated is True
    assert "T0000" not in techniques
    assert parsed.skipped_count >= 1


def test_version_mismatch_and_malformed_bundle_fail_closed() -> None:
    with pytest.raises(AttackIngestError) as mismatch:
        parse_enterprise_bundle(json.loads(_bundle("19.0")), "20.0")
    assert mismatch.value.reason == "version_mismatch"
    with pytest.raises(AttackIngestError) as broken:
        parse_enterprise_bundle({"type": "bundle", "spec_version": "2.0", "objects": []}, "20.0")
    assert broken.value.reason == "malformed_bundle"
    official_shape = json.loads(_bundle())
    del official_shape["spec_version"]
    parsed = parse_enterprise_bundle(official_shape, "20.0")
    assert parsed.stix_version == "2.1"
    for item in official_shape["objects"]:
        if item["type"] == "x-mitre-collection":
            item["spec_version"] = "2.0"
    with pytest.raises(AttackIngestError) as collection_spec:
        parse_enterprise_bundle(official_shape, "20.0")
    assert collection_spec.value.reason == "malformed_bundle"


def test_http_body_rejects_html_and_oversized_payloads() -> None:
    html = httpx.Response(
        200,
        content=b"<html></html>",
        headers={"content-type": "text/html"},
        request=httpx.Request("GET", "https://example.invalid/attack"),
    )
    with pytest.raises(AttackIngestError) as rejected:
        _body(html, 1000)
    assert rejected.value.reason == "malformed_bundle"
    large = httpx.Response(
        200,
        content=b"{}",
        headers={"content-type": "application/json"},
        request=httpx.Request("GET", "https://example.invalid/attack"),
    )
    with pytest.raises(AttackIngestError) as oversized:
        _body(large, 1)
    assert oversized.value.reason == "response_too_large"


def test_ingest_is_idempotent_and_records_the_hash(
    catalog: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_fetch(settings: Settings) -> bytes:
        raise AssertionError(settings.attack_enterprise_stix_url)

    monkeypatch.setattr("app.services.attack_sync.fetch_attack_bundle", fail_fetch)
    payload = _bundle()
    with SessionLocal() as session:
        before_refs = session.scalar(select(func.count()).select_from(AttackTechnique))
    first = _sync(payload)
    second = _sync(payload)
    assert first["status"] == "completed"
    assert second["status"] == "completed"
    assert first["bundle_sha256"] == hashlib.sha256(payload).hexdigest()
    assert first["release_version"] == "20.0"
    assert first["tactics_processed"] == 2
    assert first["techniques_processed"] == 3
    assert first["subtechniques_processed"] == 1
    assert first["revoked_count"] == 1
    assert first["deprecated_count"] == 1
    with SessionLocal() as session:
        assert session.scalar(select(func.count()).select_from(AttackRelease)) == 1
        release = session.scalar(select(AttackRelease).where(AttackRelease.active.is_(True)))
        assert release is not None
        assert release.version == "20.0"
        assert release.bundle_sha256 == first["bundle_sha256"]
        assert release.stix_version == "2.1"
        assert session.scalar(select(func.count()).select_from(AttackCatalogTactic)) == 2
        assert session.scalar(select(func.count()).select_from(AttackCatalogTechnique)) == 4
        assert session.scalar(select(func.count()).select_from(AttackTechnique)) == before_refs


def test_failed_ingest_preserves_the_active_release(catalog: None) -> None:
    assert _sync(_bundle())["status"] == "completed"
    failed = _sync(_bundle("19.0"))
    assert failed["status"] == "failed"
    assert failed["reason"] == "version_mismatch"
    broken = _sync(b"not-json")
    assert broken["reason"] == "malformed_bundle"
    with SessionLocal() as session:
        release = session.scalar(select(AttackRelease).where(AttackRelease.active.is_(True)))
        assert release is not None
        assert release.version == "20.0"
        assert session.scalar(select(func.count()).select_from(AttackCatalogTechnique)) == 4


def test_pinned_source_url_is_server_controlled() -> None:
    settings = _settings()
    assert settings.attack_enterprise_version == "20.0"
    assert settings.attack_enterprise_stix_url.endswith("enterprise-attack-20.0.json")
    assert "latest" not in settings.attack_enterprise_stix_url


def test_attack_reads_require_auth_and_hide_internal_ids(
    catalog: None,
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", "Dev-Only-Local-Password-1!")
    assert _sync(_bundle())["status"] == "completed"
    unauthenticated = client.get("/api/v1/attack/tactics")
    assert unauthenticated.status_code == 401
    login_as_role(client, "Auditor")
    forbidden = client.get("/api/v1/attack/techniques")
    assert forbidden.status_code == 403
    login_as_role(client, "Administrator")
    tactics = client.get("/api/v1/attack/tactics")
    assert tactics.status_code == 200
    assert [item["id"] for item in tactics.json()] == ["TA0002", "TA0003"]
    assert tactics.json()[0]["release"] == "20.0"
    by_id = client.get("/api/v1/attack/techniques", params={"q": "T1059", "page_size": 10})
    assert [item["id"] for item in by_id.json()["items"]] == ["T1059", "T1059.001"]
    by_name = client.get("/api/v1/attack/techniques", params={"q": "PowerShell"})
    assert [item["id"] for item in by_name.json()["items"]] == ["T1059.001"]
    by_tactic = client.get("/api/v1/attack/techniques", params={"tactic": "persistence"})
    visible = {item["id"] for item in by_tactic.json()["items"]}
    assert "T1059" in visible
    assert "T9998" not in visible
    parents = client.get("/api/v1/attack/techniques", params={"include_subtechniques": False})
    assert [item["id"] for item in parents.json()["items"]] == ["T1059"]
    hidden = client.get("/api/v1/attack/techniques", params={"page_size": 100})
    assert "T9999" not in {item["id"] for item in hidden.json()["items"]}
    assert "T9998" not in {item["id"] for item in hidden.json()["items"]}
    included = client.get("/api/v1/attack/techniques", params={"include_deprecated": True})
    included_ids = {item["id"] for item in included.json()["items"]}
    assert {"T9999", "T9998"} <= included_ids
    second_page = client.get("/api/v1/attack/techniques", params={"page": 2, "page_size": 1})
    assert second_page.status_code == 200
    assert [item["id"] for item in second_page.json()["items"]] == ["T1059.001"]
    empty = client.get("/api/v1/attack/techniques", params={"page": 9, "page_size": 1})
    assert empty.status_code == 200
    assert empty.json()["items"] == []
    assert empty.json()["total"] == 2
    detail = client.get("/api/v1/attack/techniques/T1059.001")
    assert detail.status_code == 200
    body = detail.json()
    assert body["parent"]["id"] == "T1059"
    assert body["is_subtechnique"] is True
    assert body["description"] == "Sub-technique."
    assert body["platforms"] == ["Windows"]
    assert body["tactics"][0]["id"] == "TA0002"
    assert body["release"] == "20.0"
    assert body["modified_at"].startswith("2024-05-02")
    assert UUID_RE.search(detail.text) is None
    assert "description" not in by_id.json()["items"][0]
    revoked = client.get("/api/v1/attack/techniques/T9999")
    assert revoked.status_code == 200
    assert revoked.json()["revoked"] is True
    missing = client.get("/api/v1/attack/techniques/T0000")
    assert missing.status_code == 404
    spec = client.get("/openapi.json").json()
    assert set(spec["paths"]["/api/v1/attack/techniques"]) == {"get"}
    assert "/api/v1/attack" not in spec["paths"] or "post" not in spec["paths"]["/api/v1/attack"]
    parameters = spec["paths"]["/api/v1/attack/techniques"]["get"]["parameters"]
    names = {item["name"] for item in parameters}
    assert {
        "page",
        "page_size",
        "q",
        "tactic",
        "include_subtechniques",
        "include_deprecated",
    } <= names
