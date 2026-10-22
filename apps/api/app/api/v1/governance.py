"""Governance summary and authenticated control mutations."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, PageQuery, RequireCsrf, require_permissions
from app.schemas.common import ErrorBody, Page
from app.schemas.evidence import ControlEvidenceLinkResult
from app.schemas.governance import (
    ControlDetail,
    ControlImplementationUpdate,
    ControlListItem,
    ControlTestCreate,
    ControlTestItem,
    ControlTestUpdate,
    GovernanceSummary,
)
from app.services.evidence import link_control_evidence, unlink_control_evidence
from app.services.governance import get_governance_summary
from app.services.governance_writes import (
    create_control_test,
    get_control,
    list_controls,
    update_control_implementation,
    update_control_test,
)

router = APIRouter(
    prefix="/governance",
    tags=["governance"],
    dependencies=[Depends(require_permissions("control.read"))],
)


@router.get("/summary", response_model=GovernanceSummary)
def read_governance_summary(session: DbSession) -> GovernanceSummary:
    """Framework identifiers and statuses. Licensed control text is not included."""
    return get_governance_summary(session)


@router.get("/controls", response_model=Page[ControlListItem])
def read_controls(session: DbSession, page: PageQuery) -> Page[ControlListItem]:
    return list_controls(session, page)


@router.get(
    "/controls/{control_id}",
    response_model=ControlDetail,
    responses={404: {"model": ErrorBody}},
)
def read_control(control_id: str, session: DbSession) -> ControlDetail:
    return get_control(session, control_id)


@router.patch(
    "/controls/{control_id}/implementation",
    response_model=ControlDetail,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("control.manage"))],
)
def patch_control_implementation(
    control_id: str,
    body: ControlImplementationUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> ControlDetail:
    """Update the current control implementation. CSRF required. No licensed text."""
    return update_control_implementation(session, principal, control_id, body)


@router.post(
    "/controls/{control_id}/tests",
    response_model=ControlTestItem,
    responses={
        404: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("control.manage"))],
)
def post_control_test(
    control_id: str,
    body: ControlTestCreate,
    session: DbSession,
    principal: RequireCsrf,
) -> ControlTestItem:
    """Record a manual control test. Not automated assessment. CSRF required."""
    return create_control_test(session, principal, control_id, body)


@router.patch(
    "/control-tests/{test_id}",
    response_model=ControlTestItem,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("control.manage"))],
)
def patch_control_test(
    test_id: str,
    body: ControlTestUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> ControlTestItem:
    """Update a manually recorded control test. CSRF required."""
    return update_control_test(session, principal, test_id, body)


@router.post(
    "/controls/{control_id}/evidence/{evidence_id}",
    response_model=ControlEvidenceLinkResult,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("control.manage", "evidence.manage"))],
)
def post_control_evidence_link(
    control_id: str,
    evidence_id: str,
    session: DbSession,
    principal: RequireCsrf,
) -> ControlEvidenceLinkResult:
    """Link existing evidence metadata to a control. CSRF required."""
    return link_control_evidence(session, principal, control_id, evidence_id)


@router.delete(
    "/controls/{control_id}/evidence/{evidence_id}",
    response_model=ControlEvidenceLinkResult,
    responses={404: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("control.manage", "evidence.manage"))],
)
def delete_control_evidence_link(
    control_id: str,
    evidence_id: str,
    session: DbSession,
    principal: RequireCsrf,
) -> ControlEvidenceLinkResult:
    """Remove an evidence/control link. CSRF required."""
    return unlink_control_evidence(session, principal, control_id, evidence_id)
