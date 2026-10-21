"""Read-only vulnerabilities."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, PageQuery, require_permissions
from app.schemas.common import ErrorBody, Page
from app.schemas.vulnerabilities import VulnerabilityDetail, VulnerabilityListItem
from app.services.vulnerabilities import get_vulnerability, list_vulnerabilities

router = APIRouter(
    prefix="/vulnerabilities",
    tags=["vulnerabilities"],
    dependencies=[Depends(require_permissions("vulnerability.read"))],
)


@router.get(
    "",
    response_model=Page[VulnerabilityListItem],
    responses={422: {"model": ErrorBody}},
)
def read_vulnerabilities(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    severity: str | None = None,
    kev: bool | None = None,
    action_decision: str | None = None,
    remediation_status: str | None = None,
    asset_criticality: str | None = None,
) -> Page[VulnerabilityListItem]:
    return list_vulnerabilities(
        session,
        page,
        search=search,
        severity=severity,
        kev=kev,
        action_decision=action_decision,
        remediation_status=remediation_status,
        asset_criticality=asset_criticality,
    )


@router.get(
    "/{vulnerability_id}",
    response_model=VulnerabilityDetail,
    responses={404: {"model": ErrorBody}},
)
def read_vulnerability(vulnerability_id: str, session: DbSession) -> VulnerabilityDetail:
    return get_vulnerability(session, vulnerability_id)
