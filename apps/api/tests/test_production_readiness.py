"""Production configuration, headers, cookies, CORS, trusted hosts, and readiness."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from starlette.responses import Response

from app.api.v1.auth import _set_session_cookie
from app.bootstrap import BootstrapError, validate_bootstrap_password
from app.core.config import Settings, get_settings
from app.core.production import ProductionConfigError, require_production, review_production
from app.db.seed import production_seed_permitted
from app.main import create_app
from app.security.login_limit import LoginRateLimiter
from app.security.sessions import cookie_secure

SECRET = "p" * 48


def _production(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "APP_ENV": "production",
        "DATABASE_URL": "postgresql+psycopg://aegis_app:example-secret@db.internal:5432/aegis",
        "SESSION_SECRET": SECRET,
        "SESSION_COOKIE_SECURE": True,
        "CORS_ORIGINS": "https://app.example",
        "PUBLIC_API_URL": "https://api.example",
        "TRUSTED_HOSTS": "api.example",
        "FORWARDED_ALLOW_IPS": "*",
        "OBJECT_STORAGE_PROVIDER": "r2",
        "S3_ENDPOINT_URL": "https://accountid.r2.cloudflarestorage.com",
        "AWS_ACCESS_KEY_ID": "r2-access-example",
        "AWS_SECRET_ACCESS_KEY": "r2-secret-example",
        "S3_BUCKET": "aegis-prod-evidence",
        "S3_REGION": "auto",
        "CELERY_BROKER_URL": "rediss://broker.internal:6379/0",
        "REDIS_URL": "rediss://broker.internal:6379/0",
        "AEGIS_DEV_ADMIN_PASSWORD": "",
        "WAZUH_ENABLED": False,
    }
    values.update(overrides)
    return Settings.model_validate(values)


@pytest.fixture
def production_app(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    for key, value in {
        "APP_ENV": "production",
        "DATABASE_URL": "postgresql+psycopg://aegis_app:example-secret@db.internal:5432/aegis",
        "SESSION_SECRET": SECRET,
        "SESSION_COOKIE_SECURE": "true",
        "CORS_ORIGINS": "https://app.example",
        "PUBLIC_API_URL": "https://api.example",
        "TRUSTED_HOSTS": "api.example",
        "FORWARDED_ALLOW_IPS": "*",
        "OBJECT_STORAGE_PROVIDER": "r2",
        "S3_ENDPOINT_URL": "https://accountid.r2.cloudflarestorage.com",
        "AWS_ACCESS_KEY_ID": "r2-access-example",
        "AWS_SECRET_ACCESS_KEY": "r2-secret-example",
        "S3_BUCKET": "aegis-prod-evidence",
        "S3_REGION": "auto",
        "CELERY_BROKER_URL": "rediss://broker.internal:6379/0",
        "REDIS_URL": "rediss://broker.internal:6379/0",
        "AEGIS_DEV_ADMIN_PASSWORD": "",
        "WAZUH_ENABLED": "false",
    }.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    with TestClient(create_app(), base_url="https://api.example") as client:
        yield client
    get_settings.cache_clear()


def test_valid_production_settings_are_accepted() -> None:
    reviewed = review_production(_production())
    assert reviewed.ready is True
    assert reviewed.issues == ()


def test_production_rejects_missing_and_insecure_settings() -> None:
    weak = review_production(_production(SESSION_SECRET="change-me-generate-a-long-random-secret"))
    assert any("SESSION_SECRET" in issue for issue in weak.issues)
    missing_db = review_production(_production(DATABASE_URL=""))
    assert any("DATABASE_URL" in issue for issue in missing_db.issues)
    local_db = review_production(
        _production(DATABASE_URL="postgresql+psycopg://aegis:aegis@localhost:5432/aegis")
    )
    assert any("localhost" in issue for issue in local_db.issues)
    wildcard = review_production(_production(CORS_ORIGINS="*"))
    assert any("wildcard" in issue for issue in wildcard.issues)
    http_origin = review_production(_production(CORS_ORIGINS="http://app.example"))
    assert any("https" in issue for issue in http_origin.issues)
    insecure_cookie = review_production(_production(SESSION_COOKIE_SECURE="false"))
    assert any("SESSION_COOKIE_SECURE" in issue for issue in insecure_cookie.issues)
    dev_bucket = review_production(_production(S3_BUCKET="aegis-dev-evidence"))
    assert any("S3_BUCKET" in issue for issue in dev_bucket.issues)
    region = review_production(_production(S3_REGION="us-east-1"))
    assert any("S3_REGION" in issue for issue in region.issues)
    same_origin = review_production(
        _production(CORS_ORIGINS="https://api.example", PUBLIC_API_URL="https://api.example")
    )
    assert any("frontend origin" in issue for issue in same_origin.issues)
    local_broker = review_production(_production(CELERY_BROKER_URL="redis://localhost:6379/0"))
    assert any("CELERY_BROKER_URL" in issue for issue in local_broker.issues)
    dev_password = review_production(_production(AEGIS_DEV_ADMIN_PASSWORD="local-only"))
    assert any("AEGIS_DEV_ADMIN_PASSWORD" in issue for issue in dev_password.issues)
    with pytest.raises(ProductionConfigError):
        require_production(_production(PUBLIC_API_URL="http://api.example"))


def test_local_configuration_is_not_a_production_deployment() -> None:
    reviewed = review_production(Settings(APP_ENV="local"))
    assert reviewed.ready is False


def test_optional_wazuh_and_feeds_do_not_block_startup() -> None:
    reviewed = review_production(
        _production(WAZUH_ENABLED="false", NVD_API_KEY="", ABUSECH_AUTH_KEY="")
    )
    assert reviewed.ready is True
    assert any("Wazuh: disabled" in note for note in reviewed.notes)


def test_enabled_wazuh_requires_a_remote_https_indexer() -> None:
    reviewed = review_production(
        _production(
            WAZUH_ENABLED="true",
            WAZUH_INDEXER_URL="http://127.0.0.1:9200",
            WAZUH_USERNAME="wazuh",
            WAZUH_PASSWORD="secret",
        )
    )
    assert reviewed.ready is False
    assert any("WAZUH_INDEXER_URL" in issue for issue in reviewed.issues)


def test_production_headers_on_success_and_unknown_route(production_app: TestClient) -> None:
    live = production_app.get("/api/v1/health/live")
    missing = production_app.get("/api/v1/not-a-route")
    for response in (live, missing):
        assert response.headers["strict-transport-security"] == "max-age=15552000"
        assert "includeSubDomains" not in response.headers["strict-transport-security"]
        assert "preload" not in response.headers["strict-transport-security"]
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["referrer-policy"] == "no-referrer"
        assert response.headers["x-frame-options"] == "DENY"
        assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
        assert "*" not in response.headers["content-security-policy"]
        assert "database_url" not in response.text
        assert "example-secret" not in response.text
    assert live.status_code == 200
    assert missing.status_code == 404


def test_local_responses_omit_hsts(client: TestClient) -> None:
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert "strict-transport-security" not in response.headers
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_forwarded_https_sets_hsts_only_from_the_trusted_proxy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("FORWARDED_ALLOW_IPS", "testclient")
    for key, value in {
        "DATABASE_URL": "postgresql+psycopg://aegis_app:example-secret@db.internal:5432/aegis",
        "SESSION_SECRET": SECRET,
        "SESSION_COOKIE_SECURE": "true",
        "CORS_ORIGINS": "https://app.example",
        "PUBLIC_API_URL": "https://api.example",
        "TRUSTED_HOSTS": "api.example",
        "OBJECT_STORAGE_PROVIDER": "r2",
        "S3_ENDPOINT_URL": "https://accountid.r2.cloudflarestorage.com",
        "AWS_ACCESS_KEY_ID": "r2-access-example",
        "AWS_SECRET_ACCESS_KEY": "r2-secret-example",
        "S3_BUCKET": "aegis-prod-evidence",
        "S3_REGION": "auto",
        "CELERY_BROKER_URL": "rediss://broker.internal:6379/0",
        "AEGIS_DEV_ADMIN_PASSWORD": "",
    }.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    with TestClient(create_app(), base_url="http://api.example") as client:
        forwarded = client.get("/api/v1/health/live", headers={"x-forwarded-proto": "https"})
        plain = client.get("/api/v1/health/live")
    get_settings.cache_clear()
    assert "strict-transport-security" in forwarded.headers
    assert "strict-transport-security" not in plain.headers


def test_production_cookie_is_secure_and_local_cookie_is_not() -> None:
    assert cookie_secure(_production()) is True
    assert cookie_secure(Settings(APP_ENV="local", SESSION_COOKIE_SECURE=None)) is False
    response = Response()
    _set_session_cookie(response, "opaque-token", _production())
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "secure" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie


def test_production_cors_allows_the_configured_origin_only(production_app: TestClient) -> None:
    allowed = production_app.options(
        "/api/v1/health/live",
        headers={
            "Origin": "https://app.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    rejected = production_app.options(
        "/api/v1/health/live",
        headers={
            "Origin": "https://unknown.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert allowed.headers["access-control-allow-origin"] == "https://app.example"
    assert allowed.headers["access-control-allow-credentials"] == "true"
    assert "access-control-allow-origin" not in rejected.headers
    assert "*" not in allowed.headers.get("access-control-allow-origin", "")


def test_unexpected_host_is_rejected(production_app: TestClient) -> None:
    response = production_app.get("/api/v1/health/live", headers={"host": "evil.example"})
    assert response.status_code == 400
    assert "example-secret" not in response.text


def test_postgres_outage_fails_readiness_without_external_dependencies(
    monkeypatch: pytest.MonkeyPatch,
    client: TestClient,
) -> None:
    monkeypatch.setattr("app.api.v1.health.check_database_ready", lambda: False)
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 503
    payload = response.json()
    names = {item["name"]: item for item in payload["checks"]}
    assert names["postgresql"]["status"] == "unavailable"
    assert names["postgresql"]["required"] is True
    assert names["redis"]["required"] is False
    assert names["object_storage"]["required"] is False
    assert "wazuh" not in names
    assert "nvd" not in names
    assert "threatfox" not in names
    assert "postgresql+" not in response.text


def test_login_limiter_resets_after_the_window() -> None:
    limiter = LoginRateLimiter(limit=2, window_seconds=10)
    assert limiter.allow("198.51.100.10", now=0) is True
    assert limiter.allow("198.51.100.10", now=1) is True
    assert limiter.allow("198.51.100.10", now=2) is False
    assert limiter.allow("198.51.100.11", now=2) is True
    assert limiter.allow("198.51.100.10", now=12) is True


def test_production_seed_requires_an_explicit_demo_flag() -> None:
    assert production_seed_permitted("local", demo=False) is True
    assert production_seed_permitted("production", demo=False) is False
    assert production_seed_permitted("production", demo=True) is True


def test_bootstrap_password_policy() -> None:
    validate_bootstrap_password("a-long-unique-passphrase", "operator@example.com")
    with pytest.raises(BootstrapError):
        validate_bootstrap_password("short", "operator@example.com")
    with pytest.raises(BootstrapError):
        validate_bootstrap_password("operator@example.com", "operator@example.com")
