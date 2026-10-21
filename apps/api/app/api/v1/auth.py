"""Authentication endpoints. Cookies carry opaque session tokens only."""

from __future__ import annotations

from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, Request, Response

from app.api.deps import CurrentPrincipal, DbSession, OptionalPrincipal, get_settings_dep
from app.core.config import Settings
from app.schemas.auth import CurrentUser, LoginRequest, SessionStatus
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


@router.post("/login", response_model=CurrentUser)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> CurrentUser:
    token, _auth_session, user = auth_service.authenticate_and_create_session(
        session,
        email=body.email,
        password=body.password,
        user_agent=request.headers.get("user-agent"),
        client_host=request.client.host if request.client else None,
        settings=settings,
    )
    _set_session_cookie(response, token, settings)
    _no_store(response)
    return user


@router.post("/logout", response_model=SessionStatus)
def logout(
    request: Request,
    response: Response,
    session: DbSession,
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> SessionStatus:
    raw = request.cookies.get(settings.session_cookie_name)
    auth_session = auth_service.get_auth_session_by_token(session, raw)
    auth_service.logout_session(session, auth_session=auth_session, settings=settings)
    _clear_session_cookie(response, settings)
    _no_store(response)
    return SessionStatus(authenticated=False)


@router.post("/logout-all", response_model=SessionStatus)
def logout_all(
    request: Request,
    response: Response,
    session: DbSession,
    principal: CurrentPrincipal,
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> SessionStatus:
    auth_service.logout_all_sessions(session, user_id=principal.user_id, settings=settings)
    _clear_session_cookie(response, settings)
    _no_store(response)
    # Cookie cleared; request principal is no longer valid for subsequent calls.
    _ = request
    return SessionStatus(authenticated=False)


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
