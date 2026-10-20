"""Administration reads. Responses omit credentials and internal UUIDs."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

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
    AdministrationSummary,
    AuditEventItem,
    IntegrationListItem,
    RoleListItem,
    UserListItem,
)
from app.schemas.common import Page
from app.services.support import PageParams, page, paginate, person

PRIVILEGED_ROLES = ("Administrator", "Security Engineer")
CLOSED_REVIEWS = frozenset({"closed", "completed", "cancelled"})
RECENT_AUDIT_DAYS = 30
SUMMARY_SEMANTICS = (
    "Privileged users are those assigned Administrator or Security Engineer. "
    "configured counts only integrations whose stored status is configured. "
    "not_connected freshness means the connector is absent. Credentials are not stored."
)


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
        privileged_roles=list(PRIVILEGED_ROLES),
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
    return page(
        page_params,
        total,
        [
            UserListItem(
                id=row.human_id,
                display_name=row.display_name,
                email=row.email,
                status=row.account_status,
                department=None if row.department is None else row.department.name,
                roles=sorted(link.role.name for link in row.role_links),
                privileged=_privileged(row),
            )
            for row in rows
        ],
    )


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
        [
            AccessReviewItem(
                id=row.human_id,
                name=row.name,
                status=row.status,
                owner=None,
                open_finding_count=sum(
                    1 for finding in row.findings if finding.status.lower() == "open"
                ),
                total_finding_count=len(row.findings),
                due_at=None,
            )
            for row in rows
        ],
    )


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
    """Permissions are role_catalog entitlements on users who hold this role."""
    user_ids = [link.user_id for link in role.user_links]
    codes: list[str] = []
    if user_ids:
        codes = list(
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
    return RoleListItem(id=role.name, name=role.name, summary=role.summary, permissions=codes)
