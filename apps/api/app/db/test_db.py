"""Create the PostgreSQL database used by pytest.

``ensure`` creates the test database when it is missing. It never drops a
database and never prints a password. PostgreSQL init scripts run only on a
fresh data directory, so an existing Compose volume will not create this
database by itself.
"""

from __future__ import annotations

import re
import sys

from sqlalchemy import create_engine, text

from app.core.config import get_settings
from app.db.database_target import (
    TestDatabaseConfigError,
    assert_test_database_isolated,
    database_identity,
    without_database,
)

_SAFE_IDENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def _validated_test_name() -> str:
    settings = get_settings()
    identity = assert_test_database_isolated(
        settings.database_url,
        settings.test_database_url or "",
    )
    if _SAFE_IDENT.fullmatch(identity.database) is None:
        raise TestDatabaseConfigError("TEST_DATABASE_URL database name is not a safe identifier.")
    return identity.database


def _admin_engine():
    settings = get_settings()
    test_url = settings.test_database_url or ""
    admin_url = without_database(test_url, "postgres")
    return create_engine(admin_url, isolation_level="AUTOCOMMIT", pool_pre_ping=True)


def test_database_exists(name: str) -> bool:
    engine = _admin_engine()
    try:
        with engine.connect() as conn:
            found = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": name},
            ).first()
        return found is not None
    except Exception:
        raise TestDatabaseConfigError(
            "Could not connect to PostgreSQL to check the test database. "
            "Start the database service and confirm TEST_DATABASE_URL is reachable."
        ) from None
    finally:
        engine.dispose()


def ensure_test_database() -> str:
    """Create the configured test database when it is absent."""
    name = _validated_test_name()
    engine = _admin_engine()
    try:
        with engine.connect() as conn:
            found = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": name},
            ).first()
            if found is None:
                conn.execute(text(f'CREATE DATABASE "{name}"'))
    except TestDatabaseConfigError:
        raise
    except Exception:
        raise TestDatabaseConfigError(
            "Could not connect to PostgreSQL to ensure the test database. "
            "Start the database service and confirm TEST_DATABASE_URL is reachable."
        ) from None
    finally:
        engine.dispose()
    return name


def check_test_database() -> int:
    """Print database names and whether the test database exists. No secrets."""
    settings = get_settings()
    try:
        dev_name = database_identity(settings.database_url).database
        test_name = _validated_test_name()
        exists = test_database_exists(test_name)
    except TestDatabaseConfigError as exc:
        print(str(exc))
        return 1
    print(f"Development database name: {dev_name}")
    print(f"Test database name: {test_name}")
    print("Isolated: yes")
    print(f"Test database exists: {'yes' if exists else 'no'}")
    return 0 if exists else 1


def main(argv: list[str] | None = None) -> None:
    args = list(sys.argv[1:] if argv is None else argv)
    try:
        if args == ["ensure"]:
            name = ensure_test_database()
            print(f"Test database is ready: {name}")
            return
        if args == ["check"]:
            raise SystemExit(check_test_database())
    except TestDatabaseConfigError as exc:
        raise SystemExit(str(exc)) from None
    raise SystemExit("Usage: python -m app.db.test_db ensure|check")


if __name__ == "__main__":
    main()
