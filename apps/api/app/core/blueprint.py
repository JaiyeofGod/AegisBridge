"""Static checks for the unapplied Render blueprint and runtime pins.

This module reads repository files only. It does not contact Render, Cloudflare,
or any database.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

PYTHON_PIN = "3.14.8"
NODE_PIN = "24.22.0"
PNPM_PIN = "10.18.2"
UV_PIN = "0.13.3"

API_BUILD = f"pip install 'uv=={UV_PIN}' && uv sync --project apps/api --frozen --no-dev"
API_PREDEPLOY = "uv run --project apps/api alembic upgrade head"
API_START = (
    "uv run --project apps/api uvicorn app.main:app --host 0.0.0.0 "
    '--port $PORT --proxy-headers --forwarded-allow-ips "$FORWARDED_ALLOW_IPS"'
)
WORKER_START = (
    "uv run --project apps/api celery -A app.workers.celery_app:celery_app "
    "worker --loglevel=info --pool=solo -Q intelligence,integrations"
)
BEAT_START = (
    "uv run --project apps/api celery -A app.workers.celery_app:celery_app "
    "beat --loglevel=info --schedule /tmp/celerybeat-schedule"
)
WEB_BUILD = (
    "corepack enable && pnpm install --frozen-lockfile && "
    "AEGIS_REQUIRE_PUBLIC_API=1 pnpm --filter @aegisbridge/web build"
)

_FORBIDDEN = (
    "api.example",
    "example.com",
    "localhost",
    "127.0.0.1",
    "aegis-dev-evidence",
    "seaweed",
    "changeme",
    "aegislocal",
)
_COMMAND_KEYS = ("buildCommand", "preDeployCommand", "startCommand")


def review_repository_blueprint(root: Path) -> tuple[str, ...]:
    """Return blueprint problems. An empty tuple means the file matches the launch contract."""
    issues: list[str] = []
    pin = (root / ".python-version").read_text(encoding="utf-8").strip()
    if pin != PYTHON_PIN:
        issues.append(f".python-version must be {PYTHON_PIN}.")
    package = yaml.safe_load((root / "package.json").read_text(encoding="utf-8"))
    if not isinstance(package, dict):
        issues.append("package.json must be an object.")
        package = {}
    if package.get("packageManager") != f"pnpm@{PNPM_PIN}":
        issues.append(f"packageManager must be pnpm@{PNPM_PIN}.")
    engines = package.get("engines")
    node_range = engines.get("node") if isinstance(engines, dict) else ""
    if node_range != ">=24 <25":
        issues.append("package.json engines.node must stay >=24 <25.")
    blueprint_path = root / "render.yaml"
    text = blueprint_path.read_text(encoding="utf-8")
    lowered = text.lower()
    for token in _FORBIDDEN:
        if token in lowered:
            issues.append(f"render.yaml must not contain {token}.")
    if "connect-src" in lowered or "unsafe-eval" in lowered:
        issues.append("render.yaml must not contain a CSP source list.")
    document = yaml.safe_load(text)
    if not isinstance(document, dict):
        return tuple([*issues, "render.yaml must be a mapping."])
    issues.extend(_database_issues(document.get("databases")))
    issues.extend(_service_issues(document.get("services")))
    return tuple(issues)


def _database_issues(databases: Any) -> list[str]:
    if not isinstance(databases, list) or len(databases) != 1:
        return ["render.yaml must declare one Postgres database."]
    database = databases[0]
    if not isinstance(database, dict):
        return ["The Postgres database entry must be a mapping."]
    issues: list[str] = []
    if database.get("name") != "aegis-postgres":
        issues.append("The Postgres instance must be named aegis-postgres.")
    if database.get("plan") != "0.1c-256mb":
        issues.append("The Postgres plan must be 0.1c-256mb.")
    if database.get("postgresMajorVersion") != "18":
        issues.append("The Postgres major version must be 18.")
    if database.get("region") != "oregon":
        issues.append("The Postgres region must be oregon.")
    if database.get("ipAllowList") != []:
        issues.append("The Postgres IP allow list must be empty.")
    if "connectionPool" in database:
        issues.append("Postgres connection pooling must stay off in the blueprint.")
    return issues


def _service_issues(services: Any) -> list[str]:
    if not isinstance(services, list):
        return ["render.yaml must declare services."]
    issues: list[str] = []
    by_name: dict[str, dict[str, Any]] = {}
    for service in services:
        if isinstance(service, dict) and isinstance(service.get("name"), str):
            by_name[service["name"]] = service
    expected = ("aegis-broker", "aegis-api", "aegis-worker", "aegis-beat", "aegis-web")
    if tuple(by_name) != expected:
        issues.append("Blueprint services must be broker, API, worker, Beat, and web.")
        return issues
    broker = by_name["aegis-broker"]
    if broker.get("type") != "keyvalue" or broker.get("plan") != "256mb":
        issues.append("The broker must be a 256mb Key Value instance.")
    if broker.get("region") != "oregon" or broker.get("ipAllowList") != []:
        issues.append("The broker must be private in oregon.")
    if broker.get("maxmemoryPolicy") != "noeviction":
        issues.append("The broker must use noeviction.")
    issues.extend(_python_service(by_name["aegis-api"], "aegis-api", API_START))
    issues.extend(_python_service(by_name["aegis-worker"], "aegis-worker", WORKER_START))
    issues.extend(_python_service(by_name["aegis-beat"], "aegis-beat", BEAT_START))
    api = by_name["aegis-api"]
    if api.get("preDeployCommand") != API_PREDEPLOY:
        issues.append("The API pre-deploy command must be the single Alembic upgrade.")
    if api.get("healthCheckPath") != "/api/v1/health/live":
        issues.append("The API health check must use liveness.")
    others = [service for name, service in by_name.items() if name != "aegis-api"]
    if any(service.get("preDeployCommand") for service in others):
        issues.append("Only the API service may run a pre-deploy command.")
    session = _env(api, "SESSION_SECRET")
    if session.get("generateValue") is not True:
        issues.append("SESSION_SECRET must be generated once on the API.")
    for name in ("aegis-worker", "aegis-beat"):
        copied = _env(by_name[name], "SESSION_SECRET")
        source = copied.get("fromService")
        if not isinstance(source, dict) or source.get("envVarKey") != "SESSION_SECRET":
            issues.append(f"{name} must copy SESSION_SECRET from the API.")
    issues.extend(_backend_links(by_name))
    issues.extend(_static_site(by_name["aegis-web"]))
    commands = "\n".join(
        str(service.get(key, "")) for service in by_name.values() for key in _COMMAND_KEYS
    )
    if commands.count("alembic upgrade") != 1:
        issues.append("Alembic upgrade must appear once.")
    for banned in ("app.db.seed", "app.bootstrap", " seed", "bootstrap"):
        if banned in commands:
            issues.append("Automatic commands must not seed or bootstrap.")
            break
    return issues


def _python_service(service: dict[str, Any], name: str, start: str) -> list[str]:
    issues: list[str] = []
    kind = "web" if name == "aegis-api" else "worker"
    if service.get("type") != kind or service.get("runtime") != "python":
        issues.append(f"{name} has the wrong service type.")
    if service.get("rootDir") != "." or service.get("region") != "oregon":
        issues.append(f"{name} must build from the repository root in oregon.")
    if service.get("plan") != "starter":
        issues.append(f"{name} must use the starter plan.")
    if service.get("buildCommand") != API_BUILD or service.get("startCommand") != start:
        issues.append(f"{name} build or start command does not match the launch contract.")
    if _env(service, "PYTHONPATH").get("value") != "apps/api":
        issues.append(f"{name} must set PYTHONPATH to apps/api.")
    if _env(service, "PYTHON_VERSION").get("value") != PYTHON_PIN:
        issues.append(f"{name} must set PYTHON_VERSION to {PYTHON_PIN}.")
    if _env(service, "APP_ENV").get("value") != "production":
        issues.append(f"{name} must set APP_ENV=production.")
    if _env(service, "WAZUH_ENABLED").get("value") != "false":
        issues.append(f"{name} must keep Wazuh disabled.")
    if _env(service, "THREAT_INTEL_SYNC_ENABLED").get("value") != "false":
        issues.append(f"{name} must keep indicator sync disabled until a key is added.")
    if _env(service, "OBJECT_STORAGE_PROVIDER").get("value") != "r2":
        issues.append(f"{name} must set the R2 provider.")
    if _env(service, "S3_REGION").get("value") != "auto":
        issues.append(f"{name} must set S3_REGION=auto.")
    if _env(service, "FORWARDED_ALLOW_IPS").get("value") != "*":
        issues.append(f"{name} must trust the Render proxy with *.")
    if _env(service, "DB_POOL_SIZE").get("value") != "2":
        issues.append(f"{name} must set DB_POOL_SIZE=2.")
    if _env(service, "DB_MAX_OVERFLOW").get("value") != "1":
        issues.append(f"{name} must set DB_MAX_OVERFLOW=1.")
    return issues


def _backend_links(by_name: dict[str, dict[str, Any]]) -> list[str]:
    issues: list[str] = []
    for name in ("aegis-api", "aegis-worker", "aegis-beat"):
        database = _env(by_name[name], "DATABASE_URL").get("fromDatabase")
        if not isinstance(database, dict) or database.get("property") != "connectionString":
            issues.append(f"{name} must take DATABASE_URL from the internal Postgres URL.")
        if database != {"name": "aegis-postgres", "property": "connectionString"}:
            issues.append(f"{name} must reference aegis-postgres.")
        for key in ("CELERY_BROKER_URL", "REDIS_URL"):
            broker = _env(by_name[name], key).get("fromService")
            expected = {"name": "aegis-broker", "type": "keyvalue", "property": "connectionString"}
            if broker != expected:
                issues.append(f"{name} must take {key} from the Key Value connection string.")
    origins = {
        "PUBLIC_API_URL": {
            "name": "aegis-api",
            "type": "web",
            "envVarKey": "RENDER_EXTERNAL_URL",
        },
        "TRUSTED_HOSTS": {
            "name": "aegis-api",
            "type": "web",
            "envVarKey": "RENDER_EXTERNAL_HOSTNAME",
        },
        "CORS_ORIGINS": {
            "name": "aegis-web",
            "type": "web",
            "envVarKey": "RENDER_EXTERNAL_URL",
        },
    }
    for name in ("aegis-api", "aegis-worker", "aegis-beat"):
        for key, expected in origins.items():
            actual = _env(by_name[name], key).get("fromService")
            if actual != expected:
                issues.append(f"{name} {key} must reference the original Render value.")
    issues.extend(transitive_reference_issues(list(by_name.values())))
    for key in ("S3_ENDPOINT_URL", "S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"):
        if _env(by_name["aegis-api"], key).get("sync") is not False:
            issues.append(f"{key} must be an operator-supplied secret or value.")
        for name in ("aegis-worker", "aegis-beat"):
            copied = _env(by_name[name], key).get("fromService")
            if copied != {"name": "aegis-api", "type": "web", "envVarKey": key}:
                issues.append(f"{name} must copy {key} from the API.")
    return issues


def transitive_reference_issues(services: list[Any]) -> list[str]:
    """Reject an env var that copies another env var which is itself a reference."""
    by_name: dict[str, dict[str, Any]] = {}
    for service in services:
        if isinstance(service, dict) and isinstance(service.get("name"), str):
            by_name[service["name"]] = service
    issues: list[str] = []
    for service in by_name.values():
        env_vars = service.get("envVars")
        if not isinstance(env_vars, list):
            continue
        for item in env_vars:
            if not isinstance(item, dict):
                continue
            source = item.get("fromService")
            if not isinstance(source, dict) or "envVarKey" not in source:
                continue
            target = by_name.get(str(source.get("name")))
            if not isinstance(target, dict):
                continue
            target_env = _env(target, str(source.get("envVarKey")))
            referenced = "fromService" in target_env or "fromDatabase" in target_env
            if referenced:
                issues.append(
                    f"{service.get('name')} cannot refer to reference env var "
                    f"{source.get('envVarKey')}."
                )
    return issues


def _static_site(service: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    if service.get("type") != "web" or service.get("runtime") != "static":
        issues.append("aegis-web must be a static site.")
    if service.get("rootDir") != "." or service.get("staticPublishPath") != "apps/web/dist":
        issues.append("The frontend must build at the repository root and publish apps/web/dist.")
    if "region" in service:
        issues.append("A static site must not set a private region.")
    if service.get("buildCommand") != WEB_BUILD:
        issues.append("The frontend build must use the locked workspace and public API guard.")
    if _env(service, "NODE_VERSION").get("value") != NODE_PIN:
        issues.append(f"NODE_VERSION must be {NODE_PIN}.")
    vite = _env(service, "VITE_API_BASE_URL").get("fromService")
    if vite != {"name": "aegis-api", "type": "web", "envVarKey": "RENDER_EXTERNAL_URL"}:
        issues.append("VITE_API_BASE_URL must copy the API RENDER_EXTERNAL_URL.")
    routes = service.get("routes")
    if routes != [{"type": "rewrite", "source": "/*", "destination": "/index.html"}]:
        issues.append("The static site must rewrite application routes to index.html.")
    headers = service.get("headers")
    if not isinstance(headers, list):
        return [*issues, "The static site must declare response headers."]
    names = [item.get("name") for item in headers if isinstance(item, dict)]
    if "Content-Security-Policy" in names:
        issues.append("The CSP response header is applied after the production build.")
    for required in (
        "X-Content-Type-Options",
        "Referrer-Policy",
        "X-Frame-Options",
        "Strict-Transport-Security",
        "Permissions-Policy",
    ):
        if required not in names:
            issues.append(f"The static site is missing {required}.")
    hsts = next(
        (
            item.get("value")
            for item in headers
            if isinstance(item, dict) and item.get("name") == "Strict-Transport-Security"
        ),
        "",
    )
    if hsts != "max-age=15552000" or "preload" in str(hsts) or "includeSubDomains" in str(hsts):
        issues.append("Static HSTS must match the API and must not preload.")
    policy = next(
        (
            item.get("value")
            for item in headers
            if isinstance(item, dict) and item.get("name") == "Permissions-Policy"
        ),
        "",
    )
    if policy != "camera=(), microphone=(), geolocation=(), payment=()":
        issues.append("The static Permissions-Policy must match the API.")
    return issues


def _env(service: dict[str, Any], key: str) -> dict[str, Any]:
    env_vars = service.get("envVars")
    if not isinstance(env_vars, list):
        return {}
    for item in env_vars:
        if isinstance(item, dict) and item.get("key") == key:
            return item
    return {}
