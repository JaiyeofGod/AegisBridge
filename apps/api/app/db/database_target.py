"""Choose the database URL for this process.

Production and local startup always use ``DATABASE_URL``. ``TEST_DATABASE_URL`` is
consulted only when ``APP_ENV=test``. The URL is resolved when the engine is
bound, so a future worker can point ``TEST_DATABASE_URL`` at its own database
before binding. This module does not create per-worker databases.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.engine import make_url
from sqlalchemy.engine.url import URL

from app.core.config import Settings

TEST_DATABASE_MISSING = "TEST_DATABASE_URL must be configured for backend tests."
TEST_DATABASE_NOT_ISOLATED = "TEST_DATABASE_URL must not target the same database as DATABASE_URL."
_PRODUCTION_ENVS = frozenset({"production", "prod"})


class TestDatabaseConfigError(RuntimeError):
    """Raised when pytest would connect to a missing or non-isolated database."""

    __test__ = False


@dataclass(frozen=True)
class DatabaseIdentity:
    host: str
    port: int
    database: str
    username: str


def database_identity(url: str) -> DatabaseIdentity:
    parsed = make_url(url)
    driver = parsed.drivername.split("+", 1)[0]
    port = parsed.port
    if port is None and driver in {"postgresql", "postgres"}:
        port = 5432
    return DatabaseIdentity(
        host=(parsed.host or "").casefold(),
        port=port or 0,
        database=(parsed.database or "").casefold(),
        username=(parsed.username or "").casefold(),
    )


def assert_test_database_isolated(dev_url: str, test_url: str) -> DatabaseIdentity:
    """Refuse a missing test URL or any URL that names the development database."""
    if not test_url.strip():
        raise TestDatabaseConfigError(TEST_DATABASE_MISSING)
    try:
        dev = database_identity(dev_url)
        test = database_identity(test_url)
    except Exception:
        raise TestDatabaseConfigError("TEST_DATABASE_URL could not be parsed.") from None
    if not test.database:
        raise TestDatabaseConfigError("TEST_DATABASE_URL must include a database name.")
    if test.database == dev.database or test == dev:
        raise TestDatabaseConfigError(TEST_DATABASE_NOT_ISOLATED)
    return test


def postgresql_psycopg_url(url: str) -> str:
    """Use the installed psycopg 3 driver without adding TLS parameters.

    Render's internal Postgres URL uses the ``postgres://`` scheme and does not
    set ``sslmode``. An external URL that already includes ``sslmode`` keeps it.
    """
    parsed = make_url(url)
    driver = parsed.drivername.split("+", 1)[0]
    if driver in {"postgres", "postgresql"} and "+" not in parsed.drivername:
        parsed = parsed.set(drivername="postgresql+psycopg")
    return parsed.render_as_string(hide_password=False)


def runtime_database_url(settings: Settings) -> str:
    """Return the URL this process may open.

    ``APP_ENV=production`` ignores ``TEST_DATABASE_URL`` even when the variable is set.
    """
    if settings.app_env.lower() in _PRODUCTION_ENVS:
        return postgresql_psycopg_url(settings.database_url)
    if settings.app_env.lower() == "test":
        test_url = settings.test_database_url or ""
        assert_test_database_isolated(settings.database_url, test_url)
        return postgresql_psycopg_url(test_url)
    return postgresql_psycopg_url(settings.database_url)


def test_database_name(settings: Settings) -> str:
    identity = assert_test_database_isolated(
        settings.database_url,
        settings.test_database_url or "",
    )
    return identity.database


def without_database(url: str, database: str) -> URL:
    return make_url(url).set(database=database)
