"""Administration reads and authenticated administrative mutations."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, PageQuery, RequireCsrf, require_permissions
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
from app.schemas.common import ErrorBody, Page
from app.services.administration import (
    get_summary,
    list_access_reviews,
    list_audit_events,
    list_integrations,
    list_roles,
    list_users,
    replace_user_roles,
    update_access_review,
    update_user_status,
)

router = APIRouter(
    prefix="/administration",
    tags=["administration"],
    dependencies=[Depends(require_permissions("administration.read"))],
)


@router.get("/summary", response_model=AdministrationSummary)
def read_summary(session: DbSession) -> AdministrationSummary:
    return get_summary(session)


@router.get(
    "/integrations",
    response_model=Page[IntegrationListItem],
    dependencies=[Depends(require_permissions("integration.read"))],
)
def read_integrations(session: DbSession, page: PageQuery) -> Page[IntegrationListItem]:
    return list_integrations(session, page)


@router.get("/users", response_model=Page[UserListItem])
def read_users(session: DbSession, page: PageQuery) -> Page[UserListItem]:
    return list_users(session, page)


@router.patch(
    "/users/{user_id}",
    response_model=UserAdminDetail,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("administration.manage"))],
)
def patch_user_status(
    user_id: str,
    body: UserStatusUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> UserAdminDetail:
    """Update administrative account status. CSRF required. Credentials are not writable."""
    return update_user_status(session, principal, user_id, body)


@router.put(
    "/users/{user_id}/roles",
    response_model=UserAdminDetail,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[
        Depends(require_permissions("administration.manage", "user.role.manage")),
    ],
)
def put_user_roles(
    user_id: str,
    body: UserRolesUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> UserAdminDetail:
    """Replace user roles from the seven-role catalog. CSRF required."""
    return replace_user_roles(session, principal, user_id, body)


@router.get("/roles", response_model=Page[RoleListItem])
def read_roles(session: DbSession, page: PageQuery) -> Page[RoleListItem]:
    return list_roles(session, page)


@router.get(
    "/audit-events",
    response_model=Page[AuditEventItem],
    dependencies=[Depends(require_permissions("audit.read"))],
)
def read_audit_events(session: DbSession, page: PageQuery) -> Page[AuditEventItem]:
    return list_audit_events(session, page)


@router.get("/access-reviews", response_model=Page[AccessReviewItem])
def read_access_reviews(session: DbSession, page: PageQuery) -> Page[AccessReviewItem]:
    return list_access_reviews(session, page)


@router.patch(
    "/access-reviews/{review_id}",
    response_model=AccessReviewItem,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("administration.manage"))],
)
def patch_access_review(
    review_id: str,
    body: AccessReviewUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> AccessReviewItem:
    """Update supported access-review fields. CSRF required. Findings lack public ids."""
    return update_access_review(session, principal, review_id, body)
