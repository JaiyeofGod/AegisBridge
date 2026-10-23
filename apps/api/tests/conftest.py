"""Shared pytest fixtures."""

import pytest
from fastapi.testclient import TestClient
from tests.dev_admin_guard import restore_dev_admin_credential, snapshot_dev_admin_credential

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.main import create_app


@pytest.fixture(autouse=True)
def preserve_developer_admin_credential():
    """Pytest shares the developer database. Put the Administrator hash back afterward."""
    with SessionLocal() as session:
        snapshot = snapshot_dev_admin_credential(session)
    yield
    with SessionLocal() as session:
        restore_dev_admin_credential(session, snapshot)


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
