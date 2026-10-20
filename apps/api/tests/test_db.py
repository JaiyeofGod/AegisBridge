"""Database readiness helper tests."""

from app.core.db import check_database_ready, engine


def test_database_ready_against_local_postgres() -> None:
    assert check_database_ready(engine) is True
