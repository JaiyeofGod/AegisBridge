"""Deployment review. Prints setting names and outcomes, never secret values.

From the repository root:

    uv run --project apps/api python -m app.production_check
    uv run --project apps/api python -m app.production_check --deployment
    uv run --project apps/api python -m app.production_check --connectivity
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from app.core.blueprint import PYTHON_PIN, review_repository_blueprint
from app.core.config import Settings, get_settings
from app.core.production import review_production

_REPO_ROOT = Path(__file__).resolve().parents[3]


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.production_check")
    parser.add_argument(
        "--deployment",
        action="store_true",
        help="Also review the blueprint, runtime pin, and public origin relationship.",
    )
    parser.add_argument(
        "--connectivity",
        action="store_true",
        help="After a valid production configuration, probe Postgres, the broker, and R2.",
    )
    args = parser.parse_args(argv)
    settings = get_settings()
    reviewed = review_production(settings)
    blueprint_issues = review_repository_blueprint(_REPO_ROOT) if args.deployment else ()
    origin_issues = _frontend_origin_issues(settings) if args.deployment else ()
    runtime_issues = _interpreter_issues() if args.deployment else ()
    extra = blueprint_issues + origin_issues + runtime_issues

    print(f"Environment: {reviewed.environment}")
    if args.deployment:
        print(f"Python pin: {PYTHON_PIN}")
        print(f"Blueprint: {'invalid' if blueprint_issues else 'valid'}")
        if os.environ.get("RENDER") == "true":
            print("Render interpreter: " + ("valid" if not runtime_issues else "invalid"))
        if os.environ.get("VITE_API_BASE_URL", "").strip():
            print("Frontend API origin: " + ("valid" if not origin_issues else "invalid"))
        else:
            print("Frontend API origin: not in this environment")
    if reviewed.environment != "production":
        print("Database config: not reviewed")
        print("Session secret: not reviewed")
        print("CORS: not reviewed")
        print("Trusted hosts: not reviewed")
        print("Object storage: not reviewed")
        print("Broker: not reviewed")
        print("Ready for deployment: no")
        for issue in extra:
            print(f"- {issue}")
        raise SystemExit(1)

    labels = {
        "DATABASE_URL": "Database config",
        "SESSION_SECRET": "Session secret",
        "SESSION_COOKIE": "Cookies",
        "SESSION_TTL": "Cookies",
        "CORS_ORIGINS": "CORS",
        "PUBLIC_API_URL": "Public API URL",
        "TRUSTED_HOSTS": "Trusted hosts",
        "FORWARDED_ALLOW_IPS": "Proxy trust",
        "OBJECT_STORAGE": "Object storage",
        "S3_": "Object storage",
        "R2 credentials": "Object storage",
        "CELERY_BROKER_URL": "Broker",
        "WAZUH_": "Optional Wazuh",
        "AEGIS_DEV_ADMIN_PASSWORD": "Development admin password",
    }
    seen: dict[str, str] = {}
    for issue in reviewed.issues:
        for prefix, label in labels.items():
            if prefix in issue:
                seen[label] = "invalid"
                break
    for label in (
        "Database config",
        "Session secret",
        "Cookies",
        "CORS",
        "Public API URL",
        "Trusted hosts",
        "Proxy trust",
        "Object storage",
        "Broker",
    ):
        print(f"{label}: {seen.get(label, 'valid')}")
    for note in reviewed.notes:
        print(note)
    if any("AEGIS_DEV_ADMIN_PASSWORD" in issue for issue in reviewed.issues):
        print("Development admin password: present")
    else:
        print("Development admin password: absent")
    ready = reviewed.ready and not extra
    print(f"Ready for deployment: {'yes' if ready else 'no'}")
    for issue in (*reviewed.issues, *extra):
        print(f"- {issue}")
    if not ready:
        raise SystemExit(1)
    if args.connectivity:
        _print_connectivity()


def _frontend_origin_issues(settings: Settings) -> tuple[str, ...]:
    configured = os.environ.get("VITE_API_BASE_URL", "").strip()
    if not configured:
        return ()
    if _origin(configured) != _origin(settings.public_api_url or ""):
        return ("VITE_API_BASE_URL must be the same https origin as PUBLIC_API_URL.",)
    return ()


def _interpreter_issues() -> tuple[str, ...]:
    if os.environ.get("RENDER") != "true":
        return ()
    running = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    if running != PYTHON_PIN:
        return ("The Render Python interpreter must be 3.14.8.",)
    return ()


def _origin(value: str) -> str:
    from urllib.parse import urlparse

    parsed = urlparse(value.strip())
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        return ""
    port = f":{parsed.port}" if parsed.port else ""
    return f"{parsed.scheme}://{parsed.hostname.lower()}{port}"


def _print_connectivity() -> None:
    from app.core.db import check_database_ready
    from app.core.redis_check import check_redis_ready
    from app.storage.factory import check_object_storage_ready

    probes = (
        ("Database", check_database_ready()),
        ("Broker", check_redis_ready()),
        ("Object storage", check_object_storage_ready()),
    )
    failed = False
    for label, ok in probes:
        print(f"{label} connectivity: {'reachable' if ok else 'unreachable'}")
        failed = failed or not ok
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
