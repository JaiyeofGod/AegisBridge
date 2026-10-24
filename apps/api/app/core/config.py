"""Application settings loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve repository root (…/AegisBridge) from apps/api/app/core/config.py
_REPO_ROOT = Path(__file__).resolve().parents[4]
_ENV_FILE = _REPO_ROOT / ".env"


class Settings(BaseSettings):
    """Runtime configuration. Secrets are never returned by health endpoints."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE) if _ENV_FILE.is_file() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_env: str = Field(default="local", alias="APP_ENV")
    app_name: str = Field(default="aegisbridge", alias="APP_NAME")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ORIGINS",
    )

    database_url: str = Field(
        default="postgresql+psycopg://aegis:aegis@localhost:5432/aegis",
        alias="DATABASE_URL",
    )
    # Pytest only. Ignored unless APP_ENV=test. Never a fallback for local or production.
    test_database_url: str | None = Field(default=None, alias="TEST_DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    # Empty uses REDIS_URL. Valkey is the broker. Task results are not stored in the broker.
    celery_broker_url: str | None = Field(default=None, alias="CELERY_BROKER_URL")
    vulnerability_sync_enabled: bool = Field(default=True, alias="VULNERABILITY_SYNC_ENABLED")
    vulnerability_sync_hour_utc: int = Field(
        default=6,
        alias="VULNERABILITY_SYNC_HOUR_UTC",
        ge=0,
        le=23,
    )
    vulnerability_sync_lock_ttl_seconds: int = Field(
        default=1800,
        alias="VULNERABILITY_SYNC_LOCK_TTL_SECONDS",
        ge=30,
        le=86_400,
    )
    # Pause between NVD CVE lookups. The public NVD API allows about five requests
    # per 30 seconds. The first CVE in a run is not delayed.
    vulnerability_sync_nvd_pause_seconds: float = Field(
        default=6.0,
        alias="VULNERABILITY_SYNC_NVD_PAUSE_SECONDS",
        ge=0,
        le=30,
    )

    session_secret: str = Field(
        default="change-me-generate-a-long-random-secret",
        alias="SESSION_SECRET",
    )
    session_cookie_name: str = Field(default="aegis_session", alias="SESSION_COOKIE_NAME")
    session_cookie_path: str = Field(default="/", alias="SESSION_COOKIE_PATH")
    session_cookie_samesite: str = Field(default="lax", alias="SESSION_COOKIE_SAMESITE")
    session_cookie_secure: bool | None = Field(default=None, alias="SESSION_COOKIE_SECURE")
    session_ttl_seconds: int = Field(default=28_800, alias="SESSION_TTL_SECONDS")
    aegis_dev_admin_password: str | None = Field(
        default=None,
        alias="AEGIS_DEV_ADMIN_PASSWORD",
    )

    # Private S3-compatible object storage (SeaweedFS local / Cloudflare R2 hosted).
    s3_endpoint_url: str | None = Field(default="http://localhost:8333", alias="S3_ENDPOINT_URL")
    aws_access_key_id: str | None = Field(default=None, alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(default=None, alias="AWS_SECRET_ACCESS_KEY")
    s3_bucket: str = Field(default="aegis-dev-evidence", alias="S3_BUCKET")
    s3_region: str = Field(default="us-east-1", alias="S3_REGION")
    object_storage_provider: str = Field(default="seaweedfs", alias="OBJECT_STORAGE_PROVIDER")
    evidence_max_upload_bytes: int = Field(
        default=25 * 1024 * 1024,
        alias="EVIDENCE_MAX_UPLOAD_BYTES",
    )

    # Optional. Missing key uses NVD's unauthenticated CVE API and must not block startup.
    nvd_api_key: str | None = Field(default=None, alias="NVD_API_KEY")
    nvd_cve_url: str = Field(
        default="https://services.nvd.nist.gov/rest/json/cves/2.0",
        alias="NVD_CVE_URL",
    )
    cisa_kev_url: str = Field(
        default="https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
        alias="CISA_KEV_URL",
    )
    first_epss_url: str = Field(
        default="https://api.first.org/data/v1/epss",
        alias="FIRST_EPSS_URL",
    )
    vulnerability_intelligence_timeout_seconds: float = Field(
        default=10.0,
        alias="VULNERABILITY_INTELLIGENCE_TIMEOUT_SECONDS",
    )
    # Pinned Enterprise release. The unversioned "latest" bundle is not the default.
    attack_enterprise_version: str = Field(default="20.0", alias="ATTACK_ENTERPRISE_VERSION")
    attack_enterprise_stix_url: str = Field(
        default=(
            "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/"
            "enterprise-attack/enterprise-attack-20.0.json"
        ),
        alias="ATTACK_ENTERPRISE_STIX_URL",
    )
    attack_stix_timeout_seconds: float = Field(default=120.0, alias="ATTACK_STIX_TIMEOUT_SECONDS")
    attack_stix_max_bytes: int = Field(default=80_000_000, alias="ATTACK_STIX_MAX_BYTES")

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def celery_broker(self) -> str:
        configured = (self.celery_broker_url or "").strip()
        return configured or self.redis_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
