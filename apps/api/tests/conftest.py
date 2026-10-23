# isort: skip_file
"""Shared pytest fixtures.

The suite selects the test database before the engine is imported. Application
code under pytest then uses that engine. ``APP_ENV=production`` in a normal
process never takes this path.
"""

from __future__ import annotations

import os
from pathlib import Path

os.environ["APP_ENV"] = "test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.db import reset_engine  # noqa: E402
from app.main import create_app  # noqa: E402

get_settings.cache_clear()
reset_engine()

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture(scope="session", autouse=True)
def prepare_test_database() -> None:
    """Create the test database if needed and migrate it to head once per session."""
    from alembic import command
    from alembic.config import Config

    from app.db.test_db import ensure_test_database

    ensure_test_database()
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    command.upgrade(config, "head")


@pytest.fixture
def settings():
    get_settings.cache_clear()
    return get_settings()


@pytest.fixture
def client(settings):
    application = create_app()
    with TestClient(application) as test_client:
        yield test_client
    get_settings.cache_clear()
