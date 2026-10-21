"""Authenticated account reads and preference writes for the current user."""

from __future__ import annotations

from fastapi import APIRouter, Response

from app.api.deps import CurrentPrincipal, DbSession, RequireCsrf
from app.schemas.account import (
    AccountPreferences,
    AccountPreferencesUpdate,
    AccountProfile,
    AccountSecurity,
    AccountWorkspace,
)
from app.services import account as account_service

router = APIRouter(prefix="/account", tags=["account"])


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"


@router.get("/profile", response_model=AccountProfile)
def read_profile(response: Response, principal: CurrentPrincipal) -> AccountProfile:
    _no_store(response)
    return account_service.get_profile(principal)


@router.get("/security", response_model=AccountSecurity)
def read_security(
    response: Response,
    session: DbSession,
    principal: CurrentPrincipal,
) -> AccountSecurity:
    _no_store(response)
    return account_service.get_security(session, principal)


@router.get("/preferences", response_model=AccountPreferences)
def read_preferences(
    response: Response,
    session: DbSession,
    principal: CurrentPrincipal,
) -> AccountPreferences:
    _no_store(response)
    return account_service.get_preferences(session, principal)


@router.patch("/preferences", response_model=AccountPreferences)
def patch_preferences(
    body: AccountPreferencesUpdate,
    response: Response,
    session: DbSession,
    principal: RequireCsrf,
) -> AccountPreferences:
    _no_store(response)
    return account_service.update_preferences(session, principal, body)


@router.get("/workspace", response_model=AccountWorkspace)
def read_workspace(response: Response, principal: CurrentPrincipal) -> AccountWorkspace:
    _no_store(response)
    return account_service.get_workspace(principal)
