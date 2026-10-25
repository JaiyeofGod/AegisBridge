"""Authentication endpoints. Cookies carry opaque session tokens only."""

from __future__ import annotations

from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, Request, Response

from app.api.deps import (
    CurrentPrincipal,
    DbSession,
    OptionalPrincipal,
    RequireCsrf,
    get_settings_dep,
    require_csrf_for_active_session,
)
from app.api.errors import ApiError
from app.core.config import Settings
from app.models.auth import AuthSession
from app.schemas.auth import (
    CsrfTokenResponse,
    CurrentUser,
    LoginRequest,
    LoginResponse,
    SessionStatus,
)
from app.security.csrf import CSRF_HEADER_NAME
from app.security.login_limit import get_login_rate_limiter
from app.security.sessions import cookie_secure
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

SameSite = Literal["lax", "strict", "none"]


def _cookie_samesite(settings: Settings) -> SameSite:
    value = settings.session_cookie_samesite.lower()
    if value not in {"lax", "strict", "none"}:
        return "lax"
    return cast(SameSite, value)


def _set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    # No Domain attribute: host-only cookie for the API origin / Vite proxy host.
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=cookie_secure(settings),
        samesite=_cookie_samesite(settings),
        max_age=settings.session_ttl_seconds,
        path=settings.session_cookie_path,
    )


def _clear_session_cookie(response: Response, settings: Settings) -> None:
    # Match name/path/Secure/SameSite/HttpOnly used at set time so browsers clear reliably.
    response.delete_cookie(
        key=settings.session_cookie_name,
        path=settings.session_cookie_path,
        httponly=True,
        secure=cookie_secure(settings),
        samesite=_cookie_samesite(settings),
    )


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"


@router.post("/login", response_model=LoginResponse)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> LoginResponse:
    if settings.login_rate_limit_active():
        host = request.client.host if request.client else "unknown"
        limiter = get_login_rate_limiter(
            settings.login_rate_limit,
            settings.login_rate_window_seconds,
        )
        if not limiter.allow(host):
            raise ApiError(
                429,
                "sign_in_limited",
                "Sign-in is temporarily unavailable. Try again later.",
            )
    token, _auth_session, user, csrf_token = auth_service.authenticate_and_create_session(
        session,
        email=body.email,
        password=body.password,
        user_agent=request.headers.get("user-agent"),
        client_host=request.client.host if request.client else None,
        settings=settings,
    )
    _set_session_cookie(response, token, settings)
    _no_store(response)
    return LoginResponse(**user.model_dump(), csrf_token=csrf_token)


@router.post("/logout", response_model=SessionStatus)
def logout(
    response: Response,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings_dep)],
    auth_session: Annotated[AuthSession | None, Depends(require_csrf_for_active_session)],
) -> SessionStatus:
    # Anonymous logout is a no-op. Active sessions require X-CSRF-Token.
    auth_service.logout_session(session, auth_session=auth_session, settings=settings)
    _clear_session_cookie(response, settings)
    _no_store(response)
    return SessionStatus(authenticated=False)


@router.post("/logout-all", response_model=SessionStatus)
def logout_all(
    request: Request,
    response: Response,
    session: DbSession,
    principal: RequireCsrf,
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> SessionStatus:
    auth_service.logout_all_sessions(session, user_id=principal.user_id, settings=settings)
    _clear_session_cookie(response, settings)
    _no_store(response)
    _ = request
    return SessionStatus(authenticated=False)


@router.get("/csrf", response_model=CsrfTokenResponse)
def read_csrf(
    response: Response,
    session: DbSession,
    principal: CurrentPrincipal,
) -> CsrfTokenResponse:
    token = auth_service.issue_csrf_token(session, principal=principal)
    _no_store(response)
    return CsrfTokenResponse(csrf_token=token, header_name=CSRF_HEADER_NAME)


@router.get("/session", response_model=SessionStatus)
def read_session(
    response: Response,
    principal: OptionalPrincipal,
) -> SessionStatus:
    _no_store(response)
    return auth_service.session_status_for(principal)


@router.get("/me", response_model=CurrentUser)
def read_me(
    response: Response,
    principal: CurrentPrincipal,
) -> CurrentUser:
    _no_store(response)
    return auth_service.principal_to_current_user(principal)
