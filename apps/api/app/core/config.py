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
    # Public https origin of this API. Required in production. Not a secret.
    public_api_url: str | None = Field(default=None, alias="PUBLIC_API_URL")
    # Comma-separated hostnames accepted in the Host header. Required in production.
    trusted_hosts: str = Field(default="", alias="TRUSTED_HOSTS")
    # Immediate proxy addresses allowed to set X-Forwarded-Proto and X-Forwarded-For.
    # Use * only when the platform proxy is the only network path to this process.
    forwarded_allow_ips: str = Field(default="", alias="FORWARDED_ALLOW_IPS")
    login_rate_limit: int = Field(default=10, alias="LOGIN_RATE_LIMIT", ge=1, le=100)
    login_rate_window_seconds: int = Field(
        default=900,
        alias="LOGIN_RATE_WINDOW_SECONDS",
        ge=60,
        le=86_400,
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
    # Community Auth-Key from https://auth.abuse.ch/. Sent only as a request header.
    abusech_auth_key: str | None = Field(default=None, alias="ABUSECH_AUTH_KEY")
    threatfox_api_url: str = Field(
        default="https://threatfox-api.abuse.ch/api/v1/",
        alias="THREATFOX_API_URL",
    )
    threatfox_days: int = Field(default=1, alias="THREATFOX_DAYS")
    urlhaus_recent_url: str = Field(
        default="https://urlhaus-api.abuse.ch/v1/urls/recent/",
        alias="URLHAUS_RECENT_URL",
    )
    threat_intel_ioc_limit: int = Field(default=500, alias="THREAT_INTEL_IOC_LIMIT")
    threat_intel_sync_enabled: bool = Field(default=True, alias="THREAT_INTEL_SYNC_ENABLED")
    threat_intel_sync_lock_ttl_seconds: int = Field(
        default=1800,
        alias="THREAT_INTEL_SYNC_LOCK_TTL_SECONDS",
    )
    threat_intel_http_timeout_seconds: float = Field(
        default=30.0,
        alias="THREAT_INTEL_HTTP_TIMEOUT_SECONDS",
    )
    threat_intel_max_bytes: int = Field(default=20_000_000, alias="THREAT_INTEL_MAX_BYTES")
    # Wazuh indexer (OpenSearch) alert search. Disabled until a deployment sets the URL
    # and credentials. The manager API on port 55000 is not used for alert retrieval.
    wazuh_enabled: bool = Field(default=False, alias="WAZUH_ENABLED")
    wazuh_indexer_url: str | None = Field(default=None, alias="WAZUH_INDEXER_URL")
    wazuh_username: str | None = Field(default=None, alias="WAZUH_USERNAME")
    wazuh_password: str | None = Field(default=None, alias="WAZUH_PASSWORD")
    wazuh_verify_tls: bool = Field(default=True, alias="WAZUH_VERIFY_TLS")
    wazuh_alert_index: str = Field(default="wazuh-alerts*", alias="WAZUH_ALERT_INDEX")
    wazuh_lookback_minutes: int = Field(default=15, alias="WAZUH_LOOKBACK_MINUTES")
    wazuh_alert_limit: int = Field(default=500, alias="WAZUH_ALERT_LIMIT")
    wazuh_http_timeout_seconds: float = Field(default=20.0, alias="WAZUH_HTTP_TIMEOUT_SECONDS")
    wazuh_max_bytes: int = Field(default=8_000_000, alias="WAZUH_MAX_BYTES")
    wazuh_sync_lock_ttl_seconds: int = Field(default=240, alias="WAZUH_SYNC_LOCK_TTL_SECONDS")
    # Research datasets are manual and versioned. 512 MiB refuses the full PhreshPhish pull.
    dataset_max_download_bytes: int = Field(
        default=512 * 1024 * 1024,
        alias="DATASET_MAX_DOWNLOAD_BYTES",
    )
    dataset_max_profile_rows: int = Field(default=50_000, alias="DATASET_MAX_PROFILE_ROWS")
    dataset_temp_dir: str | None = Field(default=None, alias="DATASET_TEMP_DIR")
    dataset_derivation_max_download_bytes: int = Field(
        default=256 * 1024 * 1024,
        alias="DATASET_DERIVATION_MAX_DOWNLOAD_BYTES",
    )
    huggingface_token: str | None = Field(default=None, alias="HF_TOKEN")

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def celery_broker(self) -> str:
        configured = (self.celery_broker_url or "").strip()
        return configured or self.redis_url

    def wazuh_tls_verify(self) -> bool:
        """Production always verifies TLS. A false setting is a local opt-in only."""
        if self.app_env.lower() == "production":
            return True
        return self.wazuh_verify_tls

    def wazuh_alert_cap(self) -> int:
        return min(max(self.wazuh_alert_limit, 1), 1000)

    def wazuh_lookback(self) -> int:
        return min(max(self.wazuh_lookback_minutes, 1), 1440)

    def trusted_host_list(self) -> list[str]:
        return [host.strip().lower() for host in self.trusted_hosts.split(",") if host.strip()]

    def login_rate_limit_active(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
