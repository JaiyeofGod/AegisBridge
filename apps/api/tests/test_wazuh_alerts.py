"""Wazuh indexer alert ingestion. Fixtures stand in for a live indexer."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from redis import Redis
from sqlalchemy import delete, func, select

from app.core.config import Settings, get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.integrations.wazuh.alerts import normalize_hit
from app.integrations.wazuh.client import HttpxWazuhClient, search_url
from app.integrations.wazuh.errors import WazuhError
from app.integrations.wazuh.models import RawAlertPage
from app.models.integration import Integration, IntegrationSyncRun
from app.models.soc import AlertReference
from app.services.wazuh_sync import INTEGRATION_NAME, sync_wazuh_alerts
from app.workers.celery_app import celery_app
from app.workers.lock import WAZUH_ALERT_LOCK_KEY
from app.workers.tasks import sync_wazuh_alerts_task

PASSWORD = "indexer-secret"
NOW = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)
INDEXER = "https://wazuh-indexer.internal:9200"


class MemoryLock:
    def __init__(self, *, held: bool = False) -> None:
        self.held = held
        self.released: str | None = None

    def acquire(self) -> str | None:
        if self.held:
            return None
        self.held = True
        return "token"

    def release(self, token: str) -> None:
        self.released = token
        if token == "token":
            self.held = False


class FakeWazuh:
    def __init__(self, page: RawAlertPage | None = None, error: Exception | None = None) -> None:
        self.page = page or RawAlertPage(hits=(), total=0)
        self.error = error
        self.calls: list[tuple[datetime, int]] = []
        self.closed = False

    def search(self, *, since: datetime, limit: int) -> RawAlertPage:
        self.calls.append((since, limit))
        if self.error is not None:
            raise self.error
        return self.page

    def close(self) -> None:
        self.closed = True


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "wazuh_enabled": True,
        "wazuh_indexer_url": INDEXER,
        "wazuh_username": "indexer-user",
        "wazuh_password": PASSWORD,
        "wazuh_verify_tls": True,
        "wazuh_alert_limit": 500,
        "wazuh_lookback_minutes": 15,
        "app_env": "test",
    }
    values.update(overrides)
    current = get_settings()
    return current.model_copy(update=values)


def _hit(source: dict[str, Any], *, hit_id: str = "indexer-hit") -> dict[str, Any]:
    return {"_index": "wazuh-alerts-4.x-2026.10.24", "_id": hit_id, "_source": source}


def _linux(**extra: object) -> dict[str, Any]:
    source: dict[str, Any] = {
        "timestamp": "2026-10-24T11:50:00.000+0000",
        "id": "1729770600.1001",
        "rule": {
            "level": 5,
            "description": "sshd: authentication failed.",
            "id": "5710",
            "groups": ["syslog", "sshd", "authentication_failed"],
            "mitre": {
                "id": ["T1110"],
                "tactic": ["Credential Access"],
                "technique": ["Brute Force"],
            },
        },
        "agent": {"id": "001", "name": "ubuntu-lab"},
        "manager": {"name": "wazuh-manager"},
        "decoder": {"name": "sshd"},
        "data": {"srcip": "203.0.113.10", "dstuser": "root"},
        "location": "/var/log/auth.log",
        "full_log": "Oct 24 11:50:00 ubuntu sshd[1]: Failed password for root",
    }
    source.update(extra)
    return _hit(source, hit_id="linux-hit")


def _windows() -> dict[str, Any]:
    return _hit(
        {
            "timestamp": "2026-10-24T11:51:00.000+0000",
            "id": "1729770660.1002",
            "rule": {
                "level": 12,
                "description": "Sysmon - Event 1: Process creation <script>alert(1)</script>",
                "id": "61603",
                "groups": ["windows", "sysmon", "sysmon_event1"],
                "mitre": {"id": ["T1059", "T1059.001"], "tactic": ["Execution"]},
            },
            "agent": {"id": "002", "name": "win-lab"},
            "manager": {"name": "wazuh-manager"},
            "decoder": {"name": "windows_eventchannel"},
            "data": {"win": {"eventdata": {"commandLine": "powershell.exe -enc AAAA"}}},
            "full_log": "<Event>raw windows xml</Event>",
        },
        hit_id="windows-hit",
    )


@pytest.fixture
def seeded(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", "Dev-Only-Local-Password-1!")
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("WAZUH_ENABLED", "false")
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    _restore()
    yield
    _restore()
    get_settings.cache_clear()


def _restore() -> None:
    with SessionLocal() as session:
        session.execute(delete(AlertReference).where(AlertReference.data_origin == "wazuh"))
        session.execute(
            delete(IntegrationSyncRun).where(IntegrationSyncRun.integration == INTEGRATION_NAME)
        )
        integration = session.scalar(select(Integration).where(Integration.name == "Wazuh"))
        if integration is not None:
            integration.status = "not_configured"
            integration.auth_state = "No credentials stored"
            if integration.sync_state is not None:
                integration.sync_state.freshness = "not_connected"
                integration.sync_state.last_success_at = None
                integration.sync_state.cursor_label = None
        session.commit()


def _rows() -> list[AlertReference]:
    with SessionLocal() as session:
        return list(
            session.scalars(
                select(AlertReference)
                .where(AlertReference.data_origin == "wazuh")
                .order_by(AlertReference.wazuh_alert_id)
            ).all()
        )


def _sync(
    client: FakeWazuh,
    settings: Settings | None = None,
    lock: MemoryLock | None = None,
) -> dict[str, object]:
    held = lock or MemoryLock()
    result = sync_wazuh_alerts(
        lock=held,
        client=client,
        settings=settings or _settings(),
        now=NOW,
    )
    return dict(result)


def test_normalization_keeps_selected_fields_and_drops_raw_documents() -> None:
    linux = normalize_hit(_linux())
    assert linux is not None
    assert linux.source_alert_id == "1729770600.1001"
    assert linux.rule_id == "5710"
    assert linux.rule_level == 5
    assert linux.description == "sshd: authentication failed."
    assert linux.groups == ("syslog", "sshd", "authentication_failed")
    assert linux.agent_id == "001"
    assert linux.agent_name == "ubuntu-lab"
    assert linux.source_ip == "203.0.113.10"
    assert linux.username == "root"
    assert linux.technique_ids == ("T1110",)
    assert linux.observed_at == datetime(2026, 10, 24, 11, 50, tzinfo=UTC)
    windows = normalize_hit(_windows())
    assert windows is not None
    assert windows.technique_ids == ("T1059", "T1059.001")
    assert "<script>" in windows.description
    assert "powershell.exe" not in windows.description
    huge = _linux()
    huge["_source"]["rule"]["description"] = "A" * 5000 + "\x00\x01tail"
    huge["_source"]["data"]["srcip"] = "not-an-ip"
    huge["_source"]["rule"]["mitre"] = {"id": ["T9999.001", "not-a-technique", "T1059"]}
    huge["_source"]["id"] = "1729770600.1009"
    bounded = normalize_hit(huge)
    assert bounded is not None
    assert len(bounded.description) == 500
    assert "\x00" not in bounded.description
    assert bounded.source_ip is None
    assert bounded.technique_ids == ("T9999.001", "T1059")
    assert normalize_hit({"_source": {"timestamp": "yesterday"}}) is None
    missing_rule = normalize_hit(
        _hit({"id": "1729770600.1010", "timestamp": "2026-10-24T11:52:00.000Z"})
    )
    assert missing_rule is not None
    assert missing_rule.rule_id is None
    assert missing_rule.agent_id is None
    assert missing_rule.description == "Wazuh security alert"


def test_http_client_honors_tls_bounds_and_hides_credentials(
    caplog: pytest.LogCaptureFixture,
) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path.endswith("/missing"):
            return httpx.Response(404)
        return httpx.Response(
            200,
            json={
                "hits": {
                    "total": {"value": 2, "relation": "eq"},
                    "hits": [_linux(), "not-an-object"],
                }
            },
        )

    client = HttpxWazuhClient(
        _settings(),
        transport=httpx.MockTransport(handler),
        sleep=lambda _: None,
    )
    assert client.tls_verify is True
    page = client.search(since=NOW - timedelta(minutes=15), limit=25)
    assert page.total == 2
    assert len(page.hits) == 1
    assert page.omitted == 1
    body = json.loads(seen[0].content)
    assert body["size"] == 25
    assert "full_log" not in body["_source"]["includes"]
    assert "data.win" not in body["_source"]["includes"]
    assert str(seen[0].url).startswith(INDEXER)
    produced = f"{page} {body}"
    assert PASSWORD not in produced
    assert "Authorization" not in produced

    def denied(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": PASSWORD})

    denied_client = HttpxWazuhClient(
        _settings(),
        transport=httpx.MockTransport(denied),
        sleep=lambda _: None,
    )
    with caplog.at_level(logging.DEBUG), pytest.raises(WazuhError) as auth_error:
        denied_client.search(since=NOW, limit=10)
    assert auth_error.value.reason == "auth_failed"
    assert PASSWORD not in caplog.text
    forbidden = HttpxWazuhClient(
        _settings(),
        transport=httpx.MockTransport(lambda _: httpx.Response(403)),
        sleep=lambda _: None,
    )
    with pytest.raises(WazuhError) as forbidden_error:
        forbidden.search(since=NOW, limit=10)
    assert forbidden_error.value.reason == "auth_failed"

    attempts = {"count": 0}

    def failing(_: httpx.Request) -> httpx.Response:
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise httpx.ReadTimeout("timed out")
        return httpx.Response(503)

    retrying = HttpxWazuhClient(
        _settings(),
        transport=httpx.MockTransport(failing),
        sleep=lambda _: None,
    )
    with pytest.raises(WazuhError) as timeout_error:
        retrying.search(since=NOW, limit=10)
    assert timeout_error.value.reason == "http_error"
    assert attempts["count"] == 3

    malformed = HttpxWazuhClient(
        _settings(wazuh_max_bytes=20),
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=b'{"hits":')),
        sleep=lambda _: None,
    )
    with pytest.raises(WazuhError) as malformed_error:
        malformed.search(since=NOW, limit=10)
    assert malformed_error.value.reason in {"malformed_response", "response_too_large"}
    insecure = HttpxWazuhClient(_settings(wazuh_verify_tls=False, app_env="production"))
    assert insecure.tls_verify is True
    local = HttpxWazuhClient(_settings(wazuh_verify_tls=False, app_env="local"))
    assert local.tls_verify is False
    with pytest.raises(WazuhError) as embedded:
        search_url(_settings(wazuh_indexer_url=f"https://user:{PASSWORD}@indexer.internal:9200"))
    assert embedded.value.reason == "not_configured"
    insecure.close()
    local.close()
    client.close()
    denied_client.close()
    forbidden.close()
    retrying.close()
    malformed.close()


def test_disabled_and_unconfigured_make_no_indexer_call(seeded: None) -> None:
    client = FakeWazuh(error=AssertionError("network"))
    lock = MemoryLock()
    disabled = _sync(client, _settings(wazuh_enabled=False), lock)
    assert disabled["status"] == "skipped"
    assert disabled["reason"] == "disabled"
    assert client.calls == []
    assert lock.released is None
    missing = _sync(client, _settings(wazuh_indexer_url=None, wazuh_password=None))
    assert missing["reason"] == "not_configured"
    assert client.calls == []
    assert _rows() == []


def test_duplicate_poll_inserts_one_alert_and_preserves_seed(seeded: None) -> None:
    page = RawAlertPage(hits=(_linux(), _linux(), _windows()), total=2)
    client = FakeWazuh(page)
    first = _sync(client)
    assert first["status"] == "completed"
    assert first["inserted_count"] == 2
    assert first["duplicate_count"] == 1
    second = _sync(FakeWazuh(page))
    assert second["inserted_count"] == 0
    assert second["duplicate_count"] == 3
    rows = _rows()
    assert len(rows) == 2
    assert {row.wazuh_alert_id for row in rows} == {"1729770600.1001", "1729770660.1002"}
    with SessionLocal() as session:
        seed = session.scalar(select(AlertReference).where(AlertReference.human_id == "AL-0107"))
        assert seed is not None
        assert seed.wazuh_alert_id is None
        assert seed.data_origin == "simulated"
        assert seed.telemetry_source == "not_connected"
        stored = " ".join(row.summary for row in rows)
        assert "Failed password" not in stored
        assert "<Event>" not in stored
        integration = session.scalar(select(Integration).where(Integration.name == "Wazuh"))
        assert integration is not None
        assert integration.status == "configured"
        assert integration.sync_state is not None
        assert integration.sync_state.freshness == "healthy"
        assert PASSWORD not in (integration.auth_state or "")


def test_same_timestamp_with_distinct_ids_stays_distinct(seeded: None) -> None:
    first = _linux()
    second = _linux(id="1729770600.2002")
    second["_source"]["timestamp"] = first["_source"]["timestamp"]
    result = _sync(FakeWazuh(RawAlertPage(hits=(first, second), total=2)))
    assert result["inserted_count"] == 2
    assert len(_rows()) == 2


def test_attack_ids_persist_when_catalog_does_not_know_them(seeded: None) -> None:
    source = _windows()["_source"]
    source["rule"]["mitre"]["id"] = ["T1059", "T1059.001", "T9999.001"]
    source["id"] = "1729770660.3003"
    _sync(FakeWazuh(RawAlertPage(hits=(_hit(source),), total=1)))
    row = _rows()[0]
    assert row.attack_technique_ids == ["T1059", "T1059.001", "T9999.001"]
    assert row.severity == "not_assigned"
    assert row.status == "new"
    assert row.source_rule_level == 12


def test_failures_preserve_previously_ingested_alerts(seeded: None) -> None:
    _sync(FakeWazuh(RawAlertPage(hits=(_linux(),), total=1)))
    assert len(_rows()) == 1
    auth = _sync(FakeWazuh(error=WazuhError("auth_failed")))
    assert auth["status"] == "failed"
    assert auth["reason"] == "auth_failed"
    timeout = _sync(FakeWazuh(error=WazuhError("timeout")))
    assert timeout["reason"] == "timeout"
    assert len(_rows()) == 1
    with SessionLocal() as session:
        integration = session.scalar(select(Integration).where(Integration.name == "Wazuh"))
        assert integration is not None
        assert integration.status == "configured"


def test_one_malformed_hit_does_not_drop_the_valid_alert(seeded: None) -> None:
    malformed = {"_source": {"id": " ", "timestamp": "not-a-time", "rule": {}}}
    page = RawAlertPage(
        hits=(_linux(), malformed),
        total=4,
        omitted=1,
    )
    result = _sync(FakeWazuh(page))
    assert result["status"] == "partial"
    assert result["inserted_count"] == 1
    assert result["malformed_count"] == 2
    assert result["skipped_count"] == 1
    assert len(_rows()) == 1


def test_overlap_lock_skips_without_search_and_releases(seeded: None) -> None:
    assert WAZUH_ALERT_LOCK_KEY == "aegis:lock:wazuh_alert_sync"
    client = FakeWazuh(error=AssertionError("network"))
    held = MemoryLock(held=True)
    skipped = _sync(client, lock=held)
    assert skipped["reason"] == "lock_held"
    assert client.calls == []
    lock = MemoryLock()
    _sync(FakeWazuh(RawAlertPage(hits=(), total=0)), lock=lock)
    assert lock.released == "token"


def test_task_contract_and_disabled_exit_avoid_the_broker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    task = celery_app.tasks["soc.sync_wazuh_alerts"]
    assert task.name == "soc.sync_wazuh_alerts"
    assert task.max_retries == 0
    entry = celery_app.conf.beat_schedule["wazuh-alert-sync"]
    assert entry["task"] == "soc.sync_wazuh_alerts"
    assert entry["options"] == {"queue": "integrations"}
    assert set(entry["schedule"].minute) == set(range(0, 60, 5))

    def fail_redis(*_args: object, **_kwargs: object) -> Redis:
        raise AssertionError("broker")

    monkeypatch.setenv("WAZUH_ENABLED", "false")
    get_settings.cache_clear()
    monkeypatch.setattr("app.workers.tasks.Redis.from_url", fail_redis)
    result = sync_wazuh_alerts_task()
    assert result["status"] == "skipped"
    assert result["reason"] == "disabled"
    registered = str(task.run.__defaults__)
    assert PASSWORD not in registered


def test_read_api_exposes_provenance_without_raw_events(seeded: None, client) -> None:
    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "amara.okonkwo@aegisbridge.example",
            "password": "Dev-Only-Local-Password-1!",
        },
    )
    assert login.status_code == 200
    _sync(FakeWazuh(RawAlertPage(hits=(_linux(), _windows()), total=2)))
    listed = client.get("/api/v1/alerts", params={"data_origin": "wazuh"}).json()
    assert listed["total"] == 2
    assert "full_log" not in str(listed)
    assert PASSWORD not in str(listed)
    simulated = client.get("/api/v1/alerts", params={"data_origin": "simulated"}).json()
    assert simulated["items"][0]["id"] == "AL-0107"
    detail = client.get("/api/v1/alerts", params={"search": "1729770600.1001"}).json()
    alert_id = detail["items"][0]["id"]
    body = client.get(f"/api/v1/alerts/{alert_id}").json()
    assert body["data_origin"] == "wazuh"
    assert body["source_rule_id"] == "5710"
    assert body["source_rule_level"] == 5
    assert body["source_agent_id"] == "001"
    assert body["source_agent_name"] == "ubuntu-lab"
    assert body["wazuh_alert_id"] == "1729770600.1001"
    assert body["severity"] == "not_assigned"
    assert body["status"] == "new"
    assert [item["id"] for item in body["attack_technique_ids"]] == ["T1110"]
    assert "raw_event" not in body
    assert "full_log" not in str(body)
    technique = client.get("/api/v1/alerts", params={"attack_technique": "T1059.001"}).json()
    origins = {item["data_origin"] for item in technique["items"]}
    assert "wazuh" in origins
    assert "simulated" in origins
    spec = client.get("/openapi.json").json()
    schema = spec["components"]["schemas"]["AlertDetail"]["properties"]
    assert "source_rule_level" in schema
    assert "password" not in schema
    assert "full_log" not in schema
    with SessionLocal() as session:
        runs = session.scalar(
            select(func.count())
            .select_from(IntegrationSyncRun)
            .where(IntegrationSyncRun.integration == INTEGRATION_NAME)
        )
    assert runs is not None and runs >= 1
