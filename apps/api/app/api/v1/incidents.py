"""Incidents: reads and authenticated management updates."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, PageQuery, RequireCsrf, require_permissions
from app.schemas.common import ErrorBody, Page
from app.schemas.incidents import IncidentDetail, IncidentListItem, IncidentUpdate
from app.services.incidents import get_incident, list_incidents, update_incident

router = APIRouter(
    prefix="/incidents",
    tags=["incidents"],
    dependencies=[Depends(require_permissions("incident.read"))],
)


@router.get("", response_model=Page[IncidentListItem])
def read_incidents(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    owner: str | None = None,
    containment_state: str | None = None,
) -> Page[IncidentListItem]:
    return list_incidents(
        session,
        page,
        search=search,
        severity=severity,
        status=status,
        owner=owner,
        containment_state=containment_state,
    )


@router.get(
    "/{incident_id}",
    response_model=IncidentDetail,
    responses={404: {"model": ErrorBody}},
)
def read_incident(incident_id: str, session: DbSession) -> IncidentDetail:
    return get_incident(session, incident_id)


@router.patch(
    "/{incident_id}",
    response_model=IncidentDetail,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("incident.manage"))],
)
def patch_incident(
    incident_id: str,
    body: IncidentUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> IncidentDetail:
    """Update supported incident fields. Closing requires incident.close. CSRF required."""
    return update_incident(session, principal, incident_id, body)
