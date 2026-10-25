"""Deployment review. Prints setting names and outcomes, never secret values.

Run from apps/api:

    python -m app.production_check
"""

from __future__ import annotations

from app.core.config import get_settings
from app.core.production import review_production


def main() -> None:
    reviewed = review_production(get_settings())
    print(f"Environment: {reviewed.environment}")
    if reviewed.environment != "production":
        print("Database config: not reviewed")
        print("Session secret: not reviewed")
        print("CORS: not reviewed")
        print("Trusted hosts: not reviewed")
        print("Object storage: not reviewed")
        print("Broker: not reviewed")
        print("Ready for deployment: no")
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
    print(f"Ready for deployment: {'yes' if reviewed.ready else 'no'}")
    if reviewed.issues:
        for issue in reviewed.issues:
            print(f"- {issue}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
