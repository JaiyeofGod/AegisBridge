"""Policy library, versioning, lifecycle, and acknowledgement API."""

from fastapi import APIRouter, Depends

from app.api.deps import (
    CurrentPrincipal,
    DbSession,
    PageQuery,
    RequireCsrf,
    require_any_permission,
    require_permissions,
)
from app.schemas.common import ErrorBody, Page
from app.schemas.policies import (
    PolicyAcknowledgeResult,
    PolicyControlLinkResult,
    PolicyCreate,
    PolicyDetail,
    PolicyListItem,
    PolicyTransition,
    PolicyUpdate,
    PolicyVersionCreate,
    PolicyVersionDetail,
    PolicyVersionSummary,
    PolicyVersionUpdate,
)
from app.services import policies as policy_service

router = APIRouter(
    prefix="/policies",
    tags=["policies"],
    dependencies=[Depends(require_permissions("policy.read"))],
)


@router.get(
    "",
    response_model=Page[PolicyListItem],
)
def list_policies(session: DbSession, page: PageQuery) -> Page[PolicyListItem]:
    return policy_service.list_policies(session, page)


@router.get(
    "/{policy_id}",
    response_model=PolicyDetail,
    responses={404: {"model": ErrorBody}},
)
def read_policy(
    policy_id: str,
    session: DbSession,
    principal: CurrentPrincipal,
) -> PolicyDetail:
    return policy_service.get_policy(session, policy_id, principal=principal)


@router.get(
    "/{policy_id}/versions",
    response_model=list[PolicyVersionSummary],
    responses={404: {"model": ErrorBody}},
)
def list_versions(policy_id: str, session: DbSession) -> list[PolicyVersionSummary]:
    return policy_service.list_policy_versions(session, policy_id)


@router.get(
    "/{policy_id}/versions/{version_label}",
    response_model=PolicyVersionDetail,
    responses={404: {"model": ErrorBody}},
)
def read_version(
    policy_id: str,
    version_label: str,
    session: DbSession,
) -> PolicyVersionDetail:
    return policy_service.get_policy_version(session, policy_id, version_label)


@router.post(
    "",
    response_model=PolicyDetail,
    responses={422: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("policy.manage"))],
)
def post_policy(
    body: PolicyCreate,
    session: DbSession,
    principal: RequireCsrf,
) -> PolicyDetail:
    """Create a policy and initial draft version. CSRF required."""
    return policy_service.create_policy(session, principal, body)


@router.patch(
    "/{policy_id}",
    response_model=PolicyDetail,
    responses={404: {"model": ErrorBody}, 409: {"model": ErrorBody}, 422: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("policy.manage"))],
)
def patch_policy(
    policy_id: str,
    body: PolicyUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> PolicyDetail:
    """Update policy metadata. CSRF required."""
    return policy_service.update_policy(session, principal, policy_id, body)


@router.post(
    "/{policy_id}/versions",
    response_model=PolicyVersionDetail,
    responses={404: {"model": ErrorBody}, 409: {"model": ErrorBody}, 422: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("policy.manage"))],
)
def post_version(
    policy_id: str,
    body: PolicyVersionCreate,
    session: DbSession,
    principal: RequireCsrf,
) -> PolicyVersionDetail:
    """Create a new draft version. Does not overwrite published history. CSRF required."""
    return policy_service.create_policy_version(session, principal, policy_id, body)


@router.patch(
    "/{policy_id}/versions/{version_label}",
    response_model=PolicyVersionDetail,
    responses={404: {"model": ErrorBody}, 409: {"model": ErrorBody}, 422: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("policy.manage"))],
)
def patch_version(
    policy_id: str,
    version_label: str,
    body: PolicyVersionUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> PolicyVersionDetail:
    """Edit a draft version only. CSRF required."""
    return policy_service.update_policy_version(session, principal, policy_id, version_label, body)


@router.post(
    "/{policy_id}/transition",
    response_model=PolicyDetail,
    responses={
        403: {"model": ErrorBody},
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_any_permission("policy.manage", "policy.approve"))],
)
def post_transition(
    policy_id: str,
    body: PolicyTransition,
    session: DbSession,
    principal: RequireCsrf,
) -> PolicyDetail:
    """Apply an allowed lifecycle transition. CSRF required. Publish needs policy.approve."""
    return policy_service.transition_policy(session, principal, policy_id, body)


@router.post(
    "/{policy_id}/acknowledge",
    response_model=PolicyAcknowledgeResult,
    responses={404: {"model": ErrorBody}, 409: {"model": ErrorBody}},
)
def post_acknowledge(
    policy_id: str,
    session: DbSession,
    principal: RequireCsrf,
) -> PolicyAcknowledgeResult:
    """Self-acknowledge the current published version. CSRF required. policy.read sufficient."""
    return policy_service.acknowledge_policy(session, principal, policy_id)


@router.post(
    "/{policy_id}/controls/{control_id}",
    response_model=PolicyControlLinkResult,
    responses={404: {"model": ErrorBody}, 409: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("policy.manage"))],
)
def post_policy_control_link(
    policy_id: str,
    control_id: str,
    session: DbSession,
    principal: RequireCsrf,
) -> PolicyControlLinkResult:
    """Link a control to a policy by human ids. CSRF required. Duplicate links are idempotent."""
    return policy_service.link_policy_control(session, principal, policy_id, control_id)


@router.delete(
    "/{policy_id}/controls/{control_id}",
    response_model=PolicyControlLinkResult,
    responses={404: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("policy.manage"))],
)
def delete_policy_control_link(
    policy_id: str,
    control_id: str,
    session: DbSession,
    principal: RequireCsrf,
) -> PolicyControlLinkResult:
    """Remove a policy↔control relationship only. CSRF required. Missing link → 404."""
    return policy_service.unlink_policy_control(session, principal, policy_id, control_id)
