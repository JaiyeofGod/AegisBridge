"""Authentication and session lifecycle. Brute-force rate limiting is deferred."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import ApiError
from app.core.config import Settings, get_settings
from app.models.auth import AuthSession, UserCredential
from app.models.identity import User, UserRole
from app.models.organization import Organization
from app.schemas.auth import CurrentUser, SessionStatus
from app.security.passwords import hash_password, needs_rehash, verify_password_or_dummy
from app.security.rbac import (
    AuthenticatedPrincipal,
    resolve_permissions,
    resolve_privileged,
    resolve_roles,
)
from app.security.sessions import (
    digest_session_token,
    generate_session_token,
    new_session_human_id,
    session_expiry,
)
from app.services.audit_write import record_audit_event

GENERIC_CREDENTIAL_ERROR = "Invalid email or password."
# Hook point for future rate limiting / lockout without changing call sites.
AUTH_RATE_LIMIT_NOTE = "Production deployments must add login rate limiting before public exposure."
# Absolute expiry from session creation; last_seen_at never extends expires_at.
SESSION_EXPIRY_POLICY = "fixed_duration"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def authenticate_and_create_session(
    session: Session,
    *,
    email: str,
    password: str,
    user_agent: str | None,
    client_host: str | None,
    settings: Settings | None = None,
) -> tuple[str, AuthSession, CurrentUser]:
    """Verify credentials and create a server session. Returns (raw_token, row, user)."""
    cfg = settings or get_settings()
    normalized = normalize_email(email)
    user = session.scalar(
        select(User)
        .options(
            selectinload(User.department),
            selectinload(User.organization),
            selectinload(User.role_links).selectinload(UserRole.role),
        )
        .where(func.lower(User.email) == normalized)
    )
    credential = (
        None
        if user is None
        else session.scalar(select(UserCredential).where(UserCredential.user_id == user.id))
    )

    # Always perform Argon2 work (real hash or fixed dummy) before branching on outcome.
    stored_hash = None if credential is None else credential.password_hash
    password_ok = verify_password_or_dummy(stored_hash, password)
    active = user is not None and user.account_status.lower() == "active"
    authenticated = user is not None and credential is not None and password_ok and active

    if not authenticated:
        org = _organization_for_audit(session, user)
        if org is not None:
            # Do not record why authentication failed (unknown / wrong / inactive / no credential).
            record_audit_event(
                session,
                organization_id=org.id,
                action="LOGIN_FAILURE",
                object_type="session",
                object_id="login",
                result="failure",
                actor_user_id=None,
                actor_label="unknown",
                environment_name=cfg.app_env,
                detail="Authentication failed. Credential material was not recorded.",
            )
            session.commit()
        raise ApiError(401, "authentication_failed", GENERIC_CREDENTIAL_ERROR)

    assert user is not None and credential is not None  # narrowed after authenticated gate
    if needs_rehash(credential.password_hash):
        credential.password_hash = hash_password(password)

    raw_token = generate_session_token()
    now = datetime.now(UTC)
    auth_session = AuthSession(
        human_id=new_session_human_id(),
        user_id=user.id,
        token_digest=digest_session_token(raw_token),
        created_at=now,
        expires_at=session_expiry(cfg, now=now),
        last_seen_at=now,
        user_agent=_truncate(user_agent, 300),
        client_host=_truncate(client_host, 64),
    )
    session.add(auth_session)
    record_audit_event(
        session,
        organization_id=user.organization_id,
        action="LOGIN_SUCCESS",
        object_type="session",
        object_id=auth_session.human_id,
        result="success",
        actor_user_id=user.id,
        actor_label=user.human_id,
        environment_name=cfg.app_env,
        detail="Local password authentication succeeded.",
    )
    session.commit()
    session.refresh(auth_session)
    return raw_token, auth_session, to_current_user(user)


def logout_session(
    session: Session,
    *,
    auth_session: AuthSession | None,
    settings: Settings | None = None,
) -> None:
    cfg = settings or get_settings()
    if auth_session is None:
        return
    if auth_session.revoked_at is None:
        auth_session.revoked_at = datetime.now(UTC)
        user = session.get(User, auth_session.user_id)
        if user is not None:
            record_audit_event(
                session,
                organization_id=user.organization_id,
                action="LOGOUT",
                object_type="session",
                object_id=auth_session.human_id,
                result="success",
                actor_user_id=user.id,
                actor_label=user.human_id,
                environment_name=cfg.app_env,
                detail="Session revoked.",
            )
        session.commit()


def logout_all_sessions(
    session: Session,
    *,
    user_id: object,
    settings: Settings | None = None,
) -> int:
    cfg = settings or get_settings()
    now = datetime.now(UTC)
    rows = list(
        session.scalars(
            select(AuthSession).where(
                AuthSession.user_id == user_id,
                AuthSession.revoked_at.is_(None),
            )
        ).all()
    )
    for row in rows:
        row.revoked_at = now
    user = session.get(User, user_id)
    if user is not None and rows:
        record_audit_event(
            session,
            organization_id=user.organization_id,
            action="LOGOUT_ALL",
            object_type="session",
            object_id=user.human_id,
            result="success",
            actor_user_id=user.id,
            actor_label=user.human_id,
            environment_name=cfg.app_env,
            detail=f"Revoked {len(rows)} session(s).",
        )
    session.commit()
    return len(rows)


def load_principal_from_token(
    session: Session,
    *,
    raw_token: str | None,
    settings: Settings | None = None,
    touch: bool = True,
) -> AuthenticatedPrincipal | None:
    del settings  # Reserved for future absolute-timeout / idle policy knobs.
    if raw_token is None or raw_token.strip() == "":
        return None
    digest = digest_session_token(raw_token)
    auth_session = session.scalar(select(AuthSession).where(AuthSession.token_digest == digest))
    if auth_session is None:
        return None
    now = datetime.now(UTC)
    if auth_session.revoked_at is not None:
        return None
    expires = auth_session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    # Server-side fixed expiry is authoritative; do not extend expires_at on activity.
    if expires <= now:
        return None

    user = session.scalar(
        select(User)
        .options(
            selectinload(User.department),
            selectinload(User.organization),
            selectinload(User.role_links).selectinload(UserRole.role),
        )
        .where(User.id == auth_session.user_id)
    )
    if user is None or user.account_status.lower() != "active":
        return None

    # last_seen_at is observational only; it must never mutate expires_at.
    if touch:
        auth_session.last_seen_at = now
        session.commit()

    roles = resolve_roles([link.role.name for link in user.role_links])
    permissions = resolve_permissions(roles)
    org = user.organization
    return AuthenticatedPrincipal(
        user_id=user.id,
        human_id=user.human_id,
        email=user.email,
        display_name=user.display_name,
        account_status=user.account_status,
        department=None if user.department is None else user.department.name,
        organization_name=org.name,
        organization_slug=org.slug,
        environment_label=org.environment_label,
        data_origin=org.data_origin,
        roles=roles,
        permissions=permissions,
        privileged=resolve_privileged(roles),
        session_human_id=auth_session.human_id,
        session_created_at=auth_session.created_at,
        session_expires_at=auth_session.expires_at,
        session_last_seen_at=auth_session.last_seen_at,
        timezone_name=user.timezone_name,
        job_title=user.job_title,
        created_at=user.created_at,
    )


def to_current_user(user: User) -> CurrentUser:
    roles = resolve_roles([link.role.name for link in user.role_links])
    org: Organization = user.organization
    return CurrentUser(
        id=user.human_id,
        display_name=user.display_name,
        email=user.email,
        status=user.account_status,
        department=None if user.department is None else user.department.name,
        roles=list(roles),
        permissions=list(resolve_permissions(roles)),
        privileged=resolve_privileged(roles),
        organization=org.name,
        environment_label=org.environment_label,
        data_origin=org.data_origin,
        job_title=user.job_title,
        timezone=user.timezone_name,
    )


def principal_to_current_user(principal: AuthenticatedPrincipal) -> CurrentUser:
    return CurrentUser(
        id=principal.human_id,
        display_name=principal.display_name,
        email=principal.email,
        status=principal.account_status,
        department=principal.department,
        roles=list(principal.roles),
        permissions=list(principal.permissions),
        privileged=principal.privileged,
        organization=principal.organization_name,
        environment_label=principal.environment_label,
        data_origin=principal.data_origin,
        job_title=principal.job_title,
        timezone=principal.timezone_name,
    )


def session_status_for(principal: AuthenticatedPrincipal | None) -> SessionStatus:
    if principal is None:
        return SessionStatus(authenticated=False)
    return SessionStatus(
        authenticated=True,
        user=principal_to_current_user(principal),
        session_id=principal.session_human_id,
        expires_at=principal.session_expires_at,
        last_seen_at=principal.session_last_seen_at,
    )


def get_auth_session_by_token(session: Session, raw_token: str | None) -> AuthSession | None:
    if raw_token is None or raw_token.strip() == "":
        return None
    return session.scalar(
        select(AuthSession).where(AuthSession.token_digest == digest_session_token(raw_token))
    )


def _organization_for_audit(session: Session, user: User | None) -> Organization | None:
    if user is not None:
        return session.get(Organization, user.organization_id)
    return session.scalar(select(Organization).order_by(Organization.created_at).limit(1))


def _truncate(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if cleaned == "":
        return None
    return cleaned[:limit]
