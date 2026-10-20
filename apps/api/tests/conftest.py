"""Shared pytest fixtures."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


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
