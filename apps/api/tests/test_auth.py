"""Authentication, session, cookie, and account security tests."""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.auth import AuthSession, UserCredential
from app.models.identity import User
from app.security.passwords import hash_password, verify_password
from app.security.sessions import digest_session_token

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
ADMIN_EMAIL = "amara.okonkwo@aegisbridge.example"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    application = create_app()
    with TestClient(application) as test_client:
        yield test_client
    get_settings.cache_clear()
    os.environ.pop("AEGIS_DEV_ADMIN_PASSWORD", None)


def _login(client: TestClient, email: str = ADMIN_EMAIL, password: str = DEV_PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_valid_development_login_sets_httponly_cookie(client: TestClient) -> None:
    response = _login(client)
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "USR-0001"
    assert body["email"] == ADMIN_EMAIL
    assert "Administrator" in body["roles"]
    assert body["privileged"] is True
    assert "password" not in body
    assert "token" not in body
    assert "token_digest" not in str(body)
    cookie = response.cookies.get("aegis_session")
    assert cookie
    assert "aegis_session=" in response.headers.get("set-cookie", "").lower()
    assert "httponly" in response.headers.get("set-cookie", "").lower()
    assert cookie not in str(body)

    with SessionLocal() as session:
        rows = session.scalars(select(AuthSession)).all()
        assert len(rows) >= 1
        digests = {row.token_digest for row in rows}
        assert digest_session_token(cookie) in digests
        assert cookie not in digests
        assert all(len(row.token_digest) == 64 for row in rows)


def test_invalid_password_and_unknown_email_share_generic_error(client: TestClient) -> None:
    bad_password = client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": "wrong-password"},
    )
    unknown = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@aegisbridge.example", "password": DEV_PASSWORD},
    )
    assert bad_password.status_code == 401
    assert unknown.status_code == 401
    assert bad_password.json() == unknown.json()
    assert bad_password.json()["code"] == "authentication_failed"
    assert bad_password.json()["message"] == "Invalid email or password."
    assert "exist" not in bad_password.json()["message"].lower()
    assert "inactive" not in bad_password.json()["message"].lower()


def test_inactive_user_cannot_authenticate(client: TestClient) -> None:
    with SessionLocal() as session:
        user = session.scalar(select(User).where(User.human_id == "USR-0003"))
        assert user is not None
        email = user.email
        previous_status = user.account_status
        user.account_status = "inactive"
        credential = session.scalar(select(UserCredential).where(UserCredential.user_id == user.id))
        if credential is None:
            session.add(
                UserCredential(
                    user_id=user.id,
                    password_hash=hash_password(DEV_PASSWORD),
                    algorithm="argon2id",
                )
            )
        session.commit()

    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": DEV_PASSWORD},
        )
        unknown = client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@aegisbridge.example", "password": DEV_PASSWORD},
        )
        assert response.status_code == 401
        assert response.json() == unknown.json()
        assert "inactive" not in response.json()["message"].lower()
    finally:
        with SessionLocal() as session:
            user = session.scalar(select(User).where(User.human_id == "USR-0003"))
            if user is not None:
                user.account_status = previous_status
                session.commit()


def test_login_paths_always_run_argon2_verification(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str | None] = []

    def tracking_verify(password_hash: str | None, password: str) -> bool:
        calls.append(password_hash)
        from app.security.passwords import DUMMY_PASSWORD_HASH, verify_password

        return verify_password(password_hash or DUMMY_PASSWORD_HASH, password)

    monkeypatch.setattr("app.services.auth.verify_password_or_dummy", tracking_verify)

    client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@aegisbridge.example", "password": "x"},
    )
    client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": "wrong-password"},
    )
    assert len(calls) == 2
    # Unknown email passes None (helper uses fixed dummy). Wrong password uses stored Argon2id hash.
    assert calls[0] is None
    assert calls[1] is not None
    assert calls[1].startswith("$argon2id$")


def test_auth_me_requires_session_and_returns_user(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401
    _login(client)
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["id"] == "USR-0001"
    assert me.headers.get("cache-control") == "no-store"


def test_session_endpoint_reports_authenticated_state(client: TestClient) -> None:
    anonymous = client.get("/api/v1/auth/session")
    assert anonymous.status_code == 200
    assert anonymous.json()["authenticated"] is False
    _login(client)
    active = client.get("/api/v1/auth/session")
    assert active.json()["authenticated"] is True
    assert active.json()["user"]["id"] == "USR-0001"
    assert active.json()["session_id"].startswith("SES-")
    assert "token" not in str(active.json()).lower() or "token_digest" not in str(active.json())


def test_logout_revokes_session(client: TestClient) -> None:
    from tests.csrf_helpers import csrf_headers

    login = _login(client)
    token = login.cookies.get("aegis_session")
    assert token
    assert "csrf_token" in login.json()
    assert login.json()["csrf_token"] != token
    logout = client.post("/api/v1/auth/logout", headers=csrf_headers(client))
    assert logout.status_code == 200
    assert logout.json()["authenticated"] is False
    assert client.get("/api/v1/auth/me").status_code == 401
    with SessionLocal() as session:
        row = session.scalar(
            select(AuthSession).where(AuthSession.token_digest == digest_session_token(token))
        )
        assert row is not None
        assert row.revoked_at is not None


def test_revoked_and_expired_sessions_cannot_authenticate(client: TestClient) -> None:
    login = _login(client)
    token = login.cookies.get("aegis_session")
    assert token
    digest = digest_session_token(token)

    with SessionLocal() as session:
        row = session.scalar(select(AuthSession).where(AuthSession.token_digest == digest))
        assert row is not None
        row.revoked_at = datetime.now(UTC)
        session.commit()
    assert client.get("/api/v1/auth/me").status_code == 401

    login2 = _login(client)
    token2 = login2.cookies.get("aegis_session")
    assert token2
    with SessionLocal() as session:
        row = session.scalar(
            select(AuthSession).where(AuthSession.token_digest == digest_session_token(token2))
        )
        assert row is not None
        original_expires = row.expires_at
        # Deterministic past expiry — independent of wall clock beyond this assignment.
        row.revoked_at = None
        row.expires_at = datetime(2020, 1, 1, tzinfo=UTC)
        session.commit()
    assert client.get("/api/v1/auth/me").status_code == 401
    # Expired sessions are not revived; last_seen touch must not run / extend expiry.
    with SessionLocal() as session:
        row = session.scalar(
            select(AuthSession).where(AuthSession.token_digest == digest_session_token(token2))
        )
        assert row is not None
        assert row.expires_at == datetime(2020, 1, 1, tzinfo=UTC)
        assert row.expires_at != original_expires


def test_last_seen_does_not_extend_fixed_session_expiry(client: TestClient) -> None:
    login = _login(client)
    token = login.cookies.get("aegis_session")
    assert token
    with SessionLocal() as session:
        row = session.scalar(
            select(AuthSession).where(AuthSession.token_digest == digest_session_token(token))
        )
        assert row is not None
        expires_before = row.expires_at
    assert client.get("/api/v1/auth/me").status_code == 200
    with SessionLocal() as session:
        row = session.scalar(
            select(AuthSession).where(AuthSession.token_digest == digest_session_token(token))
        )
        assert row is not None
        assert row.expires_at == expires_before


def test_password_hash_never_returned_and_is_argon2id(client: TestClient) -> None:
    _login(client)
    for path in (
        "/api/v1/auth/me",
        "/api/v1/account/profile",
        "/api/v1/account/security",
        "/api/v1/account/preferences",
        "/api/v1/account/workspace",
    ):
        body = client.get(path).json()
        encoded = str(body)
        assert "password_hash" not in encoded
        assert "$argon2" not in encoded
        assert "token_digest" not in encoded

    with SessionLocal() as session:
        credential = session.scalar(select(UserCredential))
        assert credential is not None
        assert credential.algorithm == "argon2id"
        assert credential.password_hash.startswith("$argon2id$")
        assert verify_password(credential.password_hash, DEV_PASSWORD)


def test_account_endpoints(client: TestClient) -> None:
    assert client.get("/api/v1/account/profile").status_code == 401
    _login(client)
    profile = client.get("/api/v1/account/profile").json()
    assert profile["id"] == "USR-0001"
    assert profile["department"] == "Security"
    security = client.get("/api/v1/account/security").json()
    assert security["password_authentication_configured"] is True
    assert security["mfa_status"] == "not_configured"
    assert security["active_session_count"] >= 1
    assert security["current_session"]["id"].startswith("SES-")
    preferences = client.get("/api/v1/account/preferences").json()
    assert preferences["persistence"] in {"default", "stored"}
    assert preferences["theme"] in {"system", "dark", "light"}
    workspace = client.get("/api/v1/account/workspace").json()
    assert workspace["privileged"] is True
    assert "Administrator" in workspace["roles"]
    assert "administration.manage" in workspace["permissions"]


def test_logout_all_revokes_sessions(client: TestClient) -> None:
    from tests.csrf_helpers import csrf_headers

    _login(client)
    second = TestClient(create_app())
    second.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": DEV_PASSWORD},
    )
    response = client.post("/api/v1/auth/logout-all", headers=csrf_headers(client))
    assert response.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


def test_login_audit_omits_secrets(client: TestClient) -> None:
    login = _login(client)
    cookie = login.cookies.get("aegis_session")
    assert cookie
    client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": "bad"},
    )
    client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@aegisbridge.example", "password": DEV_PASSWORD},
    )
    events = client.get("/api/v1/administration/audit-events?page_size=100").json()["items"]
    actions = {item["action"] for item in events}
    assert "LOGIN_SUCCESS" in actions
    assert "LOGIN_FAILURE" in actions
    failures = [item for item in events if item["action"] == "LOGIN_FAILURE"]
    assert failures
    for item in failures:
        assert item["actor_label"] == "unknown"
        assert item["actor"] is None
    for item in events:
        detail = item.get("detail") or ""
        blob = f"{detail}{item.get('object_id', '')}{item.get('actor_label', '')}"
        assert DEV_PASSWORD not in blob
        assert cookie not in blob
        assert "password_hash" not in blob
        assert "token_digest" not in blob
        assert "$argon2" not in blob
        assert "Authorization" not in blob


def test_cookie_attributes_and_logout_clear(client: TestClient) -> None:
    login = _login(client)
    set_cookie = login.headers.get("set-cookie", "").lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/" in set_cookie
    assert "max-age=" in set_cookie
    assert "domain=" not in set_cookie
    from tests.csrf_helpers import csrf_headers

    logout = client.post("/api/v1/auth/logout", headers=csrf_headers(client))
    clear = logout.headers.get("set-cookie", "").lower()
    assert "aegis_session=" in clear
    assert "path=/" in clear


def test_argon2id_is_selected_and_dummy_hash_is_fixed() -> None:
    from argon2.low_level import Type

    from app.security.passwords import DUMMY_PASSWORD_HASH, _hasher, is_argon2id_hash

    assert _hasher.type is Type.ID
    assert is_argon2id_hash(DUMMY_PASSWORD_HASH)
    assert verify_password(DUMMY_PASSWORD_HASH, "aegis-dummy-verification-sentinel-not-a-password")
    assert not verify_password(DUMMY_PASSWORD_HASH, "wrong")


def test_empty_dev_password_does_not_create_credential(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    # Empty string must win over a repo-root `.env` value after cache clear.
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", "")
    get_settings.cache_clear()
    hash_calls: list[str] = []
    monkeypatch.setattr(
        "app.db.seed.hash_password",
        lambda password: hash_calls.append(password) or "unused",
    )
    with SessionLocal() as session:
        from app.db.seed import _ensure_dev_admin_password

        _ensure_dev_admin_password(session)
        session.commit()
    assert hash_calls == []
    get_settings.cache_clear()


def _admin_credential_state(session: Session) -> tuple[str | None, str | None]:
    admin = session.scalar(select(User).where(User.human_id == "USR-0001"))
    if admin is None:
        return None, None
    credential = session.scalar(select(UserCredential).where(UserCredential.user_id == admin.id))
    if credential is None:
        return None, None
    return credential.password_hash, credential.algorithm


def test_production_env_refuses_dev_password_bootstrap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    get_settings.cache_clear()
    hash_calls: list[str] = []
    monkeypatch.setattr(
        "app.db.seed.hash_password",
        lambda password: hash_calls.append(password) or "unused",
    )
    with SessionLocal() as session:
        before = _admin_credential_state(session)
        from app.db.seed import _ensure_dev_admin_password

        assert _ensure_dev_admin_password(session) is False
        session.commit()
        after = _admin_credential_state(session)
    assert hash_calls == []
    assert after == before
    get_settings.cache_clear()


def test_production_secure_cookie_flag_is_configurable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "true")
    get_settings.cache_clear()
    settings = get_settings()
    from app.security.sessions import cookie_secure

    assert cookie_secure(settings) is True
    get_settings.cache_clear()


def test_cors_rejects_wildcard_with_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "*")
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="wildcard"):
        create_app()
    get_settings.cache_clear()


def test_openapi_includes_auth_and_account_without_secret_fields(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/api/v1/auth/login" in paths
    assert "/api/v1/auth/logout" in paths
    assert "/api/v1/auth/session" in paths
    assert "/api/v1/auth/me" in paths
    assert "/api/v1/account/profile" in paths
    schemas = spec["components"]["schemas"]
    current = schemas["CurrentUser"]["properties"]
    assert "password" not in current
    assert "password_hash" not in current
    assert "token" not in current
    assert "token_digest" not in current
    security = schemas["AccountSecurity"]["properties"]
    assert "password_authentication_configured" in security
    assert "password_hash" not in security
