"""Administration reads and tightly scoped authenticated writes."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import ApiError, not_found
from app.core.config import get_settings
from app.models.audit import AuditEvent
from app.models.identity import (
    AccessEntitlement,
    AccessReview,
    Permission,
    Role,
    User,
    UserRole,
)
from app.models.integration import Integration, SyncState
from app.schemas.administration import (
    AccessReviewItem,
    AccessReviewUpdate,
    AdministrationSummary,
    AuditEventItem,
    IntegrationListItem,
    RoleListItem,
    UserAdminDetail,
    UserListItem,
    UserRolesUpdate,
    UserStatusUpdate,
)
from app.schemas.common import Page
from app.security.permissions import PRIVILEGED_ROLES, SEVEN_ROLES, permissions_for_roles
from app.security.rbac import AuthenticatedPrincipal
from app.services.audit_write import record_audit_event
from app.services.support import PageParams, page, paginate, person

CLOSED_REVIEWS = frozenset({"closed", "completed", "cancelled"})
ADMINISTRATOR_ROLE = "Administrator"
RECENT_AUDIT_DAYS = 30
SUMMARY_SEMANTICS = (
    "Privileged users are those assigned Administrator or Security Engineer. "
    "configured counts only integrations whose stored status is configured. "
    "not_connected freshness means the connector is absent. Credentials are not stored."
)
_SEVEN_ROLE_LOOKUP = {name.lower(): name for name in SEVEN_ROLES}


def get_summary(session: Session) -> AdministrationSummary:
    integrations = session.scalars(
        select(Integration).options(selectinload(Integration.sync_state))
    ).all()
    status_counts: dict[str, int] = {}
    freshness_counts: dict[str, int] = {}
    configured = 0
    for integration in integrations:
        status_counts[integration.status] = status_counts.get(integration.status, 0) + 1
        if integration.status.lower() == "configured":
            configured += 1
        freshness = None if integration.sync_state is None else integration.sync_state.freshness
        if freshness:
            freshness_counts[freshness] = freshness_counts.get(freshness, 0) + 1
    users = session.scalars(
        select(User).options(selectinload(User.role_links).selectinload(UserRole.role))
    ).all()
    active = sum(1 for user in users if user.account_status.lower() == "active")
    privileged = sum(1 for user in users if _privileged(user))
    cutoff = datetime.now(UTC) - timedelta(days=RECENT_AUDIT_DAYS)
    recent_audits = int(
        session.scalar(
            select(func.count()).select_from(AuditEvent).where(AuditEvent.occurred_at >= cutoff)
        )
        or 0
    )
    reviews = session.scalars(select(AccessReview)).all()
    pending = sum(1 for review in reviews if review.status.lower() not in CLOSED_REVIEWS)
    return AdministrationSummary(
        configured_integration_count=configured,
        integration_status=status_counts,
        integration_freshness=freshness_counts,
        active_user_count=active,
        privileged_user_count=privileged,
        recent_audit_event_count=recent_audits,
        pending_access_review_count=pending,
        privileged_roles=sorted(PRIVILEGED_ROLES),
        semantics=SUMMARY_SEMANTICS,
    )


def list_integrations(session: Session, page_params: PageParams) -> Page[IntegrationListItem]:
    statement = (
        select(Integration)
        .options(selectinload(Integration.sync_state), selectinload(Integration.sync_jobs))
        .order_by(Integration.human_id.asc().nulls_last(), Integration.name)
    )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_integration(row) for row in rows])


def list_users(session: Session, page_params: PageParams) -> Page[UserListItem]:
    statement = (
        select(User)
        .options(
            selectinload(User.department),
            selectinload(User.role_links).selectinload(UserRole.role),
        )
        .order_by(User.human_id)
    )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_user_list_item(row) for row in rows])


def list_roles(session: Session, page_params: PageParams) -> Page[RoleListItem]:
    statement = select(Role).options(selectinload(Role.user_links)).order_by(Role.name)
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_role(session, row) for row in rows])


def list_audit_events(session: Session, page_params: PageParams) -> Page[AuditEventItem]:
    statement = (
        select(AuditEvent)
        .options(selectinload(AuditEvent.actor))
        .order_by(AuditEvent.occurred_at.desc(), AuditEvent.human_id)
    )
    total, rows = paginate(session, statement, page_params)
    return page(
        page_params,
        total,
        [
            AuditEventItem(
                id=row.human_id,
                occurred_at=row.occurred_at,
                actor=person(row.actor),
                actor_label=row.actor_label,
                action=row.action,
                object_type=row.object_type,
                object_id=row.object_id,
                result=row.result,
                source=row.source,
                environment_name=row.environment_name,
                detail=row.detail,
            )
            for row in rows
        ],
    )


def list_access_reviews(session: Session, page_params: PageParams) -> Page[AccessReviewItem]:
    statement = (
        select(AccessReview)
        .options(selectinload(AccessReview.findings))
        .order_by(AccessReview.human_id)
    )
    total, rows = paginate(session, statement, page_params)
    return page(
        page_params,
        total,
        [_access_review_item(row) for row in rows],
    )


def update_access_review(
    session: Session,
    principal: AuthenticatedPrincipal,
    review_id: str,
    patch: AccessReviewUpdate,
) -> AccessReviewItem:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    if not payload:
        raise ApiError(422, "validation_error", "At least one access-review field is required.")

    review = _load_access_review(session, review_id, for_update=True)
    if expected is not None:
        _assert_fresh(
            review.updated_at,
            expected,
            "The access review was modified by another request.",
        )

    changed: list[str] = []
    old_status = review.status
    if "name" in payload and review.name != payload["name"]:
        review.name = payload["name"]
        changed.append("name")
    if "status" in payload and review.status != payload["status"]:
        review.status = payload["status"]
        changed.append("status")

    review.updated_at = datetime.now(UTC)
    settings = get_settings()
    detail_parts = [f"Updated access-review fields: {', '.join(changed) if changed else 'none'}."]
    if "status" in changed:
        detail_parts.append(f"status {old_status} -> {review.status}.")
    record_audit_event(
        session,
        organization_id=review.organization_id,
        action="ACCESS_REVIEW_UPDATE",
        object_type="access_review",
        object_id=review.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=" ".join(detail_parts),
    )
    session.commit()
    return get_access_review(session, review_id)


def get_access_review(session: Session, review_id: str) -> AccessReviewItem:
    review = _load_access_review(session, review_id, for_update=False)
    return _access_review_item(review)


def update_user_status(
    session: Session,
    principal: AuthenticatedPrincipal,
    user_id: str,
    patch: UserStatusUpdate,
) -> UserAdminDetail:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    if not payload:
        raise ApiError(422, "validation_error", "At least one user field is required.")

    user = _load_user(session, user_id, for_update=True)
    if expected is not None:
        _assert_fresh(
            user.updated_at,
            expected,
            "The user was modified by another request.",
        )

    new_status = payload.get("status")
    if new_status is None:
        raise ApiError(422, "validation_error", "At least one user field is required.")

    old_status = user.account_status
    if old_status.lower() != new_status.lower():
        if new_status.lower() != "active" and _is_last_active_administrator(session, user):
            raise ApiError(
                409,
                "conflict",
                "Cannot disable the last active Administrator account.",
            )
        user.account_status = new_status
        user.updated_at = datetime.now(UTC)
        settings = get_settings()
        record_audit_event(
            session,
            organization_id=user.organization_id,
            action="USER_STATUS_UPDATE",
            object_type="user",
            object_id=user.human_id,
            result="success",
            actor_user_id=principal.user_id,
            actor_label=principal.human_id,
            environment_name=settings.app_env,
            detail=f"Updated user status: {old_status} -> {new_status}.",
        )
        session.commit()
    return get_user_admin(session, user_id)


def replace_user_roles(
    session: Session,
    principal: AuthenticatedPrincipal,
    user_id: str,
    patch: UserRolesUpdate,
) -> UserAdminDetail:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    requested = payload.get("roles")
    if not requested:
        raise ApiError(422, "validation_error", "At least one role is required.")

    normalized = _normalize_role_names(requested)
    user = _load_user(session, user_id, for_update=True)
    if expected is not None:
        _assert_fresh(
            user.updated_at,
            expected,
            "The user was modified by another request.",
        )

    current_names = sorted({link.role.name for link in user.role_links})
    new_names = sorted(normalized)
    if current_names == new_names:
        return get_user_admin(session, user_id)

    becoming_admin = ADMINISTRATOR_ROLE in new_names
    was_admin = ADMINISTRATOR_ROLE in current_names
    if was_admin and not becoming_admin and _is_last_active_administrator(session, user):
        raise ApiError(
            409,
            "conflict",
            "Cannot remove Administrator from the last active Administrator account.",
        )

    role_rows = _load_catalog_roles(session, user.organization_id, new_names)
    session.execute(delete(UserRole).where(UserRole.user_id == user.id))
    session.flush()
    for role in role_rows:
        session.add(UserRole(user_id=user.id, role_id=role.id))
    session.flush()
    _sync_role_catalog_entitlements(session, user.id, new_names)

    user.updated_at = datetime.now(UTC)
    settings = get_settings()
    record_audit_event(
        session,
        organization_id=user.organization_id,
        action="USER_ROLE_UPDATE",
        object_type="user",
        object_id=user.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=(
            f"Updated user roles: [{', '.join(current_names)}] -> [{', '.join(new_names)}]. "
            f"Administrator={'yes' if becoming_admin else 'no'}."
        ),
    )
    session.commit()
    return get_user_admin(session, user_id)


def get_user_admin(session: Session, user_id: str) -> UserAdminDetail:
    user = _load_user(session, user_id, for_update=False)
    item = _user_list_item(user)
    role_names = item.roles
    return UserAdminDetail(
        **item.model_dump(),
        permissions=permissions_for_roles(role_names),
    )


def _user_list_item(row: User) -> UserListItem:
    roles = sorted(link.role.name for link in row.role_links)
    return UserListItem(
        id=row.human_id,
        display_name=row.display_name,
        email=row.email,
        status=row.account_status,
        department=None if row.department is None else row.department.name,
        roles=roles,
        privileged=_privileged(row),
        updated_at=row.updated_at,
    )


def _access_review_item(row: AccessReview) -> AccessReviewItem:
    return AccessReviewItem(
        id=row.human_id,
        name=row.name,
        status=row.status,
        owner=None,
        open_finding_count=sum(1 for finding in row.findings if finding.status.lower() == "open"),
        total_finding_count=len(row.findings),
        due_at=None,
        updated_at=row.updated_at,
    )


def _load_access_review(session: Session, review_id: str, *, for_update: bool) -> AccessReview:
    statement = (
        select(AccessReview)
        .where(AccessReview.human_id == review_id)
        .options(selectinload(AccessReview.findings))
    )
    if for_update:
        statement = statement.with_for_update()
    review = session.scalar(statement)
    if review is None:
        raise not_found("Access review", review_id)
    return review


def _load_user(session: Session, user_id: str, *, for_update: bool) -> User:
    statement = (
        select(User)
        .where(User.human_id == user_id)
        .options(
            selectinload(User.department),
            selectinload(User.role_links).selectinload(UserRole.role),
        )
    )
    if for_update:
        statement = statement.with_for_update()
    user = session.scalar(statement)
    if user is None:
        raise not_found("User", user_id)
    return user


def _normalize_role_names(requested: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    unknown: list[str] = []
    for raw in requested:
        key = raw.strip().lower()
        if not key:
            continue
        canonical = _SEVEN_ROLE_LOOKUP.get(key)
        if canonical is None:
            unknown.append(raw.strip())
            continue
        if canonical not in seen:
            seen.add(canonical)
            normalized.append(canonical)
    if unknown:
        raise ApiError(
            422,
            "validation_error",
            f"Unknown role(s): {', '.join(sorted(set(unknown)))}.",
        )
    if not normalized:
        raise ApiError(422, "validation_error", "At least one role is required.")
    return normalized


def _load_catalog_roles(
    session: Session, organization_id: UUID, role_names: list[str]
) -> list[Role]:
    rows = list(
        session.scalars(
            select(Role)
            .where(Role.organization_id == organization_id, Role.name.in_(role_names))
            .with_for_update()
        ).all()
    )
    found = {row.name for row in rows}
    missing = [name for name in role_names if name not in found]
    if missing:
        raise ApiError(
            422,
            "validation_error",
            f"Role catalog entry missing for: {', '.join(missing)}.",
        )
    by_name = {row.name: row for row in rows}
    return [by_name[name] for name in role_names]


def _sync_role_catalog_entitlements(session: Session, user_id: UUID, role_names: list[str]) -> None:
    wanted = set(permissions_for_roles(role_names))
    permission_rows = session.scalars(select(Permission).where(Permission.code.in_(wanted))).all()
    permissions = {row.code: row for row in permission_rows}
    existing = list(
        session.scalars(
            select(AccessEntitlement)
            .options(selectinload(AccessEntitlement.permission))
            .where(
                AccessEntitlement.user_id == user_id,
                AccessEntitlement.grant_source == "role_catalog",
            )
        ).all()
    )
    held = {link.permission.code: link for link in existing if link.permission is not None}
    for code, link in held.items():
        if code not in wanted:
            session.delete(link)
    for code in sorted(wanted - set(held)):
        permission = permissions.get(code)
        if permission is None:
            continue
        session.add(
            AccessEntitlement(
                user_id=user_id,
                permission_id=permission.id,
                grant_source="role_catalog",
            )
        )


def _is_last_active_administrator(session: Session, user: User) -> bool:
    """True when this active user is the only active Administrator."""
    if user.account_status.lower() != "active":
        return False
    role_names = {link.role.name for link in user.role_links}
    if ADMINISTRATOR_ROLE not in role_names:
        return False
    other = session.scalar(
        select(func.count())
        .select_from(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(
            User.organization_id == user.organization_id,
            User.id != user.id,
            func.lower(User.account_status) == "active",
            Role.name == ADMINISTRATOR_ROLE,
        )
    )
    return int(other or 0) == 0


def _assert_fresh(current: datetime, expected: datetime, message: str) -> None:
    left = current if current.tzinfo is not None else current.replace(tzinfo=UTC)
    right = expected if expected.tzinfo is not None else expected.replace(tzinfo=UTC)
    if left != right:
        raise ApiError(409, "conflict", message)


def _privileged(user: User) -> bool:
    names = {name.lower() for name in PRIVILEGED_ROLES}
    return any(link.role.name.lower() in names for link in user.role_links)


def _integration(row: Integration) -> IntegrationListItem:
    finished = [job.finished_at for job in row.sync_jobs if job.finished_at is not None]
    last_sync = max(finished) if finished else None
    state: SyncState | None = row.sync_state
    return IntegrationListItem(
        id=row.human_id or row.name,
        name=row.name,
        provider=row.category,
        status=row.status,
        freshness=None if state is None else state.freshness,
        last_sync_at=last_sync,
        last_success_at=None if state is None else state.last_success_at,
        credential_state=row.auth_state,
        notes=row.notes,
    )


def _role(session: Session, role: Role) -> RoleListItem:
    """Permissions come from the deterministic role catalog, then stored labels."""
    catalog = permissions_for_roles([role.name])
    user_ids = [link.user_id for link in role.user_links]
    stored: list[str] = []
    if user_ids:
        stored = list(
            session.scalars(
                select(Permission.code)
                .join(AccessEntitlement, AccessEntitlement.permission_id == Permission.id)
                .where(
                    AccessEntitlement.user_id.in_(user_ids),
                    AccessEntitlement.grant_source == "role_catalog",
                )
                .distinct()
                .order_by(Permission.code)
            ).all()
        )
    codes = sorted(set(catalog) | set(stored))
    return RoleListItem(id=role.name, name=role.name, summary=role.summary, permissions=codes)
