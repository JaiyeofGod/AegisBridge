"""Shared API dependencies including authentication and RBAC helpers."""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.models.auth import AuthSession
from app.security.csrf import CSRF_HEADER_NAME, csrf_tokens_match
from app.security.rbac import AuthenticatedPrincipal
from app.services import auth as auth_service
from app.services.support import PageParams

DbSession = Annotated[Session, Depends(get_db)]

CSRF_FAILURE_MESSAGE = "CSRF validation failed."


def get_settings_dep() -> Settings:
    return get_settings()


def get_page_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


PageQuery = Annotated[PageParams, Depends(get_page_params)]


def _cookie_token(request: Request, settings: Settings) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


def get_optional_principal(
    request: Request,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> AuthenticatedPrincipal | None:
    return auth_service.load_principal_from_token(
        session,
        raw_token=_cookie_token(request, settings),
        settings=settings,
        touch=True,
    )


def get_current_principal(
    principal: Annotated[AuthenticatedPrincipal | None, Depends(get_optional_principal)],
) -> AuthenticatedPrincipal:
    if principal is None:
        raise ApiError(401, "unauthenticated", "Authentication is required.")
    return principal


OptionalPrincipal = Annotated[AuthenticatedPrincipal | None, Depends(get_optional_principal)]
CurrentPrincipal = Annotated[AuthenticatedPrincipal, Depends(get_current_principal)]


def require_roles(*roles: str) -> Callable[..., AuthenticatedPrincipal]:
    required = tuple(roles)

    def dependency(principal: CurrentPrincipal) -> AuthenticatedPrincipal:
        if not principal.has_any_role(*required):
            raise ApiError(403, "forbidden", "You do not have access to this resource.")
        return principal

    return dependency


def require_permissions(*permissions: str) -> Callable[..., AuthenticatedPrincipal]:
    """Require every listed permission."""
    required = tuple(permissions)

    def dependency(principal: CurrentPrincipal) -> AuthenticatedPrincipal:
        if not all(principal.has_permission(code) for code in required):
            raise ApiError(403, "forbidden", "You do not have access to this resource.")
        return principal

    return dependency


def require_any_permission(*permissions: str) -> Callable[..., AuthenticatedPrincipal]:
    required = tuple(permissions)

    def dependency(principal: CurrentPrincipal) -> AuthenticatedPrincipal:
        if not principal.has_any_permission(*required):
            raise ApiError(403, "forbidden", "You do not have access to this resource.")
        return principal

    return dependency


def require_csrf(
    request: Request,
    session: DbSession,
    principal: CurrentPrincipal,
) -> AuthenticatedPrincipal:
    """Validate the synchronizer CSRF token for the caller's active session."""
    provided = request.headers.get(CSRF_HEADER_NAME)
    auth_session = session.scalar(
        select(AuthSession).where(AuthSession.human_id == principal.session_human_id)
    )
    if auth_session is None or auth_session.revoked_at is not None:
        raise ApiError(401, "unauthenticated", "Authentication is required.")
    if provided is None or not csrf_tokens_match(
        provided=provided,
        expected_digest=auth_session.csrf_token_digest,
    ):
        raise ApiError(403, "csrf_failed", CSRF_FAILURE_MESSAGE)
    return principal


RequireCsrf = Annotated[AuthenticatedPrincipal, Depends(require_csrf)]


def require_csrf_for_active_session(
    request: Request,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> AuthSession | None:
    """CSRF check for logout when a session cookie is present.

    Anonymous logout (no cookie) is a no-op and does not require CSRF.
    """
    raw = _cookie_token(request, settings)
    auth_session = auth_service.get_auth_session_by_token(session, raw)
    if auth_session is None:
        return None
    if auth_session.revoked_at is not None:
        return auth_session
    provided = request.headers.get(CSRF_HEADER_NAME)
    if provided is None or not csrf_tokens_match(
        provided=provided,
        expected_digest=auth_session.csrf_token_digest,
    ):
        raise ApiError(403, "csrf_failed", CSRF_FAILURE_MESSAGE)
    return auth_session
