"""Production configuration review. Messages name settings, never secret values."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

from sqlalchemy.engine import make_url

from app.core.config import Settings

_PRODUCTION_ENVS = frozenset({"production", "prod"})
_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "0.0.0.0"})
_WEAK_SECRETS = frozenset(
    {
        "change-me-generate-a-long-random-secret",
        "changeme",
        "secret",
        "password",
        "aegis",
    }
)
_DEV_STORAGE_KEYS = frozenset({"aegislocal", "aegislocalchangeme"})


class ProductionConfigError(RuntimeError):
    """Raised when APP_ENV=production is not safe to start."""

    def __init__(self, issues: list[str]) -> None:
        self.issues = issues
        super().__init__("Production configuration is not deployable.")


@dataclass(frozen=True)
class ProductionReview:
    environment: str
    issues: tuple[str, ...]
    notes: tuple[str, ...]

    @property
    def ready(self) -> bool:
        return not self.issues and self.environment in _PRODUCTION_ENVS


def is_production(settings: Settings) -> bool:
    return settings.app_env.lower() in _PRODUCTION_ENVS


def review_production(settings: Settings) -> ProductionReview:
    """Validate a production process. Local and test reviews are not deployable."""
    environment = settings.app_env.lower()
    if environment not in _PRODUCTION_ENVS:
        return ProductionReview(
            environment=environment,
            issues=(f"APP_ENV is {environment or 'unset'}, not production.",),
            notes=(),
        )
    issues: list[str] = []
    notes: list[str] = []
    issues.extend(_database_issues(settings.database_url))
    issues.extend(_session_issues(settings))
    issues.extend(_origin_issues(settings))
    issues.extend(_storage_issues(settings))
    issues.extend(_broker_issues(settings))
    issues.extend(_wazuh_issues(settings, notes))
    if (settings.aegis_dev_admin_password or "").strip():
        issues.append("AEGIS_DEV_ADMIN_PASSWORD must be unset in production.")
    if not (settings.nvd_api_key or "").strip():
        notes.append("Optional NVD API key: unset.")
    else:
        notes.append("Optional NVD API key: configured.")
    if settings.threat_intel_sync_enabled and not (settings.abusech_auth_key or "").strip():
        notes.append("Optional abuse.ch key: unset. Indicator sync skips without a failed run.")
    elif (settings.abusech_auth_key or "").strip():
        notes.append("Optional abuse.ch key: configured.")
    else:
        notes.append("Optional abuse.ch key: unused because indicator sync is disabled.")
    connections = settings.db_pool_size + settings.db_max_overflow
    if connections > 5:
        notes.append("Database pool per process is above the portfolio ceiling of 5.")
    if (settings.huggingface_token or "").strip():
        notes.append("Optional dataset token: configured.")
    else:
        notes.append("Optional dataset token: unset.")
    return ProductionReview(environment="production", issues=tuple(issues), notes=tuple(notes))


def require_production(settings: Settings) -> ProductionReview:
    reviewed = review_production(settings)
    if reviewed.issues:
        raise ProductionConfigError(list(reviewed.issues))
    return reviewed


def _database_issues(url: str) -> list[str]:
    if not url.strip():
        return ["DATABASE_URL is required."]
    if "localhost" in url or "127.0.0.1" in url:
        return ["DATABASE_URL must be a managed database, not localhost."]
    try:
        parsed = make_url(url)
    except Exception:
        return ["DATABASE_URL could not be parsed."]
    driver = parsed.drivername.split("+", 1)[0]
    host = (parsed.host or "").lower()
    if driver not in {"postgresql", "postgres"}:
        return ["DATABASE_URL must use PostgreSQL."]
    if host in _LOCAL_HOSTS or not host:
        return ["DATABASE_URL must be a managed database, not localhost."]
    if not parsed.database:
        return ["DATABASE_URL must include a database name."]
    if not parsed.password:
        return ["DATABASE_URL must include a password."]
    return []


def _session_issues(settings: Settings) -> list[str]:
    issues: list[str] = []
    secret = settings.session_secret.strip()
    if secret.lower() in _WEAK_SECRETS or len(secret) < 32:
        issues.append("SESSION_SECRET must be a unique value of at least 32 characters.")
    if settings.session_cookie_secure is False:
        issues.append("SESSION_COOKIE_SECURE must not be false in production.")
    samesite = settings.session_cookie_samesite.lower()
    if samesite not in {"lax", "strict", "none"}:
        issues.append("SESSION_COOKIE_SAMESITE must be lax, strict, or none.")
    elif samesite == "none" and settings.session_cookie_secure is False:
        issues.append("SameSite=None requires a Secure cookie.")
    if settings.session_ttl_seconds < 300 or settings.session_ttl_seconds > 86_400:
        issues.append("SESSION_TTL_SECONDS must stay between 5 minutes and 24 hours.")
    return issues


def _origin_issues(settings: Settings) -> list[str]:
    issues: list[str] = []
    origins = settings.cors_origin_list()
    if not origins:
        issues.append("CORS_ORIGINS must list the frontend https origin.")
    if "*" in origins:
        issues.append("CORS_ORIGINS must not use a wildcard.")
    for origin in origins:
        if not _https_origin(origin):
            issues.append("CORS_ORIGINS must be explicit https origins.")
            break
    public = (settings.public_api_url or "").strip()
    if not _https_origin(public):
        issues.append("PUBLIC_API_URL must be the public https API origin.")
    elif _hostname(public) in {_hostname(origin) for origin in origins}:
        issues.append("CORS_ORIGINS must be the frontend origin, not the API host.")
    hosts = _host_list(settings.trusted_hosts)
    if not hosts:
        issues.append("TRUSTED_HOSTS must list the public API hostnames.")
    elif any(host == "*" or host.startswith("*.") for host in hosts):
        issues.append("TRUSTED_HOSTS must list explicit hostnames.")
    elif public and _hostname(public) not in hosts:
        issues.append("TRUSTED_HOSTS must include the PUBLIC_API_URL hostname.")
    allow = (settings.forwarded_allow_ips or "").strip()
    if not allow:
        issues.append(
            "FORWARDED_ALLOW_IPS must name the platform proxy, "
            "or * when the platform is the only path."
        )
    return issues


def _storage_issues(settings: Settings) -> list[str]:
    issues: list[str] = []
    if settings.object_storage_provider.strip().lower() != "r2":
        issues.append("OBJECT_STORAGE_PROVIDER must be r2 in production.")
    endpoint = (settings.s3_endpoint_url or "").strip()
    host = _hostname(endpoint)
    lowered = endpoint.lower()
    if (
        not endpoint.startswith("https://")
        or not host.endswith(".r2.cloudflarestorage.com")
        or "seaweed" in lowered
        or ":8333" in lowered
    ):
        issues.append("S3_ENDPOINT_URL must be the private https R2 endpoint.")
    if settings.s3_region.strip().lower() != "auto":
        issues.append("S3_REGION must be auto for Cloudflare R2.")
    bucket = settings.s3_bucket.strip()
    if not bucket or bucket == "aegis-dev-evidence" or "seaweed" in bucket.lower():
        issues.append("S3_BUCKET must be the private production bucket.")
    access = (settings.aws_access_key_id or "").strip()
    secret = (settings.aws_secret_access_key or "").strip()
    if not access or not secret or access in _DEV_STORAGE_KEYS or secret in _DEV_STORAGE_KEYS:
        issues.append("R2 credentials must be set in AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.")
    return issues


def _broker_issues(settings: Settings) -> list[str]:
    url = settings.celery_broker().strip()
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"redis", "rediss"} or host in _LOCAL_HOSTS or not host:
        return ["CELERY_BROKER_URL must be a private Redis or Valkey URL, not localhost."]
    return []


def _wazuh_issues(settings: Settings, notes: list[str]) -> list[str]:
    if not settings.wazuh_enabled:
        notes.append("Optional Wazuh: disabled.")
        return []
    notes.append("Optional Wazuh: enabled.")
    issues: list[str] = []
    indexer = (settings.wazuh_indexer_url or "").strip()
    if not _https_origin(indexer) or _hostname(indexer) in _LOCAL_HOSTS:
        issues.append("WAZUH_INDEXER_URL must be an https indexer outside localhost.")
    if not (settings.wazuh_username or "").strip() or not (settings.wazuh_password or "").strip():
        issues.append("WAZUH_USERNAME and WAZUH_PASSWORD are required when Wazuh is enabled.")
    return issues


def _https_origin(value: str) -> bool:
    parsed = urlparse(value.strip())
    host = (parsed.hostname or "").lower()
    remote = bool(host) and host not in _LOCAL_HOSTS and parsed.username is None
    return parsed.scheme == "https" and remote


def _hostname(value: str) -> str:
    return (urlparse(value.strip()).hostname or "").lower()


def _host_list(value: str) -> list[str]:
    return [item.strip().lower() for item in value.split(",") if item.strip()]
