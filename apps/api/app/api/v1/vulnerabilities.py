"""Vulnerabilities: reads and authenticated remediation updates."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, PageQuery, RequireCsrf, require_permissions
from app.core.config import get_settings
from app.integrations.vulnerability.http import open_transport
from app.schemas.common import ErrorBody, Page
from app.schemas.vulnerabilities import (
    IntelligenceRefreshResult,
    VulnerabilityDetail,
    VulnerabilityListItem,
    VulnerabilityRemediationUpdate,
)
from app.services.vulnerabilities import (
    get_vulnerability,
    list_vulnerabilities,
    update_vulnerability_remediation,
)
from app.services.vulnerability_intelligence import refresh_vulnerability_intelligence

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


@router.patch(
    "/{vulnerability_id}/remediation",
    response_model=VulnerabilityDetail,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("vulnerability.manage"))],
)
def patch_vulnerability_remediation(
    vulnerability_id: str,
    body: VulnerabilityRemediationUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> VulnerabilityDetail:
    """Update remediation task fields only. CVSS/EPSS/KEV/SSVC stay immutable. CSRF required."""
    return update_vulnerability_remediation(session, principal, vulnerability_id, body)


@router.post(
    "/{vulnerability_id}/intelligence/refresh",
    response_model=IntelligenceRefreshResult,
    responses={401: {"model": ErrorBody}, 403: {"model": ErrorBody}, 404: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("vulnerability.manage"))],
)
def refresh_vulnerability_intelligence_route(
    vulnerability_id: str,
    session: DbSession,
    principal: RequireCsrf,
) -> IntelligenceRefreshResult:
    """Refresh NVD, CISA KEV, and FIRST EPSS for one CVE.

    Organization workflow fields are not changed. Feed URLs come from server
    configuration. `vulnerability.manage` and CSRF are required. There is no
    refresh-all route.
    """
    transport = open_transport(get_settings())
    try:
        return refresh_vulnerability_intelligence(
            session,
            principal,
            vulnerability_id,
            transport,
        )
    finally:
        transport.close()
