"""Authenticated account reads and preference persistence."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.core.config import get_settings
from app.models.auth import AuthSession, UserCredential
from app.models.identity import User
from app.models.preferences import UserPreferences
from app.schemas.account import (
    AccountPreferences,
    AccountPreferencesUpdate,
    AccountProfile,
    AccountSecurity,
    AccountSessionSummary,
    AccountWorkspace,
)
from app.security.permissions import PRIVILEGED_ROLES
from app.security.rbac import AuthenticatedPrincipal
from app.services.audit_write import record_audit_event

DEFAULT_THEME = "system"
DEFAULT_DENSITY = "comfortable"
DEFAULT_LANDING_PAGE = "overview"
DEFAULT_REDUCED_MOTION = False

DEFAULT_PREFERENCES_SEMANTICS = (
    "No stored preference row exists yet. These values are service defaults."
)
STORED_PREFERENCES_SEMANTICS = (
    "Preferences are stored for this user. Theme and density are not applied "
    "server-side; the client may use them when presentation wiring exists."
)


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


def get_preferences(session: Session, principal: AuthenticatedPrincipal) -> AccountPreferences:
    row = session.scalar(
        select(UserPreferences).where(UserPreferences.user_id == principal.user_id)
    )
    if row is None:
        return AccountPreferences(
            persistence="default",
            theme=DEFAULT_THEME,
            density=DEFAULT_DENSITY,
            landing_page=DEFAULT_LANDING_PAGE,
            reduced_motion=DEFAULT_REDUCED_MOTION,
            semantics=DEFAULT_PREFERENCES_SEMANTICS,
            updated_at=None,
        )
    return AccountPreferences(
        persistence="stored",
        theme=row.theme,
        density=row.density,
        landing_page=row.landing_page,
        reduced_motion=row.reduced_motion,
        semantics=STORED_PREFERENCES_SEMANTICS,
        updated_at=row.updated_at,
    )


def update_preferences(
    session: Session,
    principal: AuthenticatedPrincipal,
    patch: AccountPreferencesUpdate,
) -> AccountPreferences:
    payload = patch.model_dump(exclude_unset=True)
    if not payload:
        raise ApiError(422, "validation_error", "At least one preference field is required.")

    row = session.scalar(
        select(UserPreferences).where(UserPreferences.user_id == principal.user_id)
    )
    created = row is None
    if row is None:
        row = UserPreferences(
            user_id=principal.user_id,
            theme=DEFAULT_THEME,
            density=DEFAULT_DENSITY,
            landing_page=DEFAULT_LANDING_PAGE,
            reduced_motion=DEFAULT_REDUCED_MOTION,
        )
        session.add(row)

    changed: list[str] = []
    for field in ("theme", "density", "landing_page", "reduced_motion"):
        if field not in payload:
            continue
        new_value = payload[field]
        if getattr(row, field) != new_value:
            setattr(row, field, new_value)
            changed.append(field)

    settings = get_settings()
    record_audit_event(
        session,
        organization_id=_org_id(session, principal),
        action="PREFERENCES_UPDATE",
        object_type="user_preferences",
        object_id=principal.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=(
            f"{'Created' if created else 'Updated'} preference fields: "
            f"{', '.join(changed) if changed else 'none'}."
        ),
    )
    session.commit()
    session.refresh(row)
    return get_preferences(session, principal)


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


def _org_id(session: Session, principal: AuthenticatedPrincipal):
    user = session.get(User, principal.user_id)
    if user is None:
        raise ApiError(401, "unauthenticated", "Authentication is required.")
    return user.organization_id
