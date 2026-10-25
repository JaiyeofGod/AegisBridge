"""ThreatFox and URLhaus ingestion. Feeds are fixtures, never live HTTP."""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient
from redis import Redis
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.integrations.threat_intel.errors import ThreatFeedError
from app.integrations.threat_intel.http import HttpxFeedClient
from app.integrations.threat_intel.normalize import normalize_domain, normalize_hash, normalize_url
from app.integrations.threat_intel.threatfox import THREATFOX_URL, parse_threatfox
from app.integrations.threat_intel.urlhaus import URLHAUS_URL, parse_urlhaus
from app.main import create_app
from app.models.auth import UserCredential
from app.models.identity import User
from app.models.intelligence_sync import IntelligenceSyncRun
from app.models.threat_intel import ThreatAdvisory, ThreatIndicator, ThreatIntelSource
from app.models.vulnerability import Vulnerability
from app.security.passwords import hash_password
from app.services.threat_intel_sync import SYNC_TYPE, sync_threat_intelligence_iocs
from app.workers.celery_app import celery_app
from app.workers.lock import LOCK_KEY, THREAT_IOC_LOCK_KEY, RedisSyncLock
from app.workers.tasks import sync_threat_intelligence_iocs_task

AUTH = "unit-test-auth-key"
DEV_PASSWORD = "Dev-Only-Local-Password-1!"
ADMIN_EMAIL = "amara.okonkwo@aegisbridge.example"
AUDITOR_EMAIL = "marcus.reid@aegisbridge.example"
NOW = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)
SHA256 = "b325c92fa540edeb89b95dbfd4400c1cb33599c66859a87aead820e568a2ebe7"


class MemoryLock:
    def __init__(self, *, held: bool = False) -> None:
        self.held = held
        self.acquires = 0
        self.released: str | None = None

    def acquire(self) -> str | None:
        self.acquires += 1
        if self.held:
            return None
        self.held = True
        return "token"

    def release(self, token: str) -> None:
        self.released = token
        if token == "token":
            self.held = False


class ScriptedFeed:
    def __init__(self, responses: dict[str, object]) -> None:
        self.responses = responses
        self.calls: list[tuple[str, str, dict[str, object] | None]] = []

    def request(
        self,
        method: str,
        url: str,
        *,
        json_body: dict[str, object] | None = None,
    ) -> dict[str, object]:
        self.calls.append((method, url, json_body))
        payload = self.responses[url]
        if isinstance(payload, Exception):
            raise payload
        return cast(dict[str, object], payload)

    def close(self) -> None:
        return None


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    def set(self, key: str, value: str, nx: bool = False, ex: int | None = None) -> bool | None:
        if nx and key in self.values:
            return None
        self.values[key] = value
        return True

    def eval(self, script: str, numkeys: int, key: str, token: str) -> int:
        if self.values.get(key) == token:
            del self.values[key]
            return 1
        return 0

    def close(self) -> None:
        return None


def _settings(**overrides: object):
    get_settings.cache_clear()
    values: dict[str, object] = {"abusech_auth_key": AUTH, "threat_intel_sync_enabled": True}
    values.update(overrides)
    return get_settings().model_copy(update=values)


def _sync(client: ScriptedFeed, lock: MemoryLock | None = None, **overrides: object):
    return sync_threat_intelligence_iocs(
        client=client,
        settings=_settings(**overrides),
        lock=lock or MemoryLock(),
        now=NOW,
    )


def _threatfox(*items: dict[str, object], status: str = "ok") -> dict[str, object]:
    return {"query_status": status, "data": list(items)}


def _domain(value: str = "Gaga.COM.", **extra: object) -> dict[str, object]:
    item: dict[str, object] = {
        "id": "41",
        "ioc": value,
        "threat_type": "botnet_cc",
        "threat_type_desc": "botnet command and control",
        "ioc_type": "domain",
        "ioc_type_desc": "Domain used for botnet command and control",
        "malware": "win.dridex",
        "malware_printable": "Dridex",
        "malware_alias": None,
        "malware_malpedia": "https://malpedia.caad.fkie.fraunhofer.de/details/win.dridex",
        "confidence_level": 50,
        "first_seen": "2020-12-08 13:36:27 UTC",
        "last_seen": "2020-12-09 01:00:00 UTC",
        "reporter": "abuse_ch",
        "reference": "https://threatfox.abuse.ch/ioc/41",
        "tags": ["exe", "<script>alert(1)</script>"],
    }
    item.update(extra)
    return item


def _urlhaus(*rows: dict[str, object], status: str = "ok") -> dict[str, object]:
    return {"query_status": status, "urls": list(rows)}


def _url(value: str = "http://81.2.69.142:55871/mozi.m", **extra: object) -> dict[str, object]:
    item: dict[str, object] = {
        "id": "1656008",
        "urlhaus_reference": "https://urlhaus.abuse.ch/url/1656008/",
        "url": value,
        "url_status": "online",
        "host": "81.2.69.142",
        "date_added": "2021-10-05 13:57:05 UTC",
        "last_online": "2021-10-06 01:00:00 UTC",
        "threat": "malware_download",
        "blacklists": {"spamhaus_dbl": "not listed"},
        "reporter": "tammeto",
        "larted": "true",
        "tags": ["elf", "Mozi"],
    }
    item.update(extra)
    return item


@pytest.fixture
def seeded(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    _restore()
    yield
    _restore()
    get_settings.cache_clear()


def _restore() -> None:
    with SessionLocal() as session:
        sources = session.scalars(
            select(ThreatIntelSource).where(
                ThreatIntelSource.human_id.in_(["SRC-0004", "SRC-0005"])
            )
        ).all()
        source_ids = [row.id for row in sources]
        if source_ids:
            session.execute(
                delete(ThreatIndicator).where(ThreatIndicator.source_id.in_(source_ids))
            )
        notes = {
            "SRC-0004": "Catalog name only. The ThreatFox feed is not connected.",
            "SRC-0005": "Catalog name only. The URLhaus feed is not connected.",
        }
        for row in sources:
            row.connection_status = "not_connected"
            row.notes = notes[row.human_id]
        session.execute(
            delete(IntelligenceSyncRun).where(IntelligenceSyncRun.sync_type == SYNC_TYPE)
        )
        session.commit()


def test_normalization_rejects_invalid_values_and_keeps_text() -> None:
    assert normalize_domain("Gaga.COM.") == "gaga.com"
    assert normalize_domain("<script>alert(1)</script>") is None
    assert normalize_hash(SHA256.upper(), "sha256") == SHA256
    assert normalize_hash("zzzz", "sha256") is None
    assert normalize_hash("abcd", "md5") is None
    preserved = normalize_url("HTTPS://Example.com/a?q=<script>alert(1)</script>")
    assert preserved == "https://example.com/a?q=<script>alert(1)</script>"
    assert normalize_url("javascript:alert(1)") is None
    ip = parse_threatfox(
        _threatfox(_domain(ioc="203.0.113.10:443", ioc_type="ip:port", id="7")),
        limit=10,
    ).records[0]
    assert ip.indicator_subtype == "ipv4"
    assert ip.normalized_value == "203.0.113.10:443"
    assert (
        parse_threatfox(
            _threatfox(_domain(ioc="999.1.1.1:80", ioc_type="ip:port")),
            limit=10,
        ).records
        == ()
    )


def test_threatfox_parser_maps_fields_and_skips_malformed_items() -> None:
    oversized = "t" * 80
    batch = parse_threatfox(
        _threatfox(
            _domain(),
            _domain(ioc="203.0.113.10:443", ioc_type="ip:port", id="42"),
            _domain(ioc=SHA256, ioc_type="sha256_hash", id="43", tags=[oversized, "ok"]),
            _domain(ioc="not a domain", id="44"),
            _domain(ioc=SHA256, ioc_type="sha256_hash", id="43"),
            {"ioc_type": "domain"},
        ),
        limit=10,
    )
    assert batch.skipped == 2
    kinds = {record.indicator_subtype for record in batch.records}
    assert kinds == {"domain", "ipv4", "sha256"}
    domain = next(record for record in batch.records if record.indicator_subtype == "domain")
    assert domain.source_record_id == "41"
    assert domain.normalized_value == "gaga.com"
    assert domain.observed_value == "Gaga.COM."
    assert domain.malware_family == "Dridex"
    assert domain.threat_type == "botnet_cc"
    assert domain.source_confidence == 50
    assert "<script>alert(1)</script>" in domain.tags
    assert domain.reference_url == "https://threatfox.abuse.ch/ioc/41"
    digest = next(record for record in batch.records if record.indicator_subtype == "sha256")
    assert digest.tags == ("ok",)
    assert "malpedia" not in domain.summary.lower()


def test_urlhaus_parser_maps_urls_and_skips_malformed_rows() -> None:
    batch = parse_urlhaus(
        _urlhaus(
            _url(),
            _url(tags="elf,Mozi,<script>x</script>"),
            _url(url="notaurl", id="2"),
            _url(tags="None", id="3", url_status="offline"),
            {"url_status": "online"},
        ),
        limit=10,
    )
    assert batch.skipped == 2
    assert len(batch.records) == 3
    first = batch.records[0]
    assert first.indicator_type == "url"
    assert first.normalized_value == "http://81.2.69.142:55871/mozi.m"
    assert first.source_status == "online"
    assert first.threat_type == "malware_download"
    assert first.tags == ("elf", "Mozi")
    assert first.source_confidence is None
    assert first.first_seen == datetime(2021, 10, 5, 13, 57, 5, tzinfo=UTC)
    assert first.last_seen == datetime(2021, 10, 6, 1, 0, tzinfo=UTC)
    assert "Host context: 81.2.69.142" in first.summary
    assert "not an asset compromise" in first.summary
    assert batch.records[2].source_status == "offline"
    assert batch.records[2].tags == ()


def test_record_limit_counts_the_remainder_as_skipped() -> None:
    batch = parse_urlhaus(
        _urlhaus(
            _url(id="1", url="https://one.example/a"),
            _url(id="2", url="https://two.example/a"),
            _url(id="3", url="https://three.example/a"),
        ),
        limit=1,
    )
    assert len(batch.records) == 1
    assert batch.skipped == 2


def test_http_retries_transient_status_and_rejects_unofficial_targets() -> None:
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] == 1:
            return httpx.Response(503, json={"error": "busy"})
        return httpx.Response(200, json={"query_status": "no_results"})

    client = HttpxFeedClient(
        _settings(threat_intel_max_bytes=1000),
        httpx.Client(transport=httpx.MockTransport(handler)),
        backoff_seconds=0,
    )
    try:
        body = client.request("GET", URLHAUS_URL)
    finally:
        client.close()
    assert body["query_status"] == "no_results"
    assert calls["count"] == 2
    with pytest.raises(ThreatFeedError) as unauthorized:
        HttpxFeedClient(
            _settings(),
            httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(401))),
            backoff_seconds=0,
        ).request("POST", THREATFOX_URL, json_body={"query": "get_iocs", "days": 1})
    assert unauthorized.value.reason == "unauthorized"
    blocked = httpx.Client(transport=httpx.MockTransport(_forbid_network))
    with pytest.raises(ThreatFeedError) as rejected:
        HttpxFeedClient(_settings(), blocked).request("GET", "https://127.0.0.1/recent")
    assert rejected.value.reason == "endpoint_rejected"
    with pytest.raises(ThreatFeedError) as missing:
        HttpxFeedClient(_settings(abusech_auth_key=None), blocked).request("GET", URLHAUS_URL)
    assert missing.value.reason == "auth_unconfigured"


def test_missing_auth_does_not_call_the_client(seeded: None) -> None:
    client = ScriptedFeed({})
    result = _sync(client, abusech_auth_key=None)
    assert client.calls == []
    assert result["status"] == "skipped"
    assert result["reason"] == "auth_unconfigured"
    assert result["run_id"] is None
    assert result["failed_source_count"] == 0
    _assert_seed_preserved()


def test_both_sources_dedupe_and_keep_separate_provenance(seeded: None) -> None:
    shared = "https://shared.example/a?q=<script>alert(1)</script>"
    client = ScriptedFeed(
        {
            THREATFOX_URL: _threatfox(
                _domain(),
                _domain(ioc="gaga.com", id="99", malware_printable="Other"),
                _domain(ioc=shared, ioc_type="url", id="100"),
            ),
            URLHAUS_URL: _urlhaus(_url(url=shared, id="77", tags="elf,<b>tag</b>")),
        }
    )
    result = _sync(client, threat_intel_ioc_limit=10, threatfox_days=9)
    assert result["status"] == "completed"
    assert result["ioc_inserted_count"] == 3
    assert result["ioc_skipped_count"] == 1
    assert client.calls[0][2] == {"query": "get_iocs", "days": 7}
    with SessionLocal() as session:
        rows = _rows(session)
        assert len(rows) == 3
        by_source = {row.source.human_id: row for row in rows if "shared.example" in row.value}
        assert set(by_source) == {"SRC-0004", "SRC-0005"}
        assert by_source["SRC-0004"].human_id != by_source["SRC-0005"].human_id
        assert by_source["SRC-0005"].source_confidence is None
        fox = session.scalar(
            select(ThreatIndicator).where(ThreatIndicator.normalized_value == "gaga.com")
        )
        assert fox is not None
        assert fox.malware_family == "Other"
        assert fox.source_confidence == 50
        assert fox.confidence is None
        assert fox.fetched_at == NOW
        stable_id = fox.human_id
    again = _sync(client)
    assert again["ioc_inserted_count"] == 0
    assert again["ioc_updated_count"] == 3
    with SessionLocal() as session:
        assert len(_rows(session)) == 3
        fox = session.scalar(
            select(ThreatIndicator).where(ThreatIndicator.normalized_value == "gaga.com")
        )
        assert fox is not None
        assert fox.human_id == stable_id


def test_partial_and_total_source_failure_preserve_existing_rows(seeded: None) -> None:
    _sync(
        ScriptedFeed(
            {
                THREATFOX_URL: _threatfox(_domain()),
                URLHAUS_URL: _urlhaus(status="no_results"),
            }
        )
    )
    failed_fox = ScriptedFeed(
        {
            THREATFOX_URL: ThreatFeedError("timeout"),
            URLHAUS_URL: _urlhaus(_url()),
        }
    )
    partial = _sync(failed_fox)
    assert partial["status"] == "partial"
    assert partial["failed_source_count"] == 1
    assert partial["urlhaus_count"] == 1
    with SessionLocal() as session:
        assert _count(session, "gaga.com") == 1
        assert _count(session, "http://81.2.69.142:55871/mozi.m") == 1
        fox = session.scalar(
            select(ThreatIntelSource).where(ThreatIntelSource.human_id == "SRC-0004")
        )
        haus = session.scalar(
            select(ThreatIntelSource).where(ThreatIntelSource.human_id == "SRC-0005")
        )
        assert fox is not None and fox.connection_status == "healthy"
        assert haus is not None and haus.connection_status == "healthy"
    both = _sync(
        ScriptedFeed(
            {
                THREATFOX_URL: ThreatFeedError("network"),
                URLHAUS_URL: ThreatFeedError("invalid_json"),
            }
        )
    )
    assert both["status"] == "failed"
    assert both["failed_source_count"] == 2
    with SessionLocal() as session:
        assert _count(session, "gaga.com") == 1
        assert _count(session, "http://81.2.69.142:55871/mozi.m") == 1
    _assert_seed_preserved()


def test_zero_rows_and_one_source_record_accurate_counts(seeded: None) -> None:
    empty = _sync(
        ScriptedFeed(
            {
                THREATFOX_URL: _threatfox(status="no_results"),
                URLHAUS_URL: _urlhaus(status="no_results"),
            }
        )
    )
    assert empty["status"] == "completed"
    assert empty["ioc_inserted_count"] == 0
    assert empty["threatfox_count"] == 0
    assert empty["urlhaus_count"] == 0
    one = _sync(
        ScriptedFeed(
            {
                THREATFOX_URL: _threatfox(_domain(ioc="only.example")),
                URLHAUS_URL: _urlhaus(status="no_results"),
            }
        )
    )
    assert one["status"] == "completed"
    assert one["threatfox_count"] == 1
    assert one["urlhaus_count"] == 0
    with SessionLocal() as session:
        run = session.get(IntelligenceSyncRun, UUID(str(one["run_id"])))
        assert run is not None
        assert run.sync_type == SYNC_TYPE
        assert run.tracked_cve_count == 0
        assert run.ioc_inserted_count == 1
        assert "only.example" not in (run.summary or "")


def test_malformed_items_do_not_fail_the_source_run(seeded: None) -> None:
    result = _sync(
        ScriptedFeed(
            {
                THREATFOX_URL: _threatfox(
                    _domain(ioc="good.example"),
                    _domain(ioc="<script>", id="2"),
                    _domain(ioc="zzzz", ioc_type="sha256_hash", id="3"),
                ),
                URLHAUS_URL: _urlhaus(_url(url="https://ok.example/a"), {"url": "::::"}),
            }
        )
    )
    assert result["status"] == "completed"
    assert result["ioc_inserted_count"] == 2
    assert result["ioc_skipped_count"] == 3


def test_limit_is_enforced_per_source(seeded: None) -> None:
    result = _sync(
        ScriptedFeed(
            {
                THREATFOX_URL: _threatfox(
                    _domain(ioc="one.example", id="1"),
                    _domain(ioc="two.example", id="2"),
                ),
                URLHAUS_URL: _urlhaus(status="no_results"),
            }
        ),
        threat_intel_ioc_limit=1,
    )
    assert result["threatfox_count"] == 1
    assert result["ioc_skipped_count"] == 1


def test_lock_held_skips_without_fetching(seeded: None) -> None:
    client = ScriptedFeed({THREATFOX_URL: _threatfox(_domain()), URLHAUS_URL: _urlhaus()})
    result = _sync(client, MemoryLock(held=True))
    assert result["status"] == "skipped"
    assert result["reason"] == "lock_held"
    assert client.calls == []
    assert result["run_id"] is None


def test_disabled_sync_does_not_acquire_the_lock() -> None:
    lock = MemoryLock()
    result = _sync(ScriptedFeed({}), lock, threat_intel_sync_enabled=False)
    assert result["reason"] == "disabled"
    assert lock.acquires == 0


def test_overlap_lock_is_separate_from_vulnerability_sync() -> None:
    client = FakeRedis()
    vulnerability = RedisSyncLock(cast(Redis, client), 30, key=LOCK_KEY)
    indicators = RedisSyncLock(cast(Redis, client), 30, key=THREAT_IOC_LOCK_KEY)
    first = vulnerability.acquire()
    second = indicators.acquire()
    assert first is not None and second is not None
    assert indicators.acquire() is None
    indicators.release("other-token")
    assert THREAT_IOC_LOCK_KEY in client.values
    indicators.release(second)
    assert THREAT_IOC_LOCK_KEY not in client.values
    assert LOCK_KEY in client.values


def test_schedule_and_task_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    schedule = dict(celery_app.conf.beat_schedule)
    entry = schedule["threat-intelligence-iocs"]
    assert entry["task"] == "intelligence.sync_threat_intelligence_iocs"
    assert entry["options"] == {"queue": "intelligence"}
    cron = entry["schedule"]
    assert set(cron.hour) == {0, 6, 12, 18}
    assert set(cron.minute) == {15}
    vulnerability = schedule["vulnerability-intelligence-daily"]["schedule"]
    assert set(vulnerability.hour) == {6}
    assert set(vulnerability.minute) == {0}
    task = cast(Any, sync_threat_intelligence_iocs_task)
    assert task.max_retries == 0
    assert task.name == "intelligence.sync_threat_intelligence_iocs"
    assert task.run.__code__.co_argcount == 0
    seen: dict[str, object] = {}

    def fake(**kwargs: object) -> dict[str, object]:
        seen["keys"] = sorted(kwargs)
        return {
            "status": "skipped",
            "reason": "disabled",
            "run_id": None,
            "threatfox_count": 0,
            "urlhaus_count": 0,
            "ioc_inserted_count": 0,
            "ioc_updated_count": 0,
            "ioc_skipped_count": 0,
            "failed_source_count": 0,
        }

    monkeypatch.setattr("app.workers.tasks.sync_threat_intelligence_iocs", fake)
    monkeypatch.setattr("app.workers.tasks.Redis.from_url", lambda *args, **kwargs: FakeRedis())
    result = task.run()
    assert seen["keys"] == ["lock", "settings"]
    assert result["reason"] == "disabled"


def test_read_api_exposes_feed_fields_without_raw_payloads(
    seeded: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    shared_query = "https://cdn.example/a?file=payload.exe&note=<script>alert(1)</script>"
    _sync(
        ScriptedFeed(
            {
                THREATFOX_URL: _threatfox(
                    _domain(ioc="alpha.example", id="1"),
                    _domain(ioc="203.0.113.8:443", ioc_type="ip:port", id="2"),
                    _domain(ioc="beta.example", id="3"),
                ),
                URLHAUS_URL: _urlhaus(_url(url=shared_query, host="cdn.example", id="9")),
            }
        )
    )
    application = create_app()
    with TestClient(application) as client:
        anonymous = client.get("/api/v1/threat-intelligence/indicators")
        assert anonymous.status_code == 401
        login = client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL, "password": DEV_PASSWORD},
        )
        assert login.status_code == 200
        listed = client.get(
            "/api/v1/threat-intelligence/indicators",
            params={"source": "SRC-0004", "page": 1, "page_size": 1},
        )
        assert listed.status_code == 200
        body = listed.json()
        assert body["total"] == 3
        assert len(body["items"]) == 1
        page2 = client.get(
            "/api/v1/threat-intelligence/indicators",
            params={"source": "ThreatFox", "page": 2, "page_size": 1},
        ).json()
        assert page2["items"][0]["id"] != body["items"][0]["id"]
        found = client.get(
            "/api/v1/threat-intelligence/indicators",
            params={"search": "alpha.example", "indicator_type": "domain", "source": "SRC-0004"},
        ).json()
        assert found["total"] == 1
        detail = client.get(
            f"/api/v1/threat-intelligence/indicators/{found['items'][0]['id']}"
        ).json()
        assert detail["indicator_subtype"] == "domain"
        assert detail["malware_family"] == "Dridex"
        assert detail["threat_type"] == "botnet_cc"
        assert detail["source_confidence"] == 50
        assert detail["confidence"] is None
        assert detail["data_origin"] == "external_feed"
        assert detail["fetched_at"] is not None
        assert "<script>alert(1)</script>" in detail["tags"]
        assert "ioc_type_desc" not in detail
        assert "query_status" not in detail
        assert "malware_malpedia" not in detail
        encoded = str(detail)
        assert "unit-test-auth-key" not in encoded
        assert (
            re.search(
                r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
                encoded,
                re.IGNORECASE,
            )
            is None
        )
        addresses = client.get(
            "/api/v1/threat-intelligence/indicators",
            params={"indicator_type": "ip", "source": "SRC-0004"},
        ).json()
        assert addresses["total"] == 1
        urls = client.get(
            "/api/v1/threat-intelligence/indicators",
            params={"search": "payload.exe", "indicator_type": "url", "source": "URLhaus"},
        ).json()
        assert urls["total"] == 1
        url_detail = client.get(
            f"/api/v1/threat-intelligence/indicators/{urls['items'][0]['id']}"
        ).json()
        assert url_detail["source_status"] == "online"
        assert url_detail["source_confidence"] is None
        assert "<script>alert(1)</script>" in url_detail["value"]
        seed_detail = client.get("/api/v1/threat-intelligence/indicators/IOC-0002").json()
        assert seed_detail["data_origin"] == "simulated"
        assert seed_detail["confidence"] == "medium"
        spec = client.get("/openapi.json").json()
        properties = spec["components"]["schemas"]["IndicatorDetail"]["properties"]
        assert "indicator_subtype" in properties
        assert "raw_payload" not in properties
    with SessionLocal() as session:
        user = session.scalar(select(User).where(User.email == AUDITOR_EMAIL))
        assert user is not None
        credential = session.scalar(select(UserCredential).where(UserCredential.user_id == user.id))
        digest = hash_password(DEV_PASSWORD)
        if credential is None:
            session.add(UserCredential(user_id=user.id, password_hash=digest, algorithm="argon2id"))
        else:
            credential.password_hash = digest
        session.commit()
    with TestClient(application) as auditor_client:
        logged_in = auditor_client.post(
            "/api/v1/auth/login",
            json={"email": AUDITOR_EMAIL, "password": DEV_PASSWORD},
        )
        assert logged_in.status_code == 200
        denied = auditor_client.get("/api/v1/threat-intelligence/indicators")
        assert denied.status_code == 403


def test_logs_omit_indicator_values_and_the_auth_key(
    seeded: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.DEBUG):
        _sync(
            ScriptedFeed(
                {
                    THREATFOX_URL: _threatfox(_domain()),
                    URLHAUS_URL: _urlhaus(_url()),
                }
            )
        )
    assert "gaga.com" not in caplog.text.lower()
    assert AUTH not in caplog.text
    assert "mozi.m" not in caplog.text


def _rows(session: Session) -> list[ThreatIndicator]:
    return list(
        session.scalars(
            select(ThreatIndicator)
            .join(ThreatIntelSource)
            .where(ThreatIntelSource.human_id.in_(["SRC-0004", "SRC-0005"]))
        ).all()
    )


def _count(session: Session, value: str) -> int:
    return int(
        session.scalar(
            select(func.count())
            .select_from(ThreatIndicator)
            .where(ThreatIndicator.normalized_value == value)
        )
        or 0
    )


def _forbid_network(request: httpx.Request) -> httpx.Response:
    raise AssertionError(f"unexpected network call {request.url}")


def _assert_seed_preserved() -> None:
    with SessionLocal() as session:
        for human_id in ("IOC-0001", "IOC-0002", "IOC-0003"):
            assert (
                session.scalar(select(ThreatIndicator).where(ThreatIndicator.human_id == human_id))
                is not None
            )
        assert (
            session.scalar(select(ThreatAdvisory).where(ThreatAdvisory.human_id == "ADV-0001"))
            is not None
        )
        assert (
            session.scalar(select(Vulnerability).where(Vulnerability.human_id == "VULN-0041"))
            is not None
        )
