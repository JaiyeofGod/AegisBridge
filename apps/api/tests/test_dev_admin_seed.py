"""Development Administrator credential sync, isolation, and login."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from tests.dev_admin_guard import restore_dev_admin_credential, snapshot_dev_admin_credential

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import DevCredentialConfigError, check_dev_admin_credential, seed_development
from app.main import create_app
from app.models.auth import UserCredential
from app.models.identity import Role, User, UserRole
from app.security.passwords import verify_password

ADMIN_EMAIL = "amara.okonkwo@aegisbridge.example"
PASSWORD_A = "Synthetic-Dev-Password-A-1!"
PASSWORD_B = "Synthetic-Dev-Password-B-2!"


def _counts() -> tuple[int, int, int]:
    with SessionLocal() as session:
        users = session.scalar(
            select(func.count()).select_from(User).where(User.human_id == "USR-0001")
        )
        credentials = session.scalar(
            select(func.count())
            .select_from(UserCredential)
            .join(User, User.id == UserCredential.user_id)
            .where(User.human_id == "USR-0001")
        )
        roles = session.scalar(
            select(func.count())
            .select_from(UserRole)
            .join(User, User.id == UserRole.user_id)
            .join(Role, Role.id == UserRole.role_id)
            .where(User.human_id == "USR-0001", Role.name == "Administrator")
        )
    return int(users or 0), int(credentials or 0), int(roles or 0)


def _hash() -> str | None:
    with SessionLocal() as session:
        return snapshot_dev_admin_credential(session).password_hash


def _seed(monkeypatch: pytest.MonkeyPatch, app_env: str, password: str | None) -> None:
    monkeypatch.setenv("APP_ENV", app_env)
    if password is None:
        monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", "")
    else:
        monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", password)
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    get_settings.cache_clear()


def test_development_seed_realigns_credential_without_duplicates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    before_counts = _counts()
    _seed(monkeypatch, "development", PASSWORD_A)
    hash_a = _hash()
    assert hash_a is not None
    assert verify_password(hash_a, PASSWORD_A)
    assert _counts() == before_counts
    assert before_counts == (1, 1, 1)

    _seed(monkeypatch, "development", PASSWORD_B)
    hash_b = _hash()
    assert hash_b is not None
    assert hash_b != hash_a
    assert verify_password(hash_b, PASSWORD_B)
    assert not verify_password(hash_b, PASSWORD_A)
    assert _counts() == (1, 1, 1)


def test_development_seed_requires_configured_password(monkeypatch: pytest.MonkeyPatch) -> None:
    before = _hash()
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", "")
    get_settings.cache_clear()
    with pytest.raises(DevCredentialConfigError) as caught, SessionLocal() as session:
        seed_development(session)
    message = str(caught.value)
    assert message == (
        "AEGIS_DEV_ADMIN_PASSWORD must be set before seeding development credentials."
    )
    assert "$argon2" not in message
    assert _hash() == before
    get_settings.cache_clear()


def test_login_follows_reseeded_development_password(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed(monkeypatch, "development", PASSWORD_A)
    with TestClient(create_app()) as client:
        first = client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD_A},
        )
        assert first.status_code == 200
        assert "password" not in first.json()
        session = client.get("/api/v1/auth/session")
        assert session.status_code == 200
        assert session.json()["authenticated"] is True

        _seed(monkeypatch, "development", PASSWORD_B)
        stale = client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD_A},
        )
        assert stale.status_code == 401
        assert stale.json()["code"] == "authentication_failed"
        current = client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL, "password": PASSWORD_B},
        )
        assert current.status_code == 200
        assert client.get("/api/v1/auth/session").status_code == 200


def test_check_output_has_no_secret_material(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed(monkeypatch, "development", PASSWORD_A)
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", PASSWORD_A)
    get_settings.cache_clear()
    with SessionLocal() as session:
        report = check_dev_admin_credential(session)
    assert "Administrator user exists: yes" in report
    assert "Credential row exists: yes" in report
    assert "Configured development credential verifies: yes" in report
    assert "$argon2" not in report
    assert PASSWORD_A not in report
    get_settings.cache_clear()


def test_fixture_restore_puts_back_the_pretest_hash(monkeypatch: pytest.MonkeyPatch) -> None:
    with SessionLocal() as session:
        original = snapshot_dev_admin_credential(session)
    _seed(monkeypatch, "development", PASSWORD_B)
    changed = _hash()
    assert changed != original.password_hash
    with SessionLocal() as session:
        restore_dev_admin_credential(session, original)
    assert _hash() == original.password_hash
