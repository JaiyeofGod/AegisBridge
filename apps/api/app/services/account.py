"""Authenticated account reads. Preferences are defaults until a store exists."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.auth import AuthSession, UserCredential
from app.models.identity import User
from app.schemas.account import (
    AccountPreferences,
    AccountProfile,
    AccountSecurity,
    AccountSessionSummary,
    AccountWorkspace,
)
from app.security.permissions import PRIVILEGED_ROLES
from app.security.rbac import AuthenticatedPrincipal


def get_profile(principal: AuthenticatedPrincipal) -> AccountProfile:
    return AccountProfile(
        id=principal.human_id,
        display_name=principal.display_name,
        email=principal.email,
        department=principal.department,
        account_status=principal.account_status,
        job_title=principal.job_title,
        timezone=principal.timezone_name,
        organization=principal.organization_name,
        created_at=principal.created_at,
        data_origin=principal.data_origin,
    )


def get_security(session: Session, principal: AuthenticatedPrincipal) -> AccountSecurity:
    credential = session.scalar(
        select(UserCredential).where(UserCredential.user_id == principal.user_id)
    )
    active_count = int(
        session.scalar(
            select(func.count())
            .select_from(AuthSession)
            .where(
                AuthSession.user_id == principal.user_id,
                AuthSession.revoked_at.is_(None),
            )
        )
        or 0
    )
    current = session.scalar(
        select(AuthSession).where(AuthSession.human_id == principal.session_human_id)
    )
    current_summary = None
    if current is not None:
        current_summary = AccountSessionSummary(
            id=current.human_id,
            created_at=current.created_at,
            last_seen_at=current.last_seen_at,
            expires_at=current.expires_at,
            current=True,
        )
    last_auth = None if current is None else current.created_at
    return AccountSecurity(
        password_authentication_configured=credential is not None,
        active_session_count=active_count,
        current_session=current_summary,
        mfa_status="not_configured",
        last_authenticated_at=last_auth,
        semantics=(
            "MFA enrollment is not available in this phase. "
            "Session tokens and password hashes are never returned."
        ),
    )


def get_preferences() -> AccountPreferences:
    return AccountPreferences(
        persistence="not_stored",
        theme="system",
        density="comfortable",
        landing_page="overview",
        reduced_motion=False,
        semantics=(
            "User preference persistence is not stored yet. "
            "These values are explicit defaults, not fabricated saved settings."
        ),
    )


def get_workspace(principal: AuthenticatedPrincipal) -> AccountWorkspace:
    return AccountWorkspace(
        organization=principal.organization_name,
        department=principal.department,
        roles=list(principal.roles),
        permissions=list(principal.permissions),
        privileged=principal.privileged,
        environment_label=principal.environment_label,
        data_origin=principal.data_origin,
        privileged_roles=sorted(PRIVILEGED_ROLES),
        semantics=(
            "Privileged users hold Administrator or Security Engineer. "
            "Permissions are resolved from the deterministic role catalog."
        ),
    )


def user_has_password(session: Session, user: User) -> bool:
    return (
        session.scalar(select(UserCredential.id).where(UserCredential.user_id == user.id))
        is not None
    )
