"""Read-only administration contracts. No credentials are returned."""

from fastapi import APIRouter

from app.api.deps import DbSession, PageQuery
from app.schemas.administration import (
    AccessReviewItem,
    AdministrationSummary,
    AuditEventItem,
    IntegrationListItem,
    RoleListItem,
    UserListItem,
)
from app.schemas.common import Page
from app.services.administration import (
    get_summary,
    list_access_reviews,
    list_audit_events,
    list_integrations,
    list_roles,
    list_users,
)

router = APIRouter(prefix="/administration", tags=["administration"])


@router.get("/summary", response_model=AdministrationSummary)
def read_summary(session: DbSession) -> AdministrationSummary:
    return get_summary(session)


@router.get("/integrations", response_model=Page[IntegrationListItem])
def read_integrations(session: DbSession, page: PageQuery) -> Page[IntegrationListItem]:
    return list_integrations(session, page)


@router.get("/users", response_model=Page[UserListItem])
def read_users(session: DbSession, page: PageQuery) -> Page[UserListItem]:
    return list_users(session, page)


@router.get("/roles", response_model=Page[RoleListItem])
def read_roles(session: DbSession, page: PageQuery) -> Page[RoleListItem]:
    return list_roles(session, page)


@router.get("/audit-events", response_model=Page[AuditEventItem])
def read_audit_events(session: DbSession, page: PageQuery) -> Page[AuditEventItem]:
    return list_audit_events(session, page)


@router.get("/access-reviews", response_model=Page[AccessReviewItem])
def read_access_reviews(session: DbSession, page: PageQuery) -> Page[AccessReviewItem]:
    return list_access_reviews(session, page)
