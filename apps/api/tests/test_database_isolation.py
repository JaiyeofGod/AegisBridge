"""Test database selection, production refusal, and live identity."""

from __future__ import annotations

from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import Settings
from app.core.db import create_db_engine, engine
from app.db.database_target import (
    TEST_DATABASE_MISSING,
    TEST_DATABASE_NOT_ISOLATED,
    TestDatabaseConfigError,
    postgresql_psycopg_url,
    runtime_database_url,
)

ROOT = Path(__file__).resolve().parents[3]
DEV_URL = "postgresql+psycopg://aegis:aegis@localhost:5432/aegis"
TEST_URL = "postgresql+psycopg://aegis:aegis@localhost:5432/aegis_test"


def test_missing_test_database_url_fails_clearly() -> None:
    cfg = Settings(APP_ENV="test", DATABASE_URL=DEV_URL, TEST_DATABASE_URL="")
    with pytest.raises(TestDatabaseConfigError, match=f"^{TEST_DATABASE_MISSING}$"):
        runtime_database_url(cfg)


def test_same_database_name_is_refused_before_use() -> None:
    cfg = Settings(
        APP_ENV="test",
        DATABASE_URL=DEV_URL,
        TEST_DATABASE_URL="postgresql+psycopg://aegis:aegis@127.0.0.1:5432/aegis",
    )
    with pytest.raises(TestDatabaseConfigError, match=TEST_DATABASE_NOT_ISOLATED):
        runtime_database_url(cfg)


def test_same_identity_with_default_port_is_refused() -> None:
    cfg = Settings(
        APP_ENV="test",
        DATABASE_URL="postgresql+psycopg://aegis:aegis@localhost/aegis",
        TEST_DATABASE_URL="postgresql+psycopg://aegis:aegis@localhost:5432/Aegis",
    )
    with pytest.raises(TestDatabaseConfigError, match=TEST_DATABASE_NOT_ISOLATED):
        runtime_database_url(cfg)


def test_distinct_database_name_is_accepted() -> None:
    cfg = Settings(APP_ENV="test", DATABASE_URL=DEV_URL, TEST_DATABASE_URL=TEST_URL)
    assert make_url(runtime_database_url(cfg)).database == "aegis_test"


def test_local_and_production_ignore_test_database_url() -> None:
    for app_env in ("local", "production"):
        cfg = Settings(APP_ENV=app_env, DATABASE_URL=DEV_URL, TEST_DATABASE_URL=TEST_URL)
        assert make_url(runtime_database_url(cfg)).database == "aegis"


def test_production_engine_does_not_select_test_database() -> None:
    cfg = Settings(APP_ENV="production", DATABASE_URL=DEV_URL, TEST_DATABASE_URL=TEST_URL)
    prod_engine = create_db_engine(cfg)
    try:
        assert prod_engine.url.database == "aegis"
    finally:
        prod_engine.dispose()


def test_pytest_session_uses_configured_test_database() -> None:
    cfg = Settings()
    dev_name = make_url(cfg.database_url).database
    test_name = make_url(runtime_database_url(cfg)).database
    alembic_config = Config(str(ROOT / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(ROOT / "migrations"))
    head = ScriptDirectory.from_config(alembic_config).get_current_head()
    with engine.connect() as conn:
        current = conn.execute(text("SELECT current_database()")).scalar_one()
        version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    assert current == test_name
    assert current != dev_name
    assert version == head


def test_render_internal_postgres_url_selects_psycopg_without_adding_tls() -> None:
    rewritten = postgresql_psycopg_url(
        "postgres://aegis_app:example-secret@dpg-internal/aegisbridge"
    )
    parsed = make_url(rewritten)
    assert parsed.drivername == "postgresql+psycopg"
    assert "sslmode" not in rewritten
    preserved = postgresql_psycopg_url(
        "postgresql://aegis_app:example-secret@dpg-internal/aegisbridge?sslmode=require"
    )
    assert "sslmode=require" in preserved
    assert make_url(preserved).drivername == "postgresql+psycopg"
